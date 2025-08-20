import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  userRoleValidator,
  ErrorCodes,
  AppError,
} from "./types";
import {
  getCurrentUserFromAuth,
  // requireAuth,
  requireRole,
  checkEmailAuthorization,
  getUserTemplate,
  deleteUserTemplate,
  isEmailRegistered,
  isStudentCodeTaken,
  isEmployeeCodeTaken,
  calculateStudentProgress,
} from "./helpers";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get current authenticated user with basic program data if student
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserFromAuth(ctx);
    if (!user) return null;

    // Enrich with program data if student
    if (user.role === "student" && user.studentProfile) {
      const [program, progress] = await Promise.all([
        ctx.db.get(user.studentProfile.programId),
        calculateStudentProgress(ctx, user._id)
      ]);

      return {
        ...user,
        program,
        progress: progress || undefined, // Basic progress for UI
      };
    }

    return user;
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Register a new user from Clerk authentication
 * Simple registration using accessList and userTemplates
 */
export const registerUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      return { userId: existingUser._id, isNewUser: false };
    }

    // Check email authorization
    const accessEntry = await checkEmailAuthorization(ctx, args.email);
    if (!accessEntry) {
      throw new AppError(
        "Email not authorized for registration. Contact administrator.",
        ErrorCodes.UNAUTHORIZED
      );
    }

    // Get template data
    const template = await getUserTemplate(ctx, args.email);

    // Build base user data
    const userData: any = {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      phone: args.phone,
      country: args.country,
      role: accessEntry.role,
      isActive: true,
      createdBy: accessEntry.createdBy,
      createdAt: Date.now(),
    };

    // Add role-specific profile
    if (accessEntry.role === "student") {
      if (!template?.studentCode || !template?.programId) {
        throw new AppError(
          "Student template data incomplete",
          ErrorCodes.INVALID_INPUT
        );
      }

      // Validate student code uniqueness
      if (await isStudentCodeTaken(ctx, template.studentCode)) {
        throw new AppError(
          "Student code already exists",
          ErrorCodes.DUPLICATE_ENTRY
        );
      }

      userData.studentProfile = {
        studentCode: template.studentCode,
        programId: template.programId,
        enrollmentDate: Date.now(),
        status: "active" as const,
      };
    } else if (accessEntry.role === "professor") {
      if (!template?.employeeCode) {
        throw new AppError(
          "Professor template data incomplete",
          ErrorCodes.INVALID_INPUT
        );
      }

      // Validate employee code uniqueness
      if (await isEmployeeCodeTaken(ctx, template.employeeCode)) {
        throw new AppError(
          "Employee code already exists",
          ErrorCodes.DUPLICATE_ENTRY
        );
      }

      userData.professorProfile = {
        employeeCode: template.employeeCode,
        title: template.title,
      };
    }

    // Create user
    const userId = await ctx.db.insert("users", userData);

    // Mark access entry as used
    await ctx.db.patch(accessEntry._id, {
      isUsed: true,
      usedAt: Date.now(),
      usedBy: userId,
    });

    // Clean up template
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
 * Pre-register a student (Admin only)
 */
export const preRegisterStudent = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    studentCode: v.string(),
    programId: v.id("programs"),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new AppError("Invalid email format", ErrorCodes.INVALID_INPUT);
    }

    // Check duplicates
    if (await isEmailRegistered(ctx, args.email)) {
      throw new AppError("Email already registered", ErrorCodes.DUPLICATE_ENTRY);
    }

    if (await isStudentCodeTaken(ctx, args.studentCode)) {
      throw new AppError("Student code already exists", ErrorCodes.DUPLICATE_ENTRY);
    }

    // Create access list entry
    await ctx.db.insert("accessList", {
      email: args.email,
      role: "student" as const,
      createdBy: admin._id,
      createdAt: Date.now(),
      isUsed: false,
    });

    // Create user template
    await ctx.db.insert("userTemplates", {
      email: args.email,
      name: args.name,
      phone: args.phone,
      country: args.country,
      studentCode: args.studentCode,
      programId: args.programId,
      createdBy: admin._id,
      createdAt: Date.now(),
    });

    return {
      success: true,
      message: `Student ${args.name} pre-registered successfully`
    };
  },
});

/**
 * Pre-register a professor (Admin only)
 */
export const preRegisterProfessor = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    employeeCode: v.string(),
    title: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new AppError("Invalid email format", ErrorCodes.INVALID_INPUT);
    }

    // Check duplicates
    if (await isEmailRegistered(ctx, args.email)) {
      throw new AppError("Email already registered", ErrorCodes.DUPLICATE_ENTRY);
    }

    if (await isEmployeeCodeTaken(ctx, args.employeeCode)) {
      throw new AppError("Employee code already exists", ErrorCodes.DUPLICATE_ENTRY);
    }

    // Create access list entry
    await ctx.db.insert("accessList", {
      email: args.email,
      role: "professor" as const,
      createdBy: admin._id,
      createdAt: Date.now(),
      isUsed: false,
    });

    // Create user template
    await ctx.db.insert("userTemplates", {
      email: args.email,
      name: args.name,
      phone: args.phone,
      country: args.country,
      employeeCode: args.employeeCode,
      title: args.title,
      createdBy: admin._id,
      createdAt: Date.now(),
    });

    return {
      success: true,
      message: `Professor ${args.name} pre-registered successfully`
    };
  },
});