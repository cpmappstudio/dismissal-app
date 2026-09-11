/**
 * convex/users.ts
 * User management with Clerk integration
 * Handles CRUD operations and webhook sync
 */

import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation, action, internalQuery, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { type Doc, Id } from "./_generated/dataModel";
import { normalizeVehicleIdentifier } from "../lib/vehicle";
import { validateUserAccess } from "./helpers";
import { requireBus } from "./buses";
import { canCrudStaffRole, isPrincipalLikeRole } from "../lib/role-utils";

// ============================================================================
// AVATAR STORAGE FUNCTIONS (Following official Convex pattern)
// ============================================================================

/**
 * Generate upload URL for avatar image (Step 1 of 3)
 */
export const generateAvatarUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await validateUserAccess(ctx, MANAGEMENT_ROLES);

        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Save avatar storage ID to user record (Step 3 of 3)
 * Also returns the avatar URL to update Clerk
 */
export const saveAvatarStorageId = mutation({
    args: {
        userId: v.id("users"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const { user: actor } = await validateUserAccess(ctx, MANAGEMENT_ROLES);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }
        ensureCanUpdateUser(actor, user);

        // Delete old avatar if exists
        if (user.avatarStorageId) {
            await ctx.storage.delete(user.avatarStorageId);
        }

        // Get the public URL for the new avatar (to sync with Clerk)
        const avatarUrl = await ctx.storage.getUrl(args.storageId);

        // Update user with new avatar storage ID
        await ctx.db.patch(args.userId, {
            avatarStorageId: args.storageId,
            updatedAt: Date.now(),
        });

        return { userId: args.userId, avatarUrl };
    },
});

/**
 * Delete avatar from storage and user record
 */
export const deleteAvatar = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const { user: actor } = await validateUserAccess(ctx, MANAGEMENT_ROLES);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }
        ensureCanUpdateUser(actor, user);

        // Delete from storage if exists
        if (user.avatarStorageId) {
            await ctx.storage.delete(user.avatarStorageId);
        }

        // Remove from user record
        await ctx.db.patch(args.userId, {
            avatarStorageId: undefined,
            updatedAt: Date.now(),
        });

        return args.userId;
    },
});

/**
 * Get avatar URL from storage ID (for individual use)
 */
export const getAvatarUrl = query({
    args: {
        storageId: v.id("_storage")
    },
    handler: async (ctx, args) => {
        await validateUserAccess(ctx);
        try {
            return await ctx.storage.getUrl(args.storageId);
        } catch {
            return null;
        }
    }
});

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const ROLE_VALUES = [
  "bus_driver",
  "viewer",
  "dispatcher", 
  "allocator",
  "operator",
  "principal",
  "admin",
  "superadmin"
] as const;

const roleValidator = v.union(
  v.literal("bus_driver"),
  v.literal("viewer"),
  v.literal("dispatcher"),
  v.literal("allocator"),
  v.literal("operator"),
  v.literal("principal"),
  v.literal("admin"),
  v.literal("superadmin")
);

type Role = typeof ROLE_VALUES[number];
const MANAGEMENT_ROLES: Role[] = ["principal", "admin", "superadmin"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user by Clerk ID
 */
export async function userByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .first();
}

function isSuperadminRole(role: string | undefined): boolean {
  return role === "superadmin";
}

function ensurePrincipalCrudTarget(actorRole: Role | undefined, targetRole: Role | undefined) {
  if (!isPrincipalLikeRole(actorRole ?? null)) return;
  if (!canCrudStaffRole(actorRole ?? null, targetRole ?? null)) {
    throw new Error("Principals can only manage bus driver, operator, allocator, dispatcher, and viewer users");
  }
}

function hasCampusOverlap(
  sourceCampuses: Id<"campusSettings">[] | undefined,
  targetCampuses: Id<"campusSettings">[] | undefined
): boolean {
  if (!sourceCampuses?.length || !targetCampuses?.length) return false;
  const sourceSet = new Set(sourceCampuses);
  return targetCampuses.some((campusId) => sourceSet.has(campusId));
}

// The caller's active management role is validated before checking the resource.
function ensureCanUpdateUser(actor: Doc<"users">, target: Doc<"users">) {
  if (isSuperadminRole(actor.role)) return;
  // Missing roles have viewer access in validateUserAccess; management may repair these legacy accounts.
  ensurePrincipalCrudTarget(actor.role, target.role ?? "viewer");
  if (!hasCampusOverlap(actor.assignedCampuses, target.assignedCampuses)) {
    throw new Error("Cannot update users outside your assigned campuses");
  }
}

function ensureCampusScopeForManagement(
  actor: { role?: string; assignedCampuses?: Id<"campusSettings">[] },
  requestedCampuses: Id<"campusSettings">[]
) {
  if (isSuperadminRole(actor.role)) return;
  if (!requestedCampuses.length) {
    throw new Error("At least one campus is required");
  }

  const actorCampusSet = new Set(actor.assignedCampuses || []);
  const hasUnauthorizedCampus = requestedCampuses.some(
    (campusId) => !actorCampusSet.has(campusId)
  );

  if (hasUnauthorizedCampus) {
    throw new Error("Cannot assign campuses outside your scope");
  }
}

/**
 * Extract role from Clerk metadata (fallback to public_metadata.role or default to viewer)
 */
function extractRoleFromMetadata(clerkUser: any): Role {
  const role = clerkUser.public_metadata?.dismissalRole ||
               clerkUser.public_metadata?.role ||
               clerkUser.publicMetadata?.dismissalRole ||
               clerkUser.publicMetadata?.role ||
               "viewer";
  
  // Validate role
  if (ROLE_VALUES.includes(role)) {
    return role as Role;
  }
  
  console.warn(`Invalid role "${role}" for user, defaulting to viewer`);
  return "viewer";
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get current user profile from Clerk identity
 * Returns role from Convex database (source of truth)
 */
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Get user from database to get the role
    const user = await userByClerkId(ctx, identity.subject);

    return {
      id: identity.subject,
      email: identity.email || identity.emailAddress || "",
      firstName: identity.firstName || identity.givenName || "",
      lastName: identity.lastName || identity.familyName || "",
      imageUrl: identity.imageUrl || identity.pictureUrl || "",
      username: identity.username || "",
      role: user?.role || "viewer",
      isActive: !!user?.isActive && user.status !== "inactive",
      assignedCampuses: user?.assignedCampuses || [],
      status: user?.status || "active"
    };
  }
});

/**
 * List users within the active management user's campus scope
 */
export const listUsers = query({
  args: {
    assignedCampus: v.optional(v.id("campusSettings")), // Filter by assigned campus ID
    role: v.optional(roleValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const { user } = await validateUserAccess(ctx, MANAGEMENT_ROLES);
    const users = await ctx.db.query("users").collect();
    const scopedUsers = isSuperadminRole(user.role)
      ? users
      : users.filter((candidate) =>
          hasCampusOverlap(user.assignedCampuses, candidate.assignedCampuses)
        );

    return scopedUsers.filter((candidate) => {
      if (args.assignedCampus && !candidate.assignedCampuses.includes(args.assignedCampus)) return false;
      if (args.role && candidate.role !== args.role) return false;
      if (args.status && candidate.status !== args.status) return false;
      return true;
    });
  }
});

/**
 * Internal query to get user by clerkId (for actions)
 */
export const getUserByClerkIdInternal = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  }
});

// ============================================================================
// INTERNAL MUTATIONS (Shared by Clerk actions and verified webhooks)
// ============================================================================

/**
 * Upsert user from Clerk's API response or a verified webhook
 * Idempotent operation that handles create/update and temp user merging
 * Schedules avatar sync to Clerk if avatarStorageId is present
 */
export const upsertFromClerk = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const clerkId = data.id;
    if (typeof clerkId !== "string" || !clerkId)
      throw new Error("Missing Clerk user ID");
    const deleted = await ctx.db.query("deletedClerkUsers")
      .withIndex("by_clerk_id", q => q.eq("clerkId", clerkId)).unique();
    if (deleted) return null;
    const clerkUpdatedAt = data.updated_at;
    if (!Number.isSafeInteger(clerkUpdatedAt) || clerkUpdatedAt < 0)
      throw new Error("Missing or invalid Clerk user updated_at");
    const existingByClerkId = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    if (existingByClerkId?.clerkUpdatedAt !== undefined &&
        clerkUpdatedAt <= existingByClerkId.clerkUpdatedAt)
      return existingByClerkId._id;
    
    // Extract user data from Clerk payload
    const email = 
      data.email_addresses?.[0]?.email_address ||
      data.primary_email_address || undefined;
    const username = data.username || undefined;
    
    const firstName = data.first_name || "";
    const lastName = data.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim() || username || email || "";
    const imageUrl = data.image_url || data.profile_image_url || "";
    
    // Extract metadata
    const publicMetadata = data.public_metadata || {};
    const role = extractRoleFromMetadata(data);
    let assignedCampuses = publicMetadata.assignedCampuses || (publicMetadata.campusId ? [publicMetadata.campusId] : []);
    const phone = publicMetadata.phone || undefined;
    const busNumber = role === "bus_driver" ? normalizeVehicleIdentifier(publicMetadata.busNumber ?? "") : undefined;
    if (busNumber !== undefined) assignedCampuses = (await requireBus(ctx.db, busNumber)).campusIds;
    const avatarStorageId = publicMetadata.avatarStorageId || undefined;
    const status = publicMetadata.status || "active";

    console.log(`📝 Upserting user: ${email} (${clerkId}) with role: ${role}${avatarStorageId ? ' with avatar' : ''}`);

    let userId: any;
    let isNewUser = false;

    if (existingByClerkId) {
      // Update existing user
      // Build update object - only include avatarStorageId if it's explicitly provided
      const updates: any = {
        email,
        username,
        firstName,
        lastName,
        fullName,
        imageUrl,
        phone,
        busNumber,
        assignedCampuses,
        role,
        status,
        isActive: status === "active",
        updatedAt: Date.now(),
        clerkUpdatedAt,
      };
      
      // Only update avatarStorageId if it's explicitly provided in publicMetadata
      // This prevents overwriting the existing avatar when syncing from Clerk
      if (publicMetadata.avatarStorageId !== undefined) {
        updates.avatarStorageId = avatarStorageId;
      }
      
      await ctx.db.patch(existingByClerkId._id, updates);
      console.log(`✅ Updated existing user: ${existingByClerkId._id}`);
      userId = existingByClerkId._id;
    }
    // 2. Check for temp user merge by email
    else {
      const existingByEmail = email ? await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first() : null;

      if (existingByEmail && existingByEmail.clerkId.startsWith("temp_")) {
        // Merge: replace temp clerkId with real one
        // Build update object - preserve existing avatarStorageId unless explicitly provided
        const updates: any = {
          clerkId, // Replace temp_ with real Clerk ID
          username,
          firstName,
          lastName,
          fullName,
          imageUrl,
          phone,
          busNumber,
          assignedCampuses,
          role,
          status,
          isActive: status === "active",
          updatedAt: Date.now(),
          clerkUpdatedAt,
        };
        
        // Only update avatarStorageId if it's explicitly provided in publicMetadata
        if (publicMetadata.avatarStorageId !== undefined) {
          updates.avatarStorageId = avatarStorageId;
        }
        
        await ctx.db.patch(existingByEmail._id, updates);
        console.log(`✅ Merged temp user: ${existingByEmail._id} (temp_* → ${clerkId})`);
        userId = existingByEmail._id;
      } else {
        // 3. Create new user
        userId = await ctx.db.insert("users", {
          clerkId,
          email,
          username,
          firstName,
          lastName,
          fullName,
          imageUrl,
          phone,
          busNumber,
          avatarStorageId,
          assignedCampuses,
          role,
          status,
          isActive: status === "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          clerkUpdatedAt,
        });
        
        console.log(`✅ Created new user: ${userId}`);
        isNewUser = true;
      }
    }

    // Schedule avatar sync to Clerk if avatarStorageId is present and imageUrl doesn't match
    if (avatarStorageId && (!imageUrl || isNewUser)) {
      console.log(`📸 Scheduling avatar sync to Clerk for user: ${clerkId}`);
      await ctx.scheduler.runAfter(0, internal.users.syncAvatarToClerk, {
        userId,
        clerkId,
        avatarStorageId,
      });
    }
    
    return userId;
  }
});

/**
 * Shared deletion for the Clerk action and verified webhooks
 * Removes avatar from storage and deletes user record
 */
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    console.log(`🗑️ Deleting user: ${clerkUserId}`);
    // Deletion is terminal for this Clerk ID, even when it precedes user.created.
    const deleted = await ctx.db.query("deletedClerkUsers")
      .withIndex("by_clerk_id", q => q.eq("clerkId", clerkUserId)).unique();
    if (!deleted) await ctx.db.insert("deletedClerkUsers", { clerkId: clerkUserId });

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
      .first();

    if (!user) {
      console.warn(`⚠️ User not found for deletion: ${clerkUserId}`);
      return;
    }

    // Delete avatar from storage if exists
    if (user.avatarStorageId) {
      try {
        await ctx.storage.delete(user.avatarStorageId);
        console.log(`🗑️ Deleted avatar storage: ${user.avatarStorageId}`);
      } catch (error) {
        console.error("Error deleting avatar:", error);
      }
    }

    // Delete user record
    await ctx.db.delete(user._id);
    console.log(`✅ Deleted user record: ${user._id}`);
  }
});

/**
 * Check if user has management permissions (principal/admin/superadmin) for actions
 * Returns the caller's user object if authorized
 */
export const checkManagementPermissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { user } = await validateUserAccess(ctx, MANAGEMENT_ROLES);
    return user;
  },
});

// ============================================================================
// ACTIONS (Call Clerk API)
// ============================================================================

/**
 * Create user in Clerk with role assignment
 * Persists the Clerk user in Convex before reporting success
 * Includes avatarStorageId in public_metadata for Convex Storage sync
 */
export const createUserWithClerk = action({
  args: {
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    firstName: v.string(),
    lastName: v.string(),
    role: roleValidator,
    assignedCampuses: v.array(v.id("campusSettings")), // Required: at least one campus
    phone: v.optional(v.string()),
    busNumber: v.optional(v.union(v.number(), v.string())),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await ctx.runQuery(internal.users.checkManagementPermissions, {});
    const bus = args.role === "bus_driver" ? await ctx.runQuery(internal.buses.driverAssignment, { identifier: args.busNumber ?? "" }) : null;
    const assignedCampuses = bus?.campusIds ?? args.assignedCampuses;
    ensureCampusScopeForManagement(actor, assignedCampuses);
    if (!isSuperadminRole(actor.role) && args.role === "superadmin") {
      throw new Error("Only superadmin can create superadmin users");
    }
    ensurePrincipalCrudTarget(actor.role, args.role);
    const busNumber = args.role === "bus_driver" ? normalizeVehicleIdentifier(args.busNumber ?? "") : undefined;
    const username = args.username?.trim();
    const email = args.email?.trim();
    if (args.role === "bus_driver" && !username) {
      throw new ConvexError("A username is required for the driver.");
    }
    if (!username && !email) throw new ConvexError("An email or username is required.");
    if (username && !args.password) throw new ConvexError("A password is required with a username.");

    // Get Clerk secret key
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error(
        "CLERK_SECRET_KEY not configured. Please add it to your Convex environment variables."
      );
    }

    try {
      // Build public_metadata with avatarStorageId for Convex → Clerk sync
      const publicMetadata: any = {
        role: args.role,
        assignedCampuses,
        status: "active",
        busNumber,
      };
      
      // Include phone if provided
      if (args.phone) {
        publicMetadata.phone = args.phone;
      }
      
      // Include avatarStorageId if provided (Convex Storage reference)
      if (args.avatarStorageId) {
        publicMetadata.avatarStorageId = args.avatarStorageId;
      }

      // Create user in Clerk
      const response = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email ? [email] : undefined,
          username,
          password: args.password,
          first_name: args.firstName,
          last_name: args.lastName,
          public_metadata: publicMetadata,
          skip_password_requirement: args.password ? undefined : true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new ConvexError(error.errors?.[0]?.long_message || error.errors?.[0]?.message || "Clerk could not create the user.");
      }

      const clerkUser = await response.json();
      console.log(`✅ Created user in Clerk: ${clerkUser.id}${args.avatarStorageId ? ' (with avatar)' : ''}`);
      try {
        await ctx.runMutation(internal.users.upsertFromClerk, { data: clerkUser });
      } catch {
        throw new ConvexError("The account was created in Clerk, but could not be saved in the app. Do not create it again; contact an administrator to synchronize it.");
      }

      // Username-only accounts sign in with their supplied password, not an invitation.
      if (email) {
        const inviteResponse = await fetch("https://api.clerk.com/v1/invitations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: email,
            public_metadata: {
              role: args.role,
              assignedCampuses,
              busNumber,
            },
            redirect_url: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in",
          }),
        });

        if (!inviteResponse.ok) {
          console.warn("Failed to send invitation:", await inviteResponse.text());
        } else {
          console.log(`📧 Invitation sent to: ${email}`);
        }
      }

      return {
        success: true,
        clerkUserId: clerkUser.id,
        message: "User created and synchronized.",
      };
      
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const err = error as Error;
      console.error("❌ Error creating user:", err.message);
      throw new Error(`Failed to create user: ${err.message}`);
    }
  }
});

/**
 * Update user in Clerk
 * Updates metadata and synchronizes the result before reporting success
 * Preserves or updates avatarStorageId in public_metadata for Convex Storage sync
 */
export const updateUserWithClerk = action({
  args: {
    clerkUserId: v.string(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.optional(roleValidator),
    assignedCampuses: v.optional(v.array(v.id("campusSettings"))),
    phone: v.optional(v.string()),
    busNumber: v.optional(v.union(v.number(), v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())), // Allow null to remove avatar
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await ctx.runQuery(internal.users.checkManagementPermissions, {});
    const targetUser = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
      clerkId: args.clerkUserId,
    });

    if (!targetUser) {
      throw new Error("Target user not found");
    }
    const targetRole = args.role ?? targetUser.role;
    const busNumber = targetRole === "bus_driver" ? normalizeVehicleIdentifier(args.busNumber ?? targetUser.busNumber ?? "") : null;
    const bus = targetRole === "bus_driver" ? await ctx.runQuery(internal.buses.driverAssignment, { identifier: busNumber! }) : null;
    const assignedCampuses = bus?.campusIds ?? args.assignedCampuses;

    if (
      targetUser.role === "superadmin" &&
      args.role !== undefined &&
      args.role !== "superadmin"
    ) {
      throw new Error("Superadmin role cannot be changed");
    }

    ensureCanUpdateUser(actor, targetUser);
    if (!isSuperadminRole(actor.role)) {
      if (args.role === "superadmin") {
        throw new Error("Only superadmin can grant superadmin role");
      }
      if (args.role !== undefined) {
        ensurePrincipalCrudTarget(actor.role, args.role);
      }
      if (assignedCampuses !== undefined) {
        ensureCampusScopeForManagement(actor, assignedCampuses);
      }
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    try {
      // First, fetch the current user to get existing metadata
      const getUserResponse = await fetch(
        `https://api.clerk.com/v1/users/${args.clerkUserId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!getUserResponse.ok) {
        throw new Error(`Failed to fetch user: ${getUserResponse.status}`);
      }

      const currentUser = await getUserResponse.json();
      
      // Build update payload
      const updateData: any = {};
      
      if (args.firstName) updateData.first_name = args.firstName;
      if (args.lastName) updateData.last_name = args.lastName;
      if (args.username !== undefined) {
        if (!args.username.trim()) throw new ConvexError("Username cannot be empty.");
        updateData.username = args.username.trim();
      }

      // Merge with existing public_metadata to preserve avatarStorageId and other fields
      const publicMetadata: any = {
        ...(currentUser.public_metadata || {}), // Preserve existing metadata
      };
      
      // Update only the fields that were provided
      if (args.role) publicMetadata.role = args.role;
      if (assignedCampuses !== undefined) publicMetadata.assignedCampuses = assignedCampuses;
      if (args.phone !== undefined) publicMetadata.phone = args.phone;
      publicMetadata.busNumber = busNumber;
      if (args.status) publicMetadata.status = args.status;
      
      // Handle avatarStorageId updates (Convex → Clerk sync)
      if (args.avatarStorageId !== undefined) {
        if (args.avatarStorageId === null) {
          // Explicitly remove avatar
          delete publicMetadata.avatarStorageId;
          console.log(`🗑️ Removing avatarStorageId from Clerk metadata for user: ${args.clerkUserId}`);
        } else {
          // Update with new avatar storage ID
          publicMetadata.avatarStorageId = args.avatarStorageId;
          console.log(`📸 Updating avatarStorageId in Clerk metadata for user: ${args.clerkUserId}`);
        }
      }

      updateData.public_metadata = publicMetadata;

      // Update user in Clerk
      const response = await fetch(
        `https://api.clerk.com/v1/users/${args.clerkUserId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new ConvexError(error.errors?.[0]?.long_message || error.errors?.[0]?.message || "Clerk could not update the user.");
      }

      const updatedUser = await response.json();
      console.log(`✅ Updated user in Clerk: ${updatedUser.id}`);
      try {
        await ctx.runMutation(internal.users.upsertFromClerk, { data: updatedUser });
      } catch {
        throw new ConvexError("The account was updated in Clerk, but could not be saved in the app. Contact an administrator to synchronize it.");
      }

      return {
        success: true,
        clerkUserId: updatedUser.id,
        message: "User updated and synchronized.",
      };
      
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const err = error as Error;
      console.error("❌ Error updating user:", err.message);
      throw new Error(`Failed to update user: ${err.message}`);
    }
  }
});

/**
 * Delete user from Clerk
 * Synchronizes deletion in Convex before reporting success
 */
export const deleteUserWithClerk = action({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await ctx.runQuery(internal.users.checkManagementPermissions, {});
    const targetUser = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
      clerkId: args.clerkUserId,
    });

    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role === "superadmin") {
      throw new Error("Superadmin users cannot be deleted");
    }

    if (!isSuperadminRole(actor.role)) {
      ensurePrincipalCrudTarget(actor.role, targetUser.role);
      if (!hasCampusOverlap(actor.assignedCampuses, targetUser.assignedCampuses)) {
        throw new Error("Cannot delete users outside your assigned campuses");
      }
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    try {
      // Delete user from Clerk
      const response = await fetch(
        `https://api.clerk.com/v1/users/${args.clerkUserId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
          },
        }
      );

      // A retry may find Clerk already deleted the user before Convex synchronized.
      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Clerk API error: ${response.status} - ${error}`);
      }

      try {
        await ctx.runMutation(internal.users.deleteFromClerk, {
          clerkUserId: args.clerkUserId,
        });
      } catch {
        throw new ConvexError("The account was deleted in Clerk, but could not be removed from the app. Retry the deletion to finish synchronizing it.");
      }

      return {
        success: true,
        clerkUserId: args.clerkUserId,
        message: "User deleted and synchronized.",
      };
      
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const err = error as Error;
      console.error("❌ Error deleting user:", err.message);
      throw new Error(`Failed to delete user: ${err.message}`);
    }
  }
});

/**
 * Internal action to sync avatar from Convex Storage to Clerk
 * Called automatically after webhook creates/updates user with avatarStorageId
 * Downloads image from Convex and uploads to Clerk as multipart form data
 */
export const syncAvatarToClerk = internalAction({
  args: {
    userId: v.id("users"),
    clerkId: v.string(),
    avatarStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      // Get the avatar URL from Convex Storage via query
      const avatarUrl = await ctx.runQuery(internal.users.getAvatarUrlInternal, {
        storageId: args.avatarStorageId,
      });
      
      if (!avatarUrl) {
        console.warn(`⚠️ Could not get avatar URL for storage ID: ${args.avatarStorageId}`);
        return;
      }

      // Update Clerk profile image using the Set Profile Image endpoint
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        console.error("CLERK_SECRET_KEY not configured");
        return;
      }

      console.log(`📸 Syncing avatar to Clerk for user ${args.clerkId} from URL: ${avatarUrl.substring(0, 60)}...`);

      // Download the image from Convex Storage
      const imageResponse = await fetch(avatarUrl);
      if (!imageResponse.ok) {
        console.error(`❌ Failed to download image from Convex Storage`);
        return;
      }

      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();

      // Upload to Clerk using multipart/form-data
      const formData = new FormData();
      formData.append('file', new Blob([imageBuffer], { type: imageBlob.type }), 'avatar.jpg');

      const response = await fetch(
        `https://api.clerk.com/v1/users/${args.clerkId}/profile_image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to update Clerk profile image: ${response.status} - ${error}`);
        return;
      }

      const result = await response.json();
      console.log(`✅ Successfully synced avatar to Clerk for user: ${args.clerkId}`);
      console.log(`   New image URL: ${result.public_url || result.image_url || 'unknown'}`);
    } catch (error) {
      console.error(`❌ Error syncing avatar to Clerk:`, error);
    }
  }
});

/**
 * Internal query to get avatar URL (for internal use only)
 */
export const getAvatarUrlInternal = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      return await ctx.storage.getUrl(args.storageId);
    } catch {
      return null;
    }
  }
});

/**
 * Update user profile image in Clerk
 * Syncs Convex Storage avatar to Clerk's imageUrl
 * Takes avatarStorageId, gets fresh URL, downloads and uploads to Clerk
 */
export const updateClerkProfileImage = action({
  args: {
    clerkUserId: v.string(),
    avatarStorageId: v.union(v.id("_storage"), v.null()), // null to remove image
  },
  handler: async (ctx, args) => {
    const actor = await ctx.runQuery(internal.users.checkManagementPermissions, {});
    const target = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
      clerkId: args.clerkUserId,
    });
    if (!target) throw new Error("Target user not found");
    ensureCanUpdateUser(actor, target);
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    try {
      if (args.avatarStorageId === null) {
        // Delete profile image from Clerk
        const response = await fetch(
          `https://api.clerk.com/v1/users/${args.clerkUserId}/profile_image`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
            },
          }
        );

        if (!response.ok && response.status !== 404) {
          const error = await response.text();
          throw new Error(`Clerk API error: ${response.status} - ${error}`);
        }

        console.log(`✅ Removed profile image from Clerk: ${args.clerkUserId}`);
        return {
          success: true,
          clerkUserId: args.clerkUserId,
          imageUrl: null,
        };
      } else {
        // Get fresh URL from Convex Storage
        const avatarUrl = await ctx.runQuery(internal.users.getAvatarUrlInternal, {
          storageId: args.avatarStorageId,
        });

        if (!avatarUrl) {
          throw new Error(`Could not get avatar URL from storage ID: ${args.avatarStorageId}`);
        }

        // Download the image from Convex Storage
        console.log(`📸 Downloading image from Convex Storage for user: ${args.clerkUserId}`);
        const imageResponse = await fetch(avatarUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image from Convex Storage: ${imageResponse.status}`);
        }

        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();

        // Upload to Clerk using multipart/form-data
        const formData = new FormData();
        formData.append('file', new Blob([imageBuffer], { type: imageBlob.type }), 'avatar.jpg');

        const response = await fetch(
          `https://api.clerk.com/v1/users/${args.clerkUserId}/profile_image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Clerk API error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log(`✅ Updated profile image in Clerk: ${args.clerkUserId}`);
        console.log(`   New Clerk image URL: ${result.public_url || result.image_url || 'unknown'}`);

        return {
          success: true,
          clerkUserId: result.id || args.clerkUserId,
          imageUrl: result.public_url || result.image_url,
        };
      }
      
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error updating profile image:", err.message);
      throw new Error(`Failed to update profile image: ${err.message}`);
    }
  }
});

// ============================================================================
// MUTATIONS (Direct Convex operations - for testing or temp users)
// ============================================================================

/**
 * Create temporary user (before Clerk sync)
 * Used for pre-creating users that will be linked later
 */
export const createTempUser = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: roleValidator,
    assignedCampuses: v.array(v.id("campusSettings")), // Required: at least one campus
  },
  handler: async (ctx, args) => {
    // Check permissions
    const { user: actor } = await validateUserAccess(ctx, MANAGEMENT_ROLES);
    ensureCampusScopeForManagement(actor, args.assignedCampuses);
    if (!isSuperadminRole(actor.role) && args.role === "superadmin") {
      throw new Error("Only superadmin can create superadmin users");
    }
    ensurePrincipalCrudTarget(actor.role, args.role);

    // Check if email already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error(`User with email ${args.email} already exists`);
    }

    // Create temp user
    const tempClerkId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const userId = await ctx.db.insert("users", {
      clerkId: tempClerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      fullName: `${args.firstName} ${args.lastName}`.trim(),
      role: args.role,
      assignedCampuses: args.assignedCampuses,
      status: "active",
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`✅ Created temp user: ${userId} (${tempClerkId})`);
    
    return userId;
  }
});
