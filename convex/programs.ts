// ################################################################################
// # File: programs.ts                                                            #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Academic program management functions
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
    programTypeValidator,
    ErrorCodes,
    AppError,
    type ProgramStatistics,
} from "./types";
import {
    requireAuth,
    requireRole,
    isProgramCodeTaken,
    calculateGPA,
} from "./helpers";

// ============================================================================
// PROGRAM QUERIES
// ============================================================================

/**
 * Get all active programs
 */
export const getPrograms = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("programs")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();
    },
});

/**
 * Get program by ID with enriched data
 */
export const getProgramById = query({
    args: {
        programId: v.id("programs")
    },
    handler: async (ctx, args) => {
        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Get student count and other statistics
        const students = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "student").eq("isActive", true)
            )
            .filter((q) =>
                q.eq(q.field("studentProfile.programId"), args.programId)
            )
            .collect();

        // Get courses in this program
        const courses = await ctx.db
            .query("courses")
            .withIndex("by_program_active", (q) =>
                q.eq("programId", args.programId).eq("isActive", true)
            )
            .collect();

        return {
            ...program,
            studentCount: students.length,
            courseCount: courses.length,
            students: students.map(s => ({
                _id: s._id,
                name: s.name,
                email: s.email,
                studentCode: s.studentProfile?.studentCode,
                enrollmentYear: s.studentProfile?.enrollmentYear,
                status: s.studentProfile?.status,
            })),
        };
    },
});

/**
 * Get programs with statistics (Admin only)
 */
export const getProgramsWithStatistics = query({
    args: {},
    handler: async (ctx) => {
        await requireRole(ctx, "admin");

        const programs = await ctx.db
            .query("programs")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();

        const enrichedPrograms = await Promise.all(
            programs.map(async (program) => {
                const students = await ctx.db
                    .query("users")
                    .withIndex("by_role_active", (q) =>
                        q.eq("role", "student").eq("isActive", true)
                    )
                    .filter((q) =>
                        q.eq(q.field("studentProfile.programId"), program._id)
                    )
                    .collect();

                const courses = await ctx.db
                    .query("courses")
                    .withIndex("by_program_active", (q) =>
                        q.eq("programId", program._id).eq("isActive", true)
                    )
                    .collect();

                // Calculate statistics
                const activeStudents = students.filter(s =>
                    s.studentProfile?.status === "active"
                );
                const graduatedStudents = students.filter(s =>
                    s.studentProfile?.status === "graduated"
                );

                return {
                    ...program,
                    statistics: {
                        totalStudents: students.length,
                        activeStudents: activeStudents.length,
                        graduatedStudents: graduatedStudents.length,
                        totalCourses: courses.length,
                        completionRate: students.length > 0
                            ? (graduatedStudents.length / students.length) * 100
                            : 0,
                    },
                };
            })
        );

        return enrichedPrograms;
    },
});

// ============================================================================
// PROGRAM MUTATIONS
// ============================================================================

/**
 * Create new program with validation
 */
export const createProgram = mutation({
    args: {
        code: v.string(),
        name: v.string(),
        type: programTypeValidator,
        department: v.string(),
        totalCredits: v.number(),
        durationSemesters: v.number(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate input
        if (args.totalCredits <= 0) {
            throw new AppError(
                "Total credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (args.durationSemesters <= 0) {
            throw new AppError(
                "Duration semesters must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if code already exists
        if (await isProgramCodeTaken(ctx, args.code)) {
            throw new AppError(
                `Program code '${args.code}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        const programId = await ctx.db.insert("programs", {
            code: args.code,
            name: args.name,
            type: args.type,
            department: args.department,
            totalCredits: args.totalCredits,
            durationSemesters: args.durationSemesters,
            isActive: true,
        });

        return {
            programId,
            message: `Program '${args.name}' created successfully`
        };
    },
});

/**
 * Update program (Admin only)
 */
export const updateProgram = mutation({
    args: {
        programId: v.id("programs"),
        code: v.optional(v.string()),
        name: v.optional(v.string()),
        type: v.optional(programTypeValidator),
        department: v.optional(v.string()),
        totalCredits: v.optional(v.number()),
        durationSemesters: v.optional(v.number()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const { programId, ...updates } = args;

        const program = await ctx.db.get(programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Validate updates
        if (updates.totalCredits && updates.totalCredits <= 0) {
            throw new AppError(
                "Total credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (updates.durationSemesters && updates.durationSemesters <= 0) {
            throw new AppError(
                "Duration semesters must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if code is being changed and already exists
        if (updates.code && updates.code !== program.code) {
            if (await isProgramCodeTaken(ctx, updates.code, programId)) {
                throw new AppError(
                    `Program code '${updates.code}' already exists`,
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }
        }

        await ctx.db.patch(programId, updates);

        return {
            success: true,
            message: `Program '${program.name}' updated successfully`
        };
    },
});

/**
 * Archive program (soft delete - Admin only)
 */
export const archiveProgram = mutation({
    args: {
        programId: v.id("programs"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Check if there are active students in this program
        const activeStudents = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "student").eq("isActive", true)
            )
            .filter((q) =>
                q.eq(q.field("studentProfile.programId"), args.programId)
            )
            .collect();

        if (activeStudents.length > 0) {
            throw new AppError(
                `Cannot archive program with ${activeStudents.length} active students`,
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(args.programId, { isActive: false });

        return {
            success: true,
            message: `Program '${program.name}' archived successfully`
        };
    },
});

// ============================================================================
// PROGRAM STATISTICS
// ============================================================================

/**
 * Get detailed program statistics (Admin only)
 */
export const getProgramStatistics = query({
    args: {
        programId: v.id("programs")
    },
    handler: async (ctx, args): Promise<ProgramStatistics> => {
        await requireRole(ctx, "admin");

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        const students = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "student")
            )
            .filter((q) =>
                q.eq(q.field("studentProfile.programId"), args.programId)
            )
            .collect();

        const activeStudents = students.filter(s =>
            s.studentProfile?.status === "active"
        );
        const graduatedStudents = students.filter(s =>
            s.studentProfile?.status === "graduated"
        );

        // Calculate average GPA
        let totalGPA = 0;
        let studentsWithGPA = 0;

        for (const student of activeStudents) {
            const gpa = await calculateGPA(ctx, student._id);
            if (gpa > 0) {
                totalGPA += gpa;
                studentsWithGPA++;
            }
        }

        // Calculate average completion time
        const completedStudents = graduatedStudents.filter(s =>
            s.studentProfile?.enrollmentYear
        );

        let totalCompletionTime = 0;
        for (const student of completedStudents) {
            const enrollmentYear = student.studentProfile!.enrollmentYear!;
            const currentYear = new Date().getFullYear();
            const yearsToComplete = currentYear - enrollmentYear;
            const semestersToComplete = yearsToComplete * 2; // Approximate
            totalCompletionTime += semestersToComplete;
        }

        return {
            totalStudents: students.length,
            activeStudents: activeStudents.length,
            graduatedStudents: graduatedStudents.length,
            averageGPA: studentsWithGPA > 0 ? totalGPA / studentsWithGPA : 0,
            averageCompletionTime: completedStudents.length > 0
                ? totalCompletionTime / completedStudents.length
                : 0,
            completionRate: students.length > 0
                ? (graduatedStudents.length / students.length) * 100
                : 0,
        };
    },
});

/**
 * Get program enrollment trends (Admin only)
 */
export const getProgramEnrollmentTrends = query({
    args: {
        programId: v.id("programs"),
        yearsBack: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const years = args.yearsBack || 5;
        const currentYear = new Date().getFullYear();

        const students = await ctx.db
            .query("users")
            .withIndex("by_role_active", (q) =>
                q.eq("role", "student")
            )
            .filter((q) =>
                q.eq(q.field("studentProfile.programId"), args.programId)
            )
            .collect();

        const trends = [];

        for (let i = years - 1; i >= 0; i--) {
            const year = currentYear - i;
            const enrolledThisYear = students.filter(s =>
                s.studentProfile?.enrollmentYear === year
            );

            trends.push({
                year,
                enrolled: enrolledThisYear.length,
                active: enrolledThisYear.filter(s =>
                    s.studentProfile?.status === "active"
                ).length,
                graduated: enrolledThisYear.filter(s =>
                    s.studentProfile?.status === "graduated"
                ).length,
            });
        }

        return trends;
    },
});

// ============================================================================
// PROGRAM SEARCH AND FILTERING
// ============================================================================

/**
 * Search programs by various criteria
 */
export const searchPrograms = query({
    args: {
        searchTerm: v.optional(v.string()),
        type: v.optional(programTypeValidator),
        department: v.optional(v.string()),
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        let programs = await ctx.db
            .query("programs")
            .collect();

        // Filter by active status
        if (!args.includeInactive) {
            programs = programs.filter(p => p.isActive);
        }

        // Filter by type
        if (args.type) {
            programs = programs.filter(p => p.type === args.type);
        }

        // Filter by department
        if (args.department) {
            programs = programs.filter(p =>
                p.department.toLowerCase() === args.department!.toLowerCase()
            );
        }

        // Search by term
        if (args.searchTerm) {
            const term = args.searchTerm.toLowerCase();
            programs = programs.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term) ||
                p.department.toLowerCase().includes(term)
            );
        }

        return programs;
    },
});

/**
 * Get unique departments from all programs
 */
export const getProgramDepartments = query({
    args: {},
    handler: async (ctx) => {
        const programs = await ctx.db
            .query("programs")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();

        const departments = [...new Set(programs.map(p => p.department))];
        return departments.sort();
    },
});
