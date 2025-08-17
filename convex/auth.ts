import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { 
  userRoleValidator, 
  ErrorCodes, 
  AppError,
  type UserRole 
} from "./types";
import { 
  getCurrentUserFromAuth,
  requireAuth,
  requireRole 
} from "./helpers";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get current authenticated user with enriched data
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserFromAuth(ctx);
    if (!user) return null;

    // Enrich with program data if student
    if (user.role === "student" && user.studentProfile) {
      const program = await ctx.db.get(user.studentProfile.programId);
      return { 
        ...user, 
        program,
        // Calculate if user can see grades (for UI)
        canViewGrades: user.studentProfile.showGrades,
        canViewProfile: user.studentProfile.showProfile,
        canViewCourses: user.studentProfile.showCourses,
      };
    }
    
    return user;
  },
});

/**
 * Check if an email is authorized to register
 */
export const checkEmailAuthorization = query({
  args: { 
    email: v.string() 
  },
  handler: async (ctx, args) => {
    const accessEntry = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => 
        q.eq("email", args.email).eq("isUsed", false)
      )
      .first();

    if (!accessEntry) {
      return { authorized: false, message: "Email not authorized for registration" };
    }

    // Check expiration
    if (accessEntry.expiresAt && accessEntry.expiresAt < Date.now()) {
      return { authorized: false, message: "Registration authorization has expired" };
    }

    return { 
      authorized: true, 
      role: accessEntry.role,
      programId: accessEntry.programId,
      message: "Email authorized for registration"
    };
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Register a new user from Clerk authentication
 * This is called after successful Clerk sign-up
 */
export const registerUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      // User already registered, just return the ID
      return { 
        userId: existingUser._id, 
        isNewUser: false 
      };
    }

    // Check if email exists in system (shouldn't happen with Clerk)
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingEmail) {
      throw new AppError(
        "Email already registered in the system",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check accessList for authorization
    const accessEntry = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => 
        q.eq("email", args.email).eq("isUsed", false)
      )
      .first();

    if (!accessEntry) {
      throw new AppError(
        "Your email is not authorized for registration. Please contact an administrator.",
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Check if access entry is expired
    if (accessEntry.expiresAt && accessEntry.expiresAt < Date.now()) {
      throw new AppError(
        "Your registration authorization has expired. Please contact an administrator.",
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Build user data
    const userData: any = {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      phone: args.phone,
      country: args.country,
      city: args.city,
      role: accessEntry.role,
      isActive: true,
      createdBy: accessEntry.createdBy,
      createdAt: Date.now(),
    };

    // Add role-specific profile
    if (accessEntry.role === "student" && accessEntry.programId) {
      userData.studentProfile = {
        studentCode: accessEntry.studentCode || `STU${Date.now()}`,
        programId: accessEntry.programId,
        enrollmentYear: new Date().getFullYear(),
        status: "active" as const,
        // Default privacy settings
        showProfile: true,
        showCourses: true,
        showGrades: false,
      };
    } else if (accessEntry.role === "professor") {
      userData.professorProfile = {
        employeeCode: `PROF${Date.now()}`,
        department: "", // To be updated later
        title: undefined,
      };
    }

    // Create user
    const userId = await ctx.db.insert("users", userData);

    // Mark accessList entry as used
    await ctx.db.patch(accessEntry._id, {
      isUsed: true,
      usedAt: Date.now(),
      usedBy: userId,
    });

    return { 
      userId, 
      isNewUser: true,
      role: accessEntry.role 
    };
  },
});

/**
 * Update user's last login time
 */
export const updateLastLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    
    await ctx.db.patch(user._id, {
      lastLoginAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/**
 * Add an email to the access list (Admin only)
 */
export const addToAccessList = mutation({
  args: {
    email: v.string(),
    role: userRoleValidator,
    programId: v.optional(v.id("programs")),
    studentCode: v.optional(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Require admin role
    const admin = await requireRole(ctx, "admin");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new AppError(
        "Invalid email format",
        ErrorCodes.INVALID_INPUT
      );
    }

    // Check if email already exists in users
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new AppError(
        "Email already registered as a user",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check if email already in accessList (unused)
    const existingEntry = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => 
        q.eq("email", args.email).eq("isUsed", false)
      )
      .first();

    if (existingEntry) {
      throw new AppError(
        "Email already has a pending authorization",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Validate student-specific fields
    if (args.role === "student" && !args.programId) {
      throw new AppError(
        "Program ID is required for student role",
        ErrorCodes.INVALID_INPUT
      );
    }

    // Calculate expiration
    const expiresAt = args.expiresInDays 
      ? Date.now() + (args.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create access list entry
    const entryId = await ctx.db.insert("accessList", {
      email: args.email,
      role: args.role,
      programId: args.programId,
      studentCode: args.studentCode,
      createdBy: admin._id,
      createdAt: Date.now(),
      expiresAt,
      isUsed: false,
    });

    return { 
      success: true, 
      entryId,
      message: `Email ${args.email} authorized for registration as ${args.role}`
    };
  },
});

/**
 * Bulk add emails to access list (Admin only)
 */
export const bulkAddToAccessList = mutation({
  args: {
    entries: v.array(v.object({
      email: v.string(),
      role: userRoleValidator,
      programId: v.optional(v.id("programs")),
      studentCode: v.optional(v.string()),
    })),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    const results = {
      successful: [] as string[],
      failed: [] as { email: string; reason: string }[],
    };

    const expiresAt = args.expiresInDays 
      ? Date.now() + (args.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    for (const entry of args.entries) {
      try {
        // Check if email already exists
        const existingUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", entry.email))
          .first();

        if (existingUser) {
          results.failed.push({
            email: entry.email,
            reason: "Already registered",
          });
          continue;
        }

        // Check if already in accessList
        const existingEntry = await ctx.db
          .query("accessList")
          .withIndex("by_email_unused", (q) => 
            q.eq("email", entry.email).eq("isUsed", false)
          )
          .first();

        if (existingEntry) {
          results.failed.push({
            email: entry.email,
            reason: "Already authorized",
          });
          continue;
        }

        // Create entry
        await ctx.db.insert("accessList", {
          email: entry.email,
          role: entry.role,
          programId: entry.programId,
          studentCode: entry.studentCode,
          createdBy: admin._id,
          createdAt: Date.now(),
          expiresAt,
          isUsed: false,
        });

        results.successful.push(entry.email);
      } catch (error) {
        results.failed.push({
          email: entry.email,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

/**
 * Revoke an access list entry (Admin only)
 */
export const revokeAccessListEntry = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const entry = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => 
        q.eq("email", args.email).eq("isUsed", false)
      )
      .first();

    if (!entry) {
      throw new AppError(
        "No pending authorization found for this email",
        ErrorCodes.USER_NOT_FOUND
      );
    }

    await ctx.db.delete(entry._id);

    return { 
      success: true, 
      message: `Authorization revoked for ${args.email}` 
    };
  },
});

/**
 * Get all pending access list entries (Admin only)
 */
export const getPendingAccessList = query({
  args: {
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    let entries = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => q.eq("isUsed", false))
      .collect();

    // Filter out expired if requested
    if (!args.includeExpired) {
      const now = Date.now();
      entries = entries.filter(e => !e.expiresAt || e.expiresAt > now);
    }

    // Enrich with creator info and program info
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const [creator, program] = await Promise.all([
          ctx.db.get(entry.createdBy),
          entry.programId ? ctx.db.get(entry.programId) : null,
        ]);

        return {
          ...entry,
          creatorName: creator?.name || "Unknown",
          programName: program?.name || null,
          isExpired: entry.expiresAt ? entry.expiresAt < Date.now() : false,
        };
      })
    );

    return enrichedEntries;
  },
});

// ============================================================================
// INTERNAL MUTATIONS (for system use only)
// ============================================================================

/**
 * Internal: Clean up expired access list entries
 */
export const _cleanupExpiredAccessEntries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expiredEntries = await ctx.db
      .query("accessList")
      .withIndex("by_email_unused", (q) => q.eq("isUsed", false))
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    let deletedCount = 0;
    for (const entry of expiredEntries) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return { 
      deletedCount, 
      message: `Cleaned up ${deletedCount} expired entries` 
    };
  },
});