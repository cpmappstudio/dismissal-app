/**
 * convex/users.ts
 * User management with Clerk integration
 * Handles CRUD operations and webhook sync
 */

import { v } from "convex/values";
import { query, mutation, internalMutation, action, internalQuery, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// AVATAR STORAGE FUNCTIONS (Following official Convex pattern)
// ============================================================================

/**
 * Generate upload URL for avatar image (Step 1 of 3)
 */
export const generateAvatarUploadUrl = mutation({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

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
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

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
 * Delete avatar storage file (for cleaning up unused uploads)
 */
export const deleteAvatarStorage = mutation({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        try {
            await ctx.storage.delete(args.storageId);
        } catch {
            // Don't throw - storage might already be deleted
        }
    },
});

/**
 * Delete avatar from storage and user record
 */
export const deleteAvatar = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

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
        try {
            return await ctx.storage.getUrl(args.storageId);
        } catch {
            return null;
        }
    }
});

/**
 * Get multiple avatar URLs efficiently for batch operations
 * Use sparingly to avoid performance issues - prefer individual queries
 */
export const getBatchAvatarUrls = query({
    args: {
        storageIds: v.array(v.id("_storage"))
    },
    handler: async (ctx, args) => {
        try {
            const urls: Record<string, string | null> = {};

            // Process each storage ID individually to avoid Promise.all performance issues
            for (const storageId of args.storageIds) {
                try {
                    const url = await ctx.storage.getUrl(storageId);
                    urls[storageId] = url;
                } catch {
                    urls[storageId] = null;
                }
            }

            return urls;
        } catch {
            return {};
        }
    }
});

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const ROLE_VALUES = [
  "viewer",
  "dispatcher", 
  "allocator",
  "operator",
  "principal",
  "admin",
  "superadmin"
] as const;

const roleValidator = v.union(
  v.literal("viewer"),
  v.literal("dispatcher"),
  v.literal("allocator"),
  v.literal("operator"),
  v.literal("principal"),
  v.literal("admin"),
  v.literal("superadmin")
);

const reconciliationFieldValidator = v.union(
  v.literal("role"),
  v.literal("assignedCampuses")
);

type Role = typeof ROLE_VALUES[number];
type ReconciliationField = "role" | "assignedCampuses";
const MANAGEMENT_ROLES: Role[] = ["principal", "admin", "superadmin"];
const RECONCILIATION_FIELDS: ReconciliationField[] = ["role", "assignedCampuses"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Require that the current user has one of the allowed roles
 * Throws error if not authenticated or insufficient permissions
 */
export async function requireRoles(
  ctx: any,
  allowedRoles: Role[]
): Promise<{ userId: Id<"users">; user: any; role: Role }> {
  const identity = await ctx.auth.getUserIdentity();
  
  if (!identity) {
    throw new Error("Authentication required");
  }

  const user = await userByClerkId(ctx, identity.subject);
  
  if (!user) {
    throw new Error("User not found in database");
  }

  const userRole = user.role as Role;

  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `Insufficient permissions. Required: ${allowedRoles.join(", ")}. You have: ${userRole}`
    );
  }

  return { userId: user._id, user, role: userRole };
}

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

function isPrincipalLikeRole(role: string | undefined): boolean {
  return role === "principal" || role === "admin";
}

function canPrincipalCrudRole(role: string | undefined): boolean {
  return (
    role === "operator" ||
    role === "allocator" ||
    role === "dispatcher" ||
    role === "viewer"
  );
}

function ensurePrincipalCrudTarget(actorRole: string | undefined, targetRole: string | undefined) {
  if (!isPrincipalLikeRole(actorRole)) return;
  if (!canPrincipalCrudRole(targetRole)) {
    throw new Error("Principals can only manage operator, allocator, dispatcher, and viewer users");
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
  const role = clerkUser.public_metadata?.role ||
               clerkUser.publicMetadata?.role ||
               "viewer";
  
  // Validate role
  if (ROLE_VALUES.includes(role)) {
    return role as Role;
  }
  
  console.warn(`Invalid role "${role}" for user, defaulting to viewer`);
  return "viewer";
}

function normalizeCampusMetadata(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const values = value.filter((entry): entry is string => typeof entry === "string");
  return Array.from(new Set(values)).sort();
}

function arraysMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function toClerkRole(rawRole: string | undefined): Role {
  if (rawRole && ROLE_VALUES.includes(rawRole as Role)) {
    return rawRole as Role;
  }
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
      assignedCampuses: user?.assignedCampuses || [],
      status: user?.status || "active"
    };
  }
});

/**
 * List all users (admin/superadmin only)
 */
export const listUsers = query({
  args: {
    assignedCampus: v.optional(v.id("campusSettings")), // Filter by assigned campus ID
    role: v.optional(roleValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    // Check authentication first
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      // Return empty array when not authenticated (graceful degradation)
      return [];
    }

    // Get user from database
    const user = await userByClerkId(ctx, identity.subject);
    
    if (!user) {
      // User not found in database
      return [];
    }

    // Check if user has required role
    if (!MANAGEMENT_ROLES.includes(user.role as Role)) {
      // Insufficient permissions - return empty array
      return [];
    }

    // User is authenticated and authorized - proceed with query
    let usersQuery = ctx.db.query("users");

    // Apply filters
    const users = await usersQuery.collect();
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
 * Get user by ID
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  }
});

/**
 * Get user by Clerk ID (public query)
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
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

/**
 * Internal query used by reconciliation action to scan users in Convex
 */
export const listUsersForReconciliationInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// ============================================================================
// INTERNAL MUTATIONS (Called by webhooks only)
// ============================================================================

/**
 * Upsert user from Clerk webhook
 * Idempotent operation that handles create/update and temp user merging
 * Schedules avatar sync to Clerk if avatarStorageId is present
 */
export const upsertFromClerk = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const clerkId = data.id;
    
    // Extract user data from Clerk payload
    const email = 
      data.email_addresses?.[0]?.email_address ||
      data.primary_email_address ||
      `user_${clerkId}@temp.clerk`;
    
    const firstName = data.first_name || "";
    const lastName = data.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim() || email;
    const imageUrl = data.image_url || data.profile_image_url || "";
    
    // Extract metadata
    const publicMetadata = data.public_metadata || {};
    const role = extractRoleFromMetadata(data);
    const assignedCampuses = publicMetadata.assignedCampuses || (publicMetadata.campusId ? [publicMetadata.campusId] : []);
    const phone = publicMetadata.phone || undefined;
    const avatarStorageId = publicMetadata.avatarStorageId || undefined;
    const status = publicMetadata.status || "active";

    console.log(`📝 Upserting user: ${email} (${clerkId}) with role: ${role}${avatarStorageId ? ' with avatar' : ''}`);

    // 1. Check if user exists by clerkId
    const existingByClerkId = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    let userId: any;
    let isNewUser = false;

    if (existingByClerkId) {
      // Update existing user
      // Build update object - only include avatarStorageId if it's explicitly provided
      const updates: any = {
        email,
        firstName,
        lastName,
        fullName,
        imageUrl,
        phone,
        assignedCampuses,
        role,
        status,
        isActive: status === "active",
        updatedAt: Date.now(),
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
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (existingByEmail && existingByEmail.clerkId.startsWith("temp_")) {
        // Merge: replace temp clerkId with real one
        // Build update object - preserve existing avatarStorageId unless explicitly provided
        const updates: any = {
          clerkId, // Replace temp_ with real Clerk ID
          firstName,
          lastName,
          fullName,
          imageUrl,
          phone,
          assignedCampuses,
          role,
          status,
          isActive: status === "active",
          updatedAt: Date.now(),
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
          firstName,
          lastName,
          fullName,
          imageUrl,
          phone,
          avatarStorageId,
          assignedCampuses,
          role,
          status,
          isActive: status === "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
 * Delete user from Clerk webhook
 * Removes avatar from storage and deletes user record
 */
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    console.log(`🗑️ Deleting user: ${clerkUserId}`);

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
async function checkManagementPermissions(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  
  // Get user from database by clerkId using internal query
  const user = await ctx.runQuery(internal.users.getUserByClerkIdInternal, { 
    clerkId: identity.subject 
  });
  
  if (!user) {
    throw new Error("User not found in database");
  }
  
  if (!MANAGEMENT_ROLES.includes(user.role as Role)) {
    throw new Error("Only principal/admin/superadmin can perform this action");
  }
  
  return user;
}

/**
 * Allow reconciliation either as mapped superadmin user or with an ops token.
 * This avoids lockout when running from Convex dashboard during auth drift incidents.
 */
async function authorizeReconciliation(
  ctx: any,
  adminToken?: string
): Promise<"superadmin_user" | "ops_token"> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity) {
    const user = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
      clerkId: identity.subject,
    });

    if (user && isSuperadminRole(user.role)) {
      return "superadmin_user";
    }
  }

  const configuredOpsToken = process.env.RECONCILIATION_ADMIN_TOKEN;
  if (!configuredOpsToken) {
    throw new Error(
      "Not authorized for reconciliation. Configure RECONCILIATION_ADMIN_TOKEN or run as mapped superadmin user."
    );
  }

  if (!adminToken) {
    throw new Error(
      "Not authorized for reconciliation. Provide adminToken (matches RECONCILIATION_ADMIN_TOKEN)."
    );
  }

  if (adminToken !== configuredOpsToken) {
    throw new Error("Invalid adminToken for reconciliation");
  }

  return "ops_token";
}

// ============================================================================
// ACTIONS (Call Clerk API)
// ============================================================================

/**
 * Create user in Clerk with role assignment
 * Sends invitation email and syncs via webhook
 * Includes avatarStorageId in public_metadata for Convex Storage sync
 */
export const createUserWithClerk = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: roleValidator,
    assignedCampuses: v.array(v.id("campusSettings")), // Required: at least one campus
    phone: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await checkManagementPermissions(ctx);
    ensureCampusScopeForManagement(actor, args.assignedCampuses);
    if (!isSuperadminRole(actor.role) && args.role === "superadmin") {
      throw new Error("Only superadmin can create superadmin users");
    }
    ensurePrincipalCrudTarget(actor.role, args.role);

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
        assignedCampuses: args.assignedCampuses,
        status: "active",
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
          email_address: [args.email],
          first_name: args.firstName,
          last_name: args.lastName,
          public_metadata: publicMetadata,
          skip_password_checks: true,
          skip_password_requirement: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Clerk API error: ${response.status} - ${error}`);
      }

      const clerkUser = await response.json();
      console.log(`✅ Created user in Clerk: ${clerkUser.id}${args.avatarStorageId ? ' (with avatar)' : ''}`);

      // Create invitation
      const inviteResponse = await fetch("https://api.clerk.com/v1/invitations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: args.email,
          public_metadata: {
            role: args.role,
            assignedCampuses: args.assignedCampuses,
          },
          redirect_url: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in",
        }),
      });

      if (!inviteResponse.ok) {
        console.warn("Failed to send invitation:", await inviteResponse.text());
      } else {
        console.log(`📧 Invitation sent to: ${args.email}`);
      }

      // Webhook will handle Convex sync
      return {
        success: true,
        clerkUserId: clerkUser.id,
        message: "User created in Clerk. Invitation sent. Waiting for webhook sync...",
      };
      
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error creating user:", err.message);
      throw new Error(`Failed to create user: ${err.message}`);
    }
  }
});

/**
 * Update user in Clerk
 * Updates metadata and syncs via webhook
 * Preserves or updates avatarStorageId in public_metadata for Convex Storage sync
 */
export const updateUserWithClerk = action({
  args: {
    clerkUserId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.optional(roleValidator),
    assignedCampuses: v.optional(v.array(v.id("campusSettings"))),
    phone: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())), // Allow null to remove avatar
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await checkManagementPermissions(ctx);
    const targetUser = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
      clerkId: args.clerkUserId,
    });

    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (
      targetUser.role === "superadmin" &&
      args.role !== undefined &&
      args.role !== "superadmin"
    ) {
      throw new Error("Superadmin role cannot be changed");
    }

    if (!isSuperadminRole(actor.role)) {
      ensurePrincipalCrudTarget(actor.role, targetUser.role);
      if (targetUser.role === "superadmin") {
        throw new Error("Only superadmin can update superadmin users");
      }
      if (!hasCampusOverlap(actor.assignedCampuses, targetUser.assignedCampuses)) {
        throw new Error("Cannot update users outside your assigned campuses");
      }
      if (args.role === "superadmin") {
        throw new Error("Only superadmin can grant superadmin role");
      }
      if (args.role !== undefined) {
        ensurePrincipalCrudTarget(actor.role, args.role);
      }
      if (args.assignedCampuses !== undefined) {
        ensureCampusScopeForManagement(actor, args.assignedCampuses);
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

      // Merge with existing public_metadata to preserve avatarStorageId and other fields
      const publicMetadata: any = {
        ...(currentUser.public_metadata || {}), // Preserve existing metadata
      };
      
      // Update only the fields that were provided
      if (args.role) {
        publicMetadata.role = args.role;
      }
      if (args.assignedCampuses !== undefined) publicMetadata.assignedCampuses = args.assignedCampuses;
      if (args.phone !== undefined) publicMetadata.phone = args.phone;
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
        const error = await response.text();
        throw new Error(`Clerk API error: ${response.status} - ${error}`);
      }

      const updatedUser = await response.json();
      console.log(`✅ Updated user in Clerk: ${updatedUser.id}`);

      // Webhook will handle Convex sync
      return {
        success: true,
        clerkUserId: updatedUser.id,
        message: "User updated in Clerk. Waiting for webhook sync...",
      };
      
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error updating user:", err.message);
      throw new Error(`Failed to update user: ${err.message}`);
    }
  }
});

/**
 * Delete user from Clerk
 * Removes from Clerk and syncs deletion via webhook
 */
export const deleteUserWithClerk = action({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check permissions
    const actor = await checkManagementPermissions(ctx);
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

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Clerk API error: ${response.status} - ${error}`);
      }

      console.log(`✅ Deleted user from Clerk: ${args.clerkUserId}`);

      // Webhook will handle Convex cleanup
      return {
        success: true,
        clerkUserId: args.clerkUserId,
        message: "User deleted from Clerk. Waiting for webhook sync...",
      };
      
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error deleting user:", err.message);
      throw new Error(`Failed to delete user: ${err.message}`);
    }
  }
});

/**
 * Reconcile Convex user role/campus assignments to Clerk public_metadata.
 * Use dryRun=true to preview drift before applying changes.
 */
export const reconcileUsersToClerk = action({
  args: {
    dryRun: v.boolean(),
    fields: v.optional(v.array(reconciliationFieldValidator)),
    clerkUserIds: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    includeDetails: v.optional(v.boolean()),
    adminToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authorizationMode = await authorizeReconciliation(ctx, args.adminToken);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    if (
      args.limit !== undefined &&
      (!Number.isInteger(args.limit) || args.limit <= 0)
    ) {
      throw new Error("limit must be a positive integer");
    }

    const selectedFields = new Set<ReconciliationField>(
      args.fields && args.fields.length > 0 ? args.fields : RECONCILIATION_FIELDS
    );
    const includeDetails = args.includeDetails ?? true;

    let users: any[] = [];
    if (args.clerkUserIds && args.clerkUserIds.length > 0) {
      const uniqueIds = Array.from(new Set(args.clerkUserIds));
      for (const clerkId of uniqueIds) {
        const user = await ctx.runQuery(internal.users.getUserByClerkIdInternal, {
          clerkId,
        });
        if (user) users.push(user);
      }
    } else {
      users = await ctx.runQuery(internal.users.listUsersForReconciliationInternal, {});
    }

    if (args.limit !== undefined) {
      users = users.slice(0, args.limit);
    }

    const summary = {
      dryRun: args.dryRun,
      authorizationMode,
      fields: Array.from(selectedFields.values()),
      candidates: users.length,
      processed: 0,
      inSync: 0,
      driftDetected: 0,
      updated: 0,
      skippedTemp: 0,
      missingInClerk: 0,
      failed: 0,
    };

    const details: any[] = [];

    for (const user of users) {
      const clerkId = user.clerkId;
      const detail: any = {
        clerkUserId: clerkId,
        userId: user._id,
        email: user.email || null,
      };

      if (!clerkId || clerkId.startsWith("temp_")) {
        summary.skippedTemp += 1;
        if (includeDetails) {
          detail.status = "skipped_temp";
          details.push(detail);
        }
        continue;
      }

      summary.processed += 1;

      try {
        const getUserResponse = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        });

        if (getUserResponse.status === 404) {
          summary.missingInClerk += 1;
          if (includeDetails) {
            detail.status = "missing_in_clerk";
            details.push(detail);
          }
          continue;
        }

        if (!getUserResponse.ok) {
          const errorBody = await getUserResponse.text();
          throw new Error(`Failed to fetch Clerk user: ${getUserResponse.status} - ${errorBody}`);
        }

        const clerkUser = await getUserResponse.json();
        const currentPublicMetadata = clerkUser.public_metadata || {};

        const expectedRole = toClerkRole(user.role);
        const currentRoleRaw = currentPublicMetadata.role;
        const currentRole = typeof currentRoleRaw === "string" ? currentRoleRaw : undefined;

        const expectedCampuses = normalizeCampusMetadata(user.assignedCampuses || []);
        const currentCampuses = normalizeCampusMetadata(
          currentPublicMetadata.assignedCampuses ||
            (currentPublicMetadata.campusId ? [currentPublicMetadata.campusId] : [])
        );

        const roleDrift =
          selectedFields.has("role") &&
          currentRole !== expectedRole;
        const campusesDrift =
          selectedFields.has("assignedCampuses") &&
          !arraysMatch(currentCampuses, expectedCampuses);

        if (!roleDrift && !campusesDrift) {
          summary.inSync += 1;
          if (includeDetails) {
            detail.status = "in_sync";
            details.push(detail);
          }
          continue;
        }

        summary.driftDetected += 1;
        if (includeDetails) {
          detail.changes = {};
          if (roleDrift) {
            detail.changes.role = {
              convex: expectedRole,
              clerk: currentRole || null,
            };
          }
          if (campusesDrift) {
            detail.changes.assignedCampuses = {
              convex: expectedCampuses,
              clerk: currentCampuses,
            };
          }
        }

        if (args.dryRun) {
          if (includeDetails) {
            detail.status = "drift_detected";
            details.push(detail);
          }
          continue;
        }

        const mergedPublicMetadata: any = {
          ...currentPublicMetadata,
        };

        if (selectedFields.has("role")) {
          mergedPublicMetadata.role = expectedRole;
          delete mergedPublicMetadata.dismissalRole;
        }

        if (selectedFields.has("assignedCampuses")) {
          mergedPublicMetadata.assignedCampuses = expectedCampuses;
          delete mergedPublicMetadata.campusId;
        }

        const patchResponse = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            public_metadata: mergedPublicMetadata,
          }),
        });

        if (!patchResponse.ok) {
          const patchError = await patchResponse.text();
          throw new Error(`Failed to patch Clerk user: ${patchResponse.status} - ${patchError}`);
        }

        summary.updated += 1;
        if (includeDetails) {
          detail.status = "updated";
          details.push(detail);
        }
      } catch (error) {
        summary.failed += 1;
        if (includeDetails) {
          detail.status = "error";
          detail.error = (error as Error).message;
          details.push(detail);
        }
      }
    }

    return includeDetails ? { ...summary, details } : summary;
  },
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
    const { user: actor } = await requireRoles(ctx, ["principal", "admin", "superadmin"]);
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
