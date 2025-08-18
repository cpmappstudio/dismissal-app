// ################################################################################
// # File: courses.ts                                                             #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Course management functions
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    courseAreaValidator,
    ErrorCodes,
    AppError,
    type CourseWithPrerequisites,
    type CourseSearchFilters,
} from "./types";
import {
    requireAuth,
    requireRole,
    isCourseCodeTaken,
    hasCompletedPrerequisites,
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
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        let courses;

        if (args.includeInactive) {
            courses = await ctx.db
                .query("courses")
                .filter((q) => q.eq(q.field("programId"), args.programId))
                .collect();
        } else {
            courses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", args.programId).eq("isActive", true)
                )
                .collect();
        }

        return courses;
    },
});

/**
 * Get course by ID with enriched data
 */
export const getCourseById = query({
    args: {
        courseId: v.id("courses")
    },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Get program info
        const program = await ctx.db.get(course.programId);

        // Get prerequisite courses
        const prerequisites = [];
        if (course.prerequisites.length > 0) {
            const allCourses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", course.programId).eq("isActive", true)
                )
                .collect();

            for (const prereqCode of course.prerequisites) {
                const prereqCourse = allCourses.find(c => c.code === prereqCode);
                if (prereqCourse) {
                    prerequisites.push(prereqCourse);
                }
            }
        }

        return {
            ...course,
            program,
            prerequisiteCourses: prerequisites,
        };
    },
});

/**
 * Get course with prerequisites validation for a student
 */
export const getCourseWithPrerequisites = query({
    args: {
        courseId: v.id("courses"),
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args): Promise<CourseWithPrerequisites> => {
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Get prerequisite courses
        const prerequisites = [];
        let missingPrerequisites: string[] = [];

        if (course.prerequisites.length > 0) {
            const allCourses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", course.programId).eq("isActive", true)
                )
                .collect();

            for (const prereqCode of course.prerequisites) {
                const prereqCourse = allCourses.find(c => c.code === prereqCode);
                if (prereqCourse) {
                    prerequisites.push(prereqCourse);
                }
            }

            // Check if student has completed prerequisites
            if (args.studentId) {
                const prereqCheck = await hasCompletedPrerequisites(
                    ctx,
                    args.studentId,
                    args.courseId
                );
                missingPrerequisites = prereqCheck.missing;
            }
        }

        return {
            course,
            prerequisites,
            missingPrerequisites: args.studentId ? missingPrerequisites : undefined,
        };
    },
});

/**
 * Search courses with filters
 */
export const searchCourses = query({
    args: {
        programId: v.optional(v.id("programs")),
        area: v.optional(courseAreaValidator),
        searchTerm: v.optional(v.string()),
        minSemester: v.optional(v.number()),
        maxSemester: v.optional(v.number()),
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        let courses = await ctx.db.query("courses").collect();

        // Filter by active status
        if (!args.includeInactive) {
            courses = courses.filter(c => c.isActive);
        }

        // Filter by program
        if (args.programId) {
            courses = courses.filter(c => c.programId === args.programId);
        }

        // Filter by area
        if (args.area) {
            courses = courses.filter(c => c.area === args.area);
        }

        // Filter by semester range
        if (args.minSemester !== undefined) {
            courses = courses.filter(c => c.minSemester >= args.minSemester!);
        }
        if (args.maxSemester !== undefined) {
            courses = courses.filter(c => c.minSemester <= args.maxSemester!);
        }

        // Search by term
        if (args.searchTerm) {
            const term = args.searchTerm.toLowerCase();
            courses = courses.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.code.toLowerCase().includes(term) ||
                c.description.toLowerCase().includes(term)
            );
        }

        // Enrich with program data
        const enrichedCourses = await Promise.all(
            courses.map(async (course) => {
                const program = await ctx.db.get(course.programId);
                return { ...course, program };
            })
        );

        return enrichedCourses;
    },
});

/**
 * Get courses available for enrollment for a student
 */
export const getAvailableCoursesForStudent = query({
    args: {
        studentId: v.id("users"),
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only see their own available courses, admins and professors can see any
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Not authorized to view courses for this student",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const student = await ctx.db.get(args.studentId);
        if (!student?.studentProfile) {
            throw new AppError(
                "Student not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get all courses in student's program
        const programCourses = await ctx.db
            .query("courses")
            .withIndex("by_program_active", (q) =>
                q.eq("programId", student.studentProfile!.programId).eq("isActive", true)
            )
            .collect();

        // Get student's current enrollments for this semester
        const currentEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_semester", (q) =>
                q.eq("studentId", args.studentId).eq("semesterId", args.semesterId)
            )
            .filter((q) => q.neq(q.field("status"), "dropped"))
            .collect();

        const enrolledCourseIds = new Set(currentEnrollments.map(e => e.courseId));

        // Get student's completed courses
        const completedEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_status", (q) =>
                q.eq("studentId", args.studentId).eq("status", "completed")
            )
            .collect();

        const completedCourseIds = new Set(completedEnrollments.map(e => e.courseId));

        // Filter available courses
        const availableCourses = [];

        for (const course of programCourses) {
            // Skip if already enrolled or completed
            if (enrolledCourseIds.has(course._id) || completedCourseIds.has(course._id)) {
                continue;
            }

            // Check prerequisites
            const prereqCheck = await hasCompletedPrerequisites(
                ctx,
                args.studentId,
                course._id
            );

            availableCourses.push({
                course,
                canEnroll: prereqCheck.hasCompleted,
                missingPrerequisites: prereqCheck.missing,
            });
        }

        return availableCourses;
    },
});

// ============================================================================
// COURSE MUTATIONS
// ============================================================================

/**
 * Create new course with validation
 */
export const createCourse = mutation({
    args: {
        code: v.string(),
        name: v.string(),
        description: v.string(),
        credits: v.number(),
        programId: v.id("programs"),
        area: courseAreaValidator,
        prerequisites: v.array(v.string()),
        minSemester: v.number(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate input
        if (args.credits <= 0) {
            throw new AppError(
                "Credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (args.minSemester < 1) {
            throw new AppError(
                "Minimum semester must be at least 1",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if course code already exists
        if (await isCourseCodeTaken(ctx, args.code)) {
            throw new AppError(
                `Course code '${args.code}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Validate prerequisites exist
        if (args.prerequisites.length > 0) {
            const programCourses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", args.programId).eq("isActive", true)
                )
                .collect();

            const existingCodes = new Set(programCourses.map(c => c.code));

            for (const prereqCode of args.prerequisites) {
                if (!existingCodes.has(prereqCode)) {
                    throw new AppError(
                        `Prerequisite course '${prereqCode}' not found`,
                        ErrorCodes.COURSE_NOT_FOUND
                    );
                }
            }
        }

        const courseId = await ctx.db.insert("courses", {
            ...args,
            isActive: true,
        });

        return {
            courseId,
            message: `Course '${args.name}' created successfully`
        };
    },
});

/**
 * Update course (Admin only)
 */
export const updateCourse = mutation({
    args: {
        courseId: v.id("courses"),
        code: v.optional(v.string()),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        credits: v.optional(v.number()),
        area: v.optional(courseAreaValidator),
        prerequisites: v.optional(v.array(v.string())),
        minSemester: v.optional(v.number()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const { courseId, ...updates } = args;

        const course = await ctx.db.get(courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Validate updates
        if (updates.credits && updates.credits <= 0) {
            throw new AppError(
                "Credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (updates.minSemester && updates.minSemester < 1) {
            throw new AppError(
                "Minimum semester must be at least 1",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if code is being changed and already exists
        if (updates.code && updates.code !== course.code) {
            if (await isCourseCodeTaken(ctx, updates.code, courseId)) {
                throw new AppError(
                    `Course code '${updates.code}' already exists`,
                    ErrorCodes.DUPLICATE_ENTRY
                );
            }
        }

        // Validate prerequisites if being updated
        if (updates.prerequisites) {
            const programCourses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", course.programId).eq("isActive", true)
                )
                .collect();

            const existingCodes = new Set(programCourses.map(c => c.code));

            for (const prereqCode of updates.prerequisites) {
                if (!existingCodes.has(prereqCode) && prereqCode !== course.code) {
                    throw new AppError(
                        `Prerequisite course '${prereqCode}' not found`,
                        ErrorCodes.COURSE_NOT_FOUND
                    );
                }
            }
        }

        await ctx.db.patch(courseId, updates);

        return {
            success: true,
            message: `Course '${course.name}' updated successfully`
        };
    },
});

/**
 * Archive course (soft delete - Admin only)
 */
export const archiveCourse = mutation({
    args: {
        courseId: v.id("courses"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Check if there are active sections for this course
        const activeSections = await ctx.db
            .query("sections")
            .filter((q) =>
                q.and(
                    q.eq(q.field("courseId"), args.courseId),
                    q.or(
                        q.eq(q.field("status"), "active"),
                        q.eq(q.field("status"), "open")
                    )
                )
            )
            .collect();

        if (activeSections.length > 0) {
            throw new AppError(
                `Cannot archive course with ${activeSections.length} active sections`,
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(args.courseId, { isActive: false });

        return {
            success: true,
            message: `Course '${course.name}' archived successfully`
        };
    },
});

// ============================================================================
// COURSE ANALYTICS
// ============================================================================

/**
 * Get course statistics (for professors and admins)
 */
export const getCourseStatistics = query({
    args: {
        courseId: v.id("courses"),
        semesterId: v.optional(v.id("semesters")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Only admins and professors can view course statistics
        if (currentUser.role === "student") {
            throw new AppError(
                "Not authorized to view course statistics",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Get enrollments
        let enrollments;
        if (args.semesterId) {
            enrollments = await ctx.db
                .query("enrollments")
                .filter((q) =>
                    q.and(
                        q.eq(q.field("courseId"), args.courseId),
                        q.eq(q.field("semesterId"), args.semesterId)
                    )
                )
                .collect();
        } else {
            enrollments = await ctx.db
                .query("enrollments")
                .filter((q) => q.eq(q.field("courseId"), args.courseId))
                .collect();
        }

        const completedEnrollments = enrollments.filter(e =>
            e.status === "completed" && e.finalGrade !== undefined
        );

        const totalEnrolled = enrollments.length;
        const totalCompleted = completedEnrollments.length;
        const totalDropped = enrollments.filter(e => e.status === "dropped").length;
        const totalPassed = completedEnrollments.filter(e =>
            e.finalGrade! >= 3.0
        ).length;

        // Calculate average grade
        const averageGrade = completedEnrollments.length > 0
            ? completedEnrollments.reduce((sum, e) => sum + e.finalGrade!, 0) / completedEnrollments.length
            : 0;

        return {
            course,
            totalEnrolled,
            totalCompleted,
            totalDropped,
            totalPassed,
            averageGrade: Number(averageGrade.toFixed(2)),
            passRate: totalCompleted > 0 ? (totalPassed / totalCompleted) * 100 : 0,
            dropRate: totalEnrolled > 0 ? (totalDropped / totalEnrolled) * 100 : 0,
        };
    },
});

/**
 * Get courses by area within a program
 */
export const getCoursesByArea = query({
    args: {
        programId: v.id("programs"),
        area: courseAreaValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("courses")
            .withIndex("by_program_active", (q) =>
                q.eq("programId", args.programId).eq("isActive", true)
            )
            .filter((q) => q.eq(q.field("area"), args.area))
            .collect();
    },
});
