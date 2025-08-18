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
  requireRole,
  checkEmailAuthorization,
  getUserTemplate,
  deleteUserTemplate,
  isEmailRegistered,
  isStudentCodeTaken,
  isEmployeeCodeTaken
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
export const checkRegistrationAuthorization = query({
  args: {
    email: v.string()
  },
  handler: async (ctx, args) => {
    const accessEntry = await checkEmailAuthorization(ctx, args.email);

    if (!accessEntry) {
      return {
        authorized: false,
        message: "Email not authorized for registration"
      };
    }

    // Get template data if available
    const template = await getUserTemplate(ctx, args.email);

    return {
      authorized: true,
      role: accessEntry.role,
      hasTemplate: template !== null,
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
    if (await isEmailRegistered(ctx, args.email)) {
      throw new AppError(
        "Email already registered in the system",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check authorization using helper
    const accessEntry = await checkEmailAuthorization(ctx, args.email);
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

    // Get template data using helper
    const template = await getUserTemplate(ctx, args.email);

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

    // Add role-specific profile using template data
    if (accessEntry.role === "student") {
      // Use template data if available, otherwise generate defaults
      const studentCode = template?.studentCode || `STU${Date.now()}`;
      const programId = template?.programId;

      if (!programId) {
        throw new AppError(
          "Program ID is required for student registration",
          ErrorCodes.INVALID_INPUT
        );
      }

      // Check if student code is already taken
      if (await isStudentCodeTaken(ctx, studentCode)) {
        throw new AppError(
          "Student code already exists",
          ErrorCodes.DUPLICATE_ENTRY
        );
      }

      userData.studentProfile = {
        studentCode,
        programId,
        enrollmentYear: new Date().getFullYear(),
        status: "active" as const,
        // Default privacy settings
        showProfile: true,
        showCourses: true,
        showGrades: false,
      };
    } else if (accessEntry.role === "professor") {
      // Use template data if available
      const employeeCode = template?.employeeCode || `PROF${Date.now()}`;

      // Check if employee code is already taken
      if (await isEmployeeCodeTaken(ctx, employeeCode)) {
        throw new AppError(
          "Employee code already exists",
          ErrorCodes.DUPLICATE_ENTRY
        );
      }

      userData.professorProfile = {
        employeeCode,
        department: template?.department || "",
        title: template?.title,
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

    // Clean up template data using helper
    if (template) {
      await deleteUserTemplate(ctx, args.email);
    }

    return {
      userId,
      isNewUser: true,
      role: accessEntry.role
    };
  },
});

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/**
 * Pre-register a student with complete data (Admin only)
 */
export const preRegisterStudent = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    studentCode: v.string(),
    programId: v.id("programs"),
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
    if (await isEmailRegistered(ctx, args.email)) {
      throw new AppError(
        "Email already registered as a user",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check if email already has authorization
    const existingAuth = await checkEmailAuthorization(ctx, args.email);
    if (existingAuth) {
      throw new AppError(
        "Email already has a pending authorization",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check if student code is already taken
    if (await isStudentCodeTaken(ctx, args.studentCode)) {
      throw new AppError(
        "Student code already exists",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Calculate expiration
    const expiresAt = args.expiresInDays
      ? Date.now() + (args.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create access list entry
    const entryId = await ctx.db.insert("accessList", {
      email: args.email,
      role: "student" as const,
      createdBy: admin._id,
      createdAt: Date.now(),
      expiresAt,
      isUsed: false,
    });

    // Create user template with complete data
    await ctx.db.insert("userTemplates", {
      email: args.email,
      name: args.name,
      studentCode: args.studentCode,
      programId: args.programId,
      createdBy: admin._id,
      createdAt: Date.now(),
    });

    return {
      success: true,
      entryId,
      message: `Student ${args.name} pre-registered successfully`
    };
  },
});

/**
 * Add a simple email authorization (for professor or admin roles)
 */
export const addEmailAuthorization = mutation({
  args: {
    email: v.string(),
    role: userRoleValidator,
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
    if (await isEmailRegistered(ctx, args.email)) {
      throw new AppError(
        "Email already registered as a user",
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Check if email already has authorization
    const existingAuth = await checkEmailAuthorization(ctx, args.email);
    if (existingAuth) {
      throw new AppError(
        "Email already has a pending authorization",
        ErrorCodes.DUPLICATE_ENTRY
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
 * Revoke an access list entry (Admin only)
 */
export const revokeAccessListEntry = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const entry = await checkEmailAuthorization(ctx, args.email);

    if (!entry) {
      throw new AppError(
        "No pending authorization found for this email",
        ErrorCodes.USER_NOT_FOUND
      );
    }

    // Delete access list entry
    await ctx.db.delete(entry._id);

    // Also delete any associated template
    const template = await getUserTemplate(ctx, args.email);
    if (template) {
      await deleteUserTemplate(ctx, args.email);
    }

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

    // Get all unused entries by filtering
    let entries = await ctx.db
      .query("accessList")
      .filter((q) => q.eq(q.field("isUsed"), false))
      .collect();

    // Filter out expired if requested
    if (!args.includeExpired) {
      const now = Date.now();
      entries = entries.filter(e => !e.expiresAt || e.expiresAt > now);
    }

    // Enrich with creator info and template data
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const [creator, template] = await Promise.all([
          ctx.db.get(entry.createdBy),
          getUserTemplate(ctx, entry.email),
        ]);

        return {
          ...entry,
          creatorName: creator?.name || "Unknown",
          hasTemplate: template !== null,
          templateData: template ? {
            name: template.name,
            studentCode: template.studentCode,
            programId: template.programId,
            employeeCode: template.employeeCode,
            department: template.department,
          } : null,
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
      .filter((q) =>
        q.and(
          q.eq(q.field("isUsed"), false),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .collect();

    let deletedCount = 0;
    for (const entry of expiredEntries) {
      // Also clean up any associated templates
      const template = await getUserTemplate(ctx, entry.email);
      if (template) {
        await deleteUserTemplate(ctx, entry.email);
      }

      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return {
      deletedCount,
      message: `Cleaned up ${deletedCount} expired entries`
    };
  },
});