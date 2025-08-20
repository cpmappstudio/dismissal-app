// ################################################################################
// # File: users.ts                                                               #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/19/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * User management functions for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
    type StudentSearchFilters,
} from "./types";
import {
    requireAuth,
    requireRole,
    requireAdminOrSelf,
    isStudentCodeTaken,
    isEmployeeCodeTaken,
} from "./helpers";

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Get user by ID
 */
export const getUserById = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError("User not found", ErrorCodes.USER_NOT_FOUND);
        }

        // If student, include program details
        if (user.role === "student" && user.studentProfile) {
            const program = await ctx.db.get(user.studentProfile.programId);
            return {
                user,
                program,
            };
        }

        return { user, program: null };
    },
});

/**
 * List students with filters (Professor/Admin)
 */
export const listStudents = query({
    args: {
        programId: v.optional(v.id("programs")),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("graduated")
        )),
        searchTerm: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Only professors and admins can list students
        if (currentUser.role === "student") {
            throw new AppError(
                "Not authorized to list students",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let students = await ctx.db
            .query("users")
            .withIndex("by_role_active", q => q.eq("role", "student"))
            .collect();

        // Filter by program
        if (args.programId) {
            students = students.filter(s =>
                s.studentProfile?.programId === args.programId
            );
        }

        // Filter by status
        if (args.status) {
            students = students.filter(s =>
                s.studentProfile?.status === args.status
            );
        }

        // Filter by search term (name, email, student code)
        if (args.searchTerm) {
            const term = args.searchTerm.toLowerCase();
            students = students.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.email.toLowerCase().includes(term) ||
                (s.studentProfile?.studentCode && s.studentProfile.studentCode.toLowerCase().includes(term))
            );
        }

        // Enrich with program details
        const studentsWithPrograms = await Promise.all(
            students.map(async (student) => {
                const program = student.studentProfile
                    ? await ctx.db.get(student.studentProfile.programId)
                    : null;

                return {
                    user: student,
                    program,
                };
            })
        );

        return studentsWithPrograms;
    },
});

/**
 * List professors
 */
export const listProfessors = query({
    args: {},
    handler: async (ctx) => {
        await requireAuth(ctx);

        const professors = await ctx.db
            .query("users")
            .withIndex("by_role_active", q =>
                q.eq("role", "professor").eq("isActive", true)
            )
            .collect();

        return professors;
    },
});

// ============================================================================
// USER MUTATIONS
// ============================================================================

/**
 * Update user profile
 */
export const updateUserProfile = mutation({
    args: {
        userId: v.id("users"),
        updates: v.object({
            name: v.optional(v.string()),
            phone: v.optional(v.string()),
            country: v.optional(v.string()),
            // Student-specific updates
            studentCode: v.optional(v.string()),
            // Professor-specific updates
            employeeCode: v.optional(v.string()),
            title: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        // Only admin or the user themselves can update profile
        await requireAdminOrSelf(ctx, args.userId);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError("User not found", ErrorCodes.USER_NOT_FOUND);
        }

        const updates: any = {};

        // Basic updates
        if (args.updates.name) updates.name = args.updates.name;
        if (args.updates.phone !== undefined) updates.phone = args.updates.phone;
        if (args.updates.country !== undefined) updates.country = args.updates.country;

        // Student-specific updates
        if (user.role === "student" && args.updates.studentCode) {
            if (await isStudentCodeTaken(ctx, args.updates.studentCode, args.userId)) {
                throw new AppError(
                    "Student code already in use",
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }

            updates.studentProfile = {
                ...user.studentProfile!,
                studentCode: args.updates.studentCode,
            };
        }

        // Professor-specific updates
        if (user.role === "professor") {
            if (args.updates.employeeCode &&
                await isEmployeeCodeTaken(ctx, args.updates.employeeCode, args.userId)) {
                throw new AppError(
                    "Employee code already in use",
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }

            updates.professorProfile = {
                ...user.professorProfile!,
                ...(args.updates.employeeCode && { employeeCode: args.updates.employeeCode }),
                ...(args.updates.title !== undefined && { title: args.updates.title }),
            };
        }

        await ctx.db.patch(args.userId, updates);

        return {
            success: true,
            message: "Profile updated successfully",
        };
    },
});

/**
 * Activate user (Admin only)
 */
export const activateUser = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError("User not found", ErrorCodes.USER_NOT_FOUND);
        }

        await ctx.db.patch(args.userId, {
            isActive: true,
        });

        // If student, also update status to active
        if (user.role === "student" && user.studentProfile) {
            await ctx.db.patch(args.userId, {
                studentProfile: {
                    ...user.studentProfile,
                    status: "active" as const,
                },
            });
        }

        return {
            success: true,
            message: `User ${user.name} activated successfully`,
        };
    },
});

/**
 * Deactivate user (Admin only)
 */
export const deactivateUser = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError("User not found", ErrorCodes.USER_NOT_FOUND);
        }

        await ctx.db.patch(args.userId, {
            isActive: false,
        });

        // If student, also update status to inactive
        if (user.role === "student" && user.studentProfile) {
            await ctx.db.patch(args.userId, {
                studentProfile: {
                    ...user.studentProfile,
                    status: "inactive" as const,
                },
            });
        }

        return {
            success: true,
            message: `User ${user.name} deactivated successfully`,
        };
    },
});
