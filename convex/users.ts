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
    calculateGPA,
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
            // TODO: Add validation for duplicate student codes
            updates.studentProfile = {
                ...user.studentProfile!,
                studentCode: args.updates.studentCode,
            };
        }

        // Professor-specific updates
        if (user.role === "professor") {
            if (args.updates.employeeCode) {
                // TODO: Add validation for duplicate employee codes
                updates.professorProfile = {
                    ...user.professorProfile!,
                    employeeCode: args.updates.employeeCode,
                    ...(args.updates.title !== undefined && { title: args.updates.title }),
                };
            } else if (args.updates.title !== undefined) {
                updates.professorProfile = {
                    ...user.professorProfile!,
                    title: args.updates.title,
                };
            }
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
 * Get current user profile - Complete account information
 */
export const getCurrentUserProfile = query({
    args: {},
    handler: async (ctx) => {
        const currentUser = await requireAuth(ctx);

        let roleSpecificData = null;

        if (currentUser.role === "student" && currentUser.studentProfile) {
            const program = await ctx.db.get(currentUser.studentProfile.programId);

            // Get recent academic performance
            const recentEnrollments = await ctx.db
                .query("enrollments")
                .filter(q => q.and(
                    q.eq(q.field("studentId"), currentUser._id),
                    q.eq(q.field("status"), "completed")
                ))
                .order("desc")
                .take(5);

            const gpa = await calculateGPA(ctx, currentUser._id);

            roleSpecificData = {
                program: program ? {
                    name: program.nameEs,
                    code: program.code,
                    type: program.type,
                } : null,
                recentGrades: recentEnrollments.map(e => ({
                    percentageGrade: e.percentageGrade,
                    letterGrade: e.letterGrade,
                })),
                currentGPA: gpa,
            };

        } else if (currentUser.role === "professor" && currentUser.professorProfile) {
            // Get current teaching load
            const currentPeriod = await ctx.db
                .query("periods")
                .filter(q => q.eq(q.field("isCurrentPeriod"), true))
                .first();

            let currentSections = 0;
            if (currentPeriod) {
                const sections = await ctx.db
                    .query("sections")
                    .filter(q => q.and(
                        q.eq(q.field("professorId"), currentUser._id),
                        q.eq(q.field("periodId"), currentPeriod._id),
                        q.eq(q.field("isActive"), true)
                    ))
                    .collect();
                currentSections = sections.length;
            }

            roleSpecificData = {
                currentTeachingLoad: currentSections,
                currentPeriod: currentPeriod?.name,
            };
        }

        return {
            user: {
                _id: currentUser._id,
                email: currentUser.email,
                name: currentUser.name,
                role: currentUser.role,
                isActive: currentUser.isActive,
                createdAt: currentUser.createdAt,
                lastLoginAt: currentUser.lastLoginAt,
                phone: currentUser.phone,
                country: currentUser.country,
                studentProfile: currentUser.studentProfile,
                professorProfile: currentUser.professorProfile,
            },
            roleSpecificData,
        };
    },
});
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
