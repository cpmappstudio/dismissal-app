// ################################################################################
// # File: students.ts                                                           # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Student-specific queries and mutations
 * Handles student academic data, progress tracking, and personal information
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
    getUserByClerkId,
    getCurrentPeriod,
    calculateAcademicProgress,
    getAcademicHistory,
    getProgramCourses,
    calculateGPA
} from "./helpers";

/**
 * Get student's current enrollments for the active period
 */
export const getMyEnrollments = query({
    args: {
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        // Get target period (current or specified)
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments for the period
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", user._id).eq("periodId", targetPeriod._id))
            .collect();

        // Get detailed information for each enrollment
        const enrollmentDetails = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [section, course, professor] = await Promise.all([
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.professorId),
                ]);

                return {
                    enrollment,
                    section,
                    course,
                    professor,
                };
            })
        );

        return {
            period: targetPeriod,
            enrollments: enrollmentDetails,
        };
    },
});

/**
 * Get student's academic progress
 */
export const getMyProgress = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student" || !user.studentProfile) {
            throw new ConvexError("Student access required");
        }

        // Calculate academic progress
        const progress = await calculateAcademicProgress(ctx.db, user._id);
        if (!progress) {
            throw new ConvexError("Unable to calculate academic progress");
        }

        // Get program courses for curriculum visualization
        const programCourses = await getProgramCourses(ctx.db, user.studentProfile.programId);

        // Get completed courses
        const completedEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q => q.eq("studentId", user._id))
            .filter(q => q.eq(q.field("status"), "completed"))
            .collect();

        const completedCourseIds = completedEnrollments.map(e => e.courseId);

        // Organize courses by category with completion status
        const coursesByCategory = {
            humanities: [] as any[],
            core: [] as any[],
            elective: [] as any[],
            general: [] as any[],
        };

        for (const { course, isRequired, category } of programCourses) {
            const isCompleted = completedCourseIds.includes(course._id);
            const enrollment = completedEnrollments.find(e => e.courseId === course._id);

            coursesByCategory[category].push({
                course,
                isRequired,
                isCompleted,
                grade: enrollment ? {
                    percentageGrade: enrollment.percentageGrade,
                    letterGrade: enrollment.letterGrade,
                    gradePoints: enrollment.gradePoints,
                } : null,
            });
        }

        return {
            progress,
            curriculum: coursesByCategory,
            summary: {
                totalCreditsRequired: progress.totalCreditsRequired,
                totalCreditsEarned: progress.creditsCompleted,
                progressPercentage: progress.completionPercentage,
                gpa: progress.gpa,
            },
        };
    },
});

/**
 * Get student's class schedule
 */
export const getMySchedule = query({
    args: {
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get current enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", user._id).eq("periodId", targetPeriod._id))
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        // Get schedule details
        const scheduleItems = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [section, course, professor] = await Promise.all([
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.professorId),
                ]);

                return {
                    enrollment,
                    section,
                    course,
                    professor,
                    schedule: section?.schedule,
                };
            })
        );

        return {
            period: targetPeriod,
            schedule: scheduleItems,
        };
    },
});

/**
 * Get student's complete academic history
 */
export const getMyAcademicHistory = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        // Get complete academic history
        const history = await getAcademicHistory(ctx.db, user._id);

        // Calculate overall GPA
        const allEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q => q.eq("studentId", user._id))
            .filter(q => q.eq(q.field("countsForGPA"), true))
            .collect();

        const overallGPA = await calculateGPA(ctx.db, allEnrollments);

        return {
            history,
            overallGPA,
            summary: {
                totalPeriodsCompleted: history.length,
                totalCreditsAttempted: allEnrollments.reduce((sum, e) => {
                    // Get course credits (we'll need to fetch the course)
                    return sum; // Simplified for now
                }, 0),
                totalCreditsEarned: allEnrollments
                    .filter(e => e.status === "completed")
                    .reduce((sum, e) => {
                        return sum; // Simplified for now
                    }, 0),
            },
        };
    },
});

/**
 * Get grades for a specific period
 */
export const getMyGrades = query({
    args: {
        periodId: v.id("periods"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments with grades
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", user._id).eq("periodId", args.periodId))
            .collect();

        // Get grade details
        const gradeDetails = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [course, section, professor] = await Promise.all([
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.professorId),
                ]);

                return {
                    enrollment,
                    course,
                    section,
                    professor,
                    grade: {
                        percentageGrade: enrollment.percentageGrade,
                        letterGrade: enrollment.letterGrade,
                        gradePoints: enrollment.gradePoints,
                        qualityPoints: enrollment.qualityPoints,
                        isRetake: enrollment.isRetake,
                        countsForGPA: enrollment.countsForGPA,
                        gradedAt: enrollment.gradedAt,
                    },
                };
            })
        );

        // Calculate period GPA
        const periodGPA = await calculateGPA(ctx.db, enrollments);

        return {
            period,
            grades: gradeDetails,
            periodGPA,
            statistics: {
                totalCourses: enrollments.length,
                gradedCourses: enrollments.filter(e => e.percentageGrade !== undefined).length,
                passedCourses: enrollments.filter(e => e.status === "completed").length,
                totalCredits: gradeDetails.reduce((sum, g) => sum + (g.course?.credits || 0), 0),
            },
        };
    },
});

/**
 * Request academic document (transcript, certificate, etc.)
 */
export const requestDocument = mutation({
    args: {
        documentType: v.union(
            v.literal("transcript"),
            v.literal("enrollment_certificate"),
            v.literal("grade_report"),
            v.literal("completion_certificate"),
            v.literal("degree"),
            v.literal("schedule")
        ),
        scope: v.optional(v.object({
            periodId: v.optional(v.id("periods")),
            fromDate: v.optional(v.number()),
            toDate: v.optional(v.number()),
            includeInProgress: v.optional(v.boolean()),
        })),
        language: v.union(v.literal("es"), v.literal("en")),
        format: v.union(v.literal("pdf"), v.literal("html")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        // Create document request log
        const documentLogId = await ctx.db.insert("document_logs", {
            requestedBy: user._id,
            requestedFor: user._id,
            documentType: args.documentType,
            scope: args.scope,
            format: args.format,
            language: args.language,
            status: "pending",
            generatedAt: Date.now(),
            // IP and user agent would be added from the action layer
        });

        return {
            documentLogId,
            status: "Document request submitted successfully",
            estimatedTime: "5-10 minutes",
        };
    },
});
