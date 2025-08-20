// ################################################################################
// # File: courses.ts                                                             #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/19/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Course management functions for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
    type CourseWithPrerequisites,
    type PendingCourses,
} from "./types";
import {
    requireAuth,
    requireRole,
    isCourseCodeTaken,
    hasCompletedPrerequisites,
    calculatePendingCourses,
} from "./helpers";

// ============================================================================
// COURSE QUERIES
// ============================================================================

/**
 * Get courses by program
 */
export const getCoursesByProgram = query({
    args: {
        programId: v.id("programs"),
        groupByCategory: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const courses = await ctx.db
            .query("courses")
            .withIndex("by_program_active", q =>
                q.eq("programId", args.programId).eq("isActive", true)
            )
            .collect();

        if (args.groupByCategory) {
            return {
                humanities: courses.filter(c => c.category === "humanities"),
                core: courses.filter(c => c.category === "core"),
                elective: courses.filter(c => c.category === "elective"),
                general: courses.filter(c => c.category === "general"),
            };
        }

        return courses;
    },
});

/**
 * Get course by ID with prerequisites
 */
export const getCourseById = query({
    args: {
        courseId: v.id("courses"),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError("Course not found", ErrorCodes.COURSE_NOT_FOUND);
        }

        // Get prerequisite course details
        const prerequisites = [];
        for (const prereqCode of course.prerequisites) {
            const prereqCourse = await ctx.db
                .query("courses")
                .withIndex("by_code", q => q.eq("code", prereqCode))
                .first();

            if (prereqCourse) {
                prerequisites.push(prereqCourse);
            }
        }

        return {
            course,
            prerequisites,
        };
    },
});

/**
 * Get pending courses for pensum faltante
 */
export const getPendingCourses = query({
    args: {
        studentId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only see their own pending courses, admins/professors can see any
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Not authorized to view pending courses for this student",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const pendingCourses = await calculatePendingCourses(ctx, args.studentId);
        if (!pendingCourses) {
            throw new AppError("Student not found", ErrorCodes.USER_NOT_FOUND);
        }

        return pendingCourses;
    },
});

// ============================================================================
// COURSE MUTATIONS (Admin only)
// ============================================================================

/**
 * Create course with validation
 */
export const createCourse = mutation({
    args: {
        code: v.string(),
        name: v.string(),
        description: v.string(),
        credits: v.number(),
        programId: v.id("programs"),
        category: v.union(
            v.literal("humanities"),
            v.literal("core"),
            v.literal("elective"),
            v.literal("general")
        ),
        prerequisites: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate course code uniqueness
        if (await isCourseCodeTaken(ctx, args.code)) {
            throw new AppError(
                `Course code '${args.code}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Validate credits
        if (args.credits <= 0) {
            throw new AppError(
                "Credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Verify program exists
        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError("Program not found", ErrorCodes.PROGRAM_NOT_FOUND);
        }

        // Verify prerequisite courses exist
        for (const prereqCode of args.prerequisites) {
            const prereq = await ctx.db
                .query("courses")
                .withIndex("by_code", q => q.eq("code", prereqCode))
                .first();

            if (!prereq) {
                throw new AppError(
                    `Prerequisite course '${prereqCode}' not found`,
                    ErrorCodes.COURSE_NOT_FOUND
                );
            }
        }

        const courseId = await ctx.db.insert("courses", {
            ...args,
            isActive: true,
        });

        return {
            courseId,
            success: true,
            message: `Course '${args.name}' created successfully`,
        };
    },
});
