// ################################################################################
// # File: users.ts                                                               #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * User management functions - profiles, privacy settings, and user operations
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
    userRoleValidator,
    studentStatusValidator,
    ErrorCodes,
    AppError,
    type StudentSearchFilters,
} from "./types";
import {
    getCurrentUserFromAuth,
    requireAuth,
    requireRole,
    requireAdminOrSelf,
    canViewProfile,
    canViewGrades,
    isStudentCodeTaken,
    isEmployeeCodeTaken,
} from "./helpers";

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

/**
 * Get user by ID with proper authorization
 */
export const getUserById = query({
    args: {
        userId: v.id("users")
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Check if user can view this profile
        if (!(await canViewProfile(ctx, currentUser._id, args.userId))) {
            throw new AppError(
                "Not authorized to view this profile",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError(
                "User not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Enrich with program data if student
        if (user.role === "student" && user.studentProfile) {
            const program = await ctx.db.get(user.studentProfile.programId);
            return {
                ...user,
                program
            };
        }

        return user;
    },
});

/**
 * Update user profile with proper validation and authorization
 */
export const updateUserProfile = mutation({
    args: {
        userId: v.id("users"),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        country: v.optional(v.string()),
        city: v.optional(v.string()),
        studentProfile: v.optional(v.object({
            studentCode: v.string(),
            programId: v.id("programs"),
            enrollmentYear: v.number(),
            status: studentStatusValidator,
            showProfile: v.boolean(),
            showCourses: v.boolean(),
            showGrades: v.boolean(),
        })),
        professorProfile: v.optional(v.object({
            employeeCode: v.string(),
            department: v.string(),
            title: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAdminOrSelf(ctx, args.userId);

        const { userId, ...updates } = args;

        // Validate student code if being updated
        if (updates.studentProfile?.studentCode) {
            if (await isStudentCodeTaken(ctx, updates.studentProfile.studentCode, userId)) {
                throw new AppError(
                    "Student code already exists",
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }
        }

        // Validate employee code if being updated
        if (updates.professorProfile?.employeeCode) {
            if (await isEmployeeCodeTaken(ctx, updates.professorProfile.employeeCode, userId)) {
                throw new AppError(
                    "Employee code already exists",
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }
        }

        await ctx.db.patch(userId, updates);
        return userId;
    },
});

/**
 * Update privacy settings (students only)
 */
export const updatePrivacySettings = mutation({
    args: {
        showProfile: v.boolean(),
        showCourses: v.boolean(),
        showGrades: v.boolean(),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        if (currentUser.role !== "student" || !currentUser.studentProfile) {
            throw new AppError(
                "Only students can update privacy settings",
                ErrorCodes.UNAUTHORIZED
            );
        }

        await ctx.db.patch(currentUser._id, {
            studentProfile: {
                ...currentUser.studentProfile,
                ...args,
            },
        });

        return { success: true };
    },
});

// ============================================================================
// USER SEARCH AND LISTING
// ============================================================================

/**
 * List students with filters and search
 */
export const listStudents = query({
    args: {
        programId: v.optional(v.id("programs")),
        status: v.optional(studentStatusValidator),
        enrollmentYear: v.optional(v.number()),
        searchTerm: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Only admins and professors can list all students
        if (currentUser.role === "student") {
            throw new AppError(
                "Students cannot list other students",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let students = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "student").eq("isActive", true)
            )
            .collect();

        // Apply filters
        if (args.programId) {
            students = students.filter(s =>
                s.studentProfile?.programId === args.programId
            );
        }

        if (args.status) {
            students = students.filter(s =>
                s.studentProfile?.status === args.status
            );
        }

        if (args.enrollmentYear) {
            students = students.filter(s =>
                s.studentProfile?.enrollmentYear === args.enrollmentYear
            );
        }

        if (args.searchTerm) {
            const term = args.searchTerm.toLowerCase();
            students = students.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.email.toLowerCase().includes(term) ||
                s.studentProfile?.studentCode?.toLowerCase().includes(term)
            );
        }

        // Apply limit
        if (args.limit) {
            students = students.slice(0, args.limit);
        }

        // Enrich with program data
        const enrichedStudents = await Promise.all(
            students.map(async (student) => {
                if (student.studentProfile) {
                    const program = await ctx.db.get(student.studentProfile.programId);
                    return { ...student, program };
                }
                return student;
            })
        );

        return enrichedStudents;
    },
});

/**
 * List students by program (for professors teaching in that program)
 */
export const listStudentsByProgram = query({
    args: {
        programId: v.id("programs"),
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Check authorization
        if (currentUser.role !== "admin" && currentUser.role !== "professor") {
            throw new AppError(
                "Not authorized to view program students",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let query = ctx.db.query("users").withIndex("by_role_active", (q) =>
            q.eq("role", "student")
        );

        if (!args.includeInactive) {
            query = query.filter((q) => q.eq(q.field("isActive"), true));
        }

        const students = await query
            .filter((q) =>
                q.eq(q.field("studentProfile.programId"), args.programId)
            )
            .collect();

        // Enrich with program data
        const program = await ctx.db.get(args.programId);

        return students.map(student => ({
            ...student,
            program,
        }));
    },
});

/**
 * List professors with basic info
 */
export const listProfessors = query({
    args: {
        department: v.optional(v.string()),
        searchTerm: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        let professors = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "professor").eq("isActive", true)
            )
            .collect();

        // Apply filters
        if (args.department) {
            professors = professors.filter(p =>
                p.professorProfile?.department === args.department
            );
        }

        if (args.searchTerm) {
            const term = args.searchTerm.toLowerCase();
            professors = professors.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.email.toLowerCase().includes(term) ||
                p.professorProfile?.employeeCode?.toLowerCase().includes(term)
            );
        }

        return professors;
    },
});

// ============================================================================
// USER STATUS MANAGEMENT
// ============================================================================

/**
 * Activate/deactivate user (Admin only)
 */
export const updateUserStatus = mutation({
    args: {
        userId: v.id("users"),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError(
                "User not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        await ctx.db.patch(args.userId, {
            isActive: args.isActive,
        });

        return {
            success: true,
            message: `User ${args.isActive ? 'activated' : 'deactivated'} successfully`
        };
    },
});

/**
 * Update student status (Admin only)
 */
export const updateStudentStatus = mutation({
    args: {
        userId: v.id("users"),
        status: studentStatusValidator,
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const user = await ctx.db.get(args.userId);
        if (!user || user.role !== "student" || !user.studentProfile) {
            throw new AppError(
                "Student not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        await ctx.db.patch(args.userId, {
            studentProfile: {
                ...user.studentProfile,
                status: args.status,
            },
        });

        return {
            success: true,
            message: `Student status updated to ${args.status}`
        };
    },
});

// ============================================================================
// USER ANALYTICS
// ============================================================================

/**
 * Get user statistics (Admin only)
 */
export const getUserStatistics = query({
    args: {},
    handler: async (ctx) => {
        await requireRole(ctx, "admin");

        const [totalUsers, activeUsers, students, professors, admins] = await Promise.all([
            ctx.db.query("users").collect(),
            ctx.db.query("users").filter(q => q.eq(q.field("isActive"), true)).collect(),
            ctx.db.query("users").withIndex("by_role_active", q =>
                q.eq("role", "student").eq("isActive", true)
            ).collect(),
            ctx.db.query("users").withIndex("by_role_active", q =>
                q.eq("role", "professor").eq("isActive", true)
            ).collect(),
            ctx.db.query("users").withIndex("by_role_active", q =>
                q.eq("role", "admin").eq("isActive", true)
            ).collect(),
        ]);

        return {
            total: totalUsers.length,
            active: activeUsers.length,
            inactive: totalUsers.length - activeUsers.length,
            students: students.length,
            professors: professors.length,
            admins: admins.length,
            registrationsByMonth: await getRegistrationsByMonth(ctx),
        };
    },
});

/**
 * Helper: Get registrations by month for the last 12 months
 */
async function getRegistrationsByMonth(ctx: any) {
    const users = await ctx.db.query("users").collect() as Doc<"users">[];
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

        const count = users.filter((u: Doc<"users">) =>
            u.createdAt >= date.getTime() &&
            u.createdAt < nextMonth.getTime()
        ).length;

        months.push({
            month: date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
            count,
        });
    }

    return months;
}
