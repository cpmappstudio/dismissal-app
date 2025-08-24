// ################################################################################
// # File: professors.ts                                                         # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Professor-specific queries and mutations
 * Handles professor's sections, grade submission, and teaching analytics
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
    getUserByClerkId,
    getCurrentPeriod,
    getProfessorSections,
    calculateLetterGrade,
    calculateGradePoints,
    calculateQualityPoints,
    isGradingOpen
} from "./helpers";

/**
 * Get professor's sections for current or specified period
 */
export const getMySections = query({
    args: {
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get professor's sections
        const sections = await getProfessorSections(ctx.db, user._id, targetPeriod._id);

        // Get section details with enrollments and course info
        const sectionDetails = await Promise.all(
            sections.map(async (section) => {
                const course = await ctx.db.get(section.courseId);

                // Get enrollments for this section
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section", q => q.eq("sectionId", section._id))
                    .collect();

                // Get student details
                const studentEnrollments = await Promise.all(
                    enrollments.map(async (enrollment) => {
                        const student = await ctx.db.get(enrollment.studentId);
                        return { enrollment, student };
                    })
                );

                // Calculate statistics
                const enrolledCount = enrollments.filter(e => e.status === "enrolled").length;
                const gradedCount = enrollments.filter(e => e.percentageGrade !== undefined).length;
                const gradedEnrollments = enrollments.filter(e => e.percentageGrade !== undefined);
                const avgGrade = gradedEnrollments.length > 0
                    ? gradedEnrollments.reduce((sum, e) => sum + (e.percentageGrade || 0), 0) / gradedEnrollments.length
                    : 0;

                return {
                    section,
                    course,
                    enrollments: studentEnrollments,
                    statistics: {
                        capacity: section.capacity,
                        enrolled: enrolledCount,
                        graded: gradedCount,
                        pending: enrolledCount - gradedCount,
                        averageGrade: avgGrade,
                        gradesSubmitted: section.gradesSubmitted,
                    },
                };
            })
        );

        return {
            period: targetPeriod,
            sections: sectionDetails,
            summary: {
                totalSections: sections.length,
                totalStudents: sectionDetails.reduce((sum, s) => sum + s.statistics.enrolled, 0),
                sectionsWithGrades: sectionDetails.filter(s => s.statistics.gradesSubmitted).length,
                sectionsPendingGrades: sectionDetails.filter(s => !s.statistics.gradesSubmitted).length,
            },
        };
    },
});

/**
 * Get students enrolled in a specific section
 */
export const getStudentsBySection = query({
    args: {
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Verify professor owns this section
        if (section.professorId !== user._id) {
            throw new ConvexError("You can only access your own sections");
        }

        const course = await ctx.db.get(section.courseId);
        const period = await ctx.db.get(section.periodId);

        // Get enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .collect();

        // Get student details with enrollment info
        const students = await Promise.all(
            enrollments.map(async (enrollment) => {
                const student = await ctx.db.get(enrollment.studentId);
                return {
                    student,
                    enrollment,
                    grade: {
                        percentageGrade: enrollment.percentageGrade,
                        letterGrade: enrollment.letterGrade,
                        gradePoints: enrollment.gradePoints,
                        qualityPoints: enrollment.qualityPoints,
                        gradedAt: enrollment.gradedAt,
                        gradeNotes: enrollment.gradeNotes,
                    },
                };
            })
        );

        return {
            section,
            course,
            period,
            students,
            statistics: {
                totalStudents: students.length,
                enrolledStudents: students.filter(s => s.enrollment.status === "enrolled").length,
                gradedStudents: students.filter(s => s.grade.percentageGrade !== undefined).length,
                averageGrade: students.length > 0 ?
                    students
                        .filter(s => s.grade.percentageGrade !== undefined)
                        .reduce((sum, s) => sum + (s.grade.percentageGrade || 0), 0) /
                    students.filter(s => s.grade.percentageGrade !== undefined).length
                    : 0,
            },
        };
    },
});

/**
 * Submit grades for multiple students in a section
 */
export const submitGrades = mutation({
    args: {
        sectionId: v.id("sections"),
        grades: v.array(v.object({
            enrollmentId: v.id("enrollments"),
            percentageGrade: v.number(),
            gradeNotes: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Verify professor owns this section
        if (section.professorId !== user._id) {
            throw new ConvexError("You can only submit grades for your own sections");
        }

        const period = await ctx.db.get(section.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Check if grading period is open
        if (!isGradingOpen(period)) {
            throw new ConvexError("Grading period is closed");
        }

        const course = await ctx.db.get(section.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        // Process each grade submission
        const results = [];
        for (const gradeSubmission of args.grades) {
            // Validate percentage grade
            if (gradeSubmission.percentageGrade < 0 || gradeSubmission.percentageGrade > 100) {
                throw new ConvexError(`Invalid grade: ${gradeSubmission.percentageGrade}. Must be between 0-100`);
            }

            const enrollment = await ctx.db.get(gradeSubmission.enrollmentId);
            if (!enrollment || enrollment.sectionId !== args.sectionId) {
                throw new ConvexError("Invalid enrollment for this section");
            }

            // Calculate derived grade values
            const letterGrade = calculateLetterGrade(gradeSubmission.percentageGrade);
            const gradePoints = calculateGradePoints(gradeSubmission.percentageGrade);
            const qualityPoints = calculateQualityPoints(gradePoints, course.credits);

            // Update enrollment with grade
            await ctx.db.patch(gradeSubmission.enrollmentId, {
                percentageGrade: gradeSubmission.percentageGrade,
                letterGrade,
                gradePoints,
                qualityPoints,
                gradedBy: user._id,
                gradedAt: Date.now(),
                gradeNotes: gradeSubmission.gradeNotes,
                lastGradeUpdate: Date.now(),
                updatedAt: Date.now(),
            });

            results.push({
                enrollmentId: gradeSubmission.enrollmentId,
                percentageGrade: gradeSubmission.percentageGrade,
                letterGrade,
                gradePoints,
            });
        }

        return {
            sectionId: args.sectionId,
            gradesSubmitted: results.length,
            results,
        };
    },
});

/**
 * Update a single student's grade
 */
export const updateGrade = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        percentageGrade: v.number(),
        gradeNotes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new ConvexError("Enrollment not found");
        }

        // Verify professor owns this enrollment's section
        if (enrollment.professorId !== user._id) {
            throw new ConvexError("You can only update grades for your own sections");
        }

        // Validate percentage grade
        if (args.percentageGrade < 0 || args.percentageGrade > 100) {
            throw new ConvexError(`Invalid grade: ${args.percentageGrade}. Must be between 0-100`);
        }

        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        const period = await ctx.db.get(enrollment.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Check if grading period is open
        if (!isGradingOpen(period)) {
            throw new ConvexError("Grading period is closed");
        }

        const course = await ctx.db.get(enrollment.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        // Calculate derived grade values
        const letterGrade = calculateLetterGrade(args.percentageGrade);
        const gradePoints = calculateGradePoints(args.percentageGrade);
        const qualityPoints = calculateQualityPoints(gradePoints, course.credits);

        // Update enrollment with new grade
        await ctx.db.patch(args.enrollmentId, {
            percentageGrade: args.percentageGrade,
            letterGrade,
            gradePoints,
            qualityPoints,
            gradedBy: user._id,
            gradedAt: Date.now(),
            gradeNotes: args.gradeNotes,
            lastGradeUpdate: Date.now(),
            updatedAt: Date.now(),
        });

        return {
            enrollmentId: args.enrollmentId,
            percentageGrade: args.percentageGrade,
            letterGrade,
            gradePoints,
            qualityPoints,
        };
    },
});

/**
 * Mark section grades as submitted (final submission)
 */
export const markGradesSubmitted = mutation({
    args: {
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Verify professor owns this section
        if (section.professorId !== user._id) {
            throw new ConvexError("You can only submit grades for your own sections");
        }

        // Check if all enrolled students have grades
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        const ungradedStudents = enrollments.filter(e => e.percentageGrade === undefined);
        if (ungradedStudents.length > 0) {
            throw new ConvexError(`Cannot submit grades: ${ungradedStudents.length} students still need grades`);
        }

        // Mark section grades as submitted
        await ctx.db.patch(args.sectionId, {
            gradesSubmitted: true,
            gradesSubmittedAt: Date.now(),
            updatedAt: Date.now(),
        });

        return {
            sectionId: args.sectionId,
            gradesSubmitted: true,
            studentsGraded: enrollments.length,
        };
    },
});

/**
 * Get teaching history for the professor
 */
export const getMyTeachingHistory = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor access required");
        }

        // Get all sections taught by professor
        const allSections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", q => q.eq("professorId", user._id))
            .collect();

        // Get section details grouped by period
        const sectionsByPeriod = new Map();

        for (const section of allSections) {
            const [period, course] = await Promise.all([
                ctx.db.get(section.periodId),
                ctx.db.get(section.courseId),
            ]);

            // Get enrollment statistics
            const enrollments = await ctx.db
                .query("enrollments")
                .withIndex("by_section", q => q.eq("sectionId", section._id))
                .collect();

            const periodKey = section.periodId;
            if (!sectionsByPeriod.has(periodKey)) {
                sectionsByPeriod.set(periodKey, {
                    period,
                    sections: [],
                });
            }

            sectionsByPeriod.get(periodKey).sections.push({
                section,
                course,
                statistics: {
                    enrolled: enrollments.filter(e => e.status === "enrolled").length,
                    completed: enrollments.filter(e => e.status === "completed").length,
                    averageGrade: enrollments.length > 0 ?
                        enrollments
                            .filter(e => e.percentageGrade !== undefined)
                            .reduce((sum, e) => sum + (e.percentageGrade || 0), 0) /
                        enrollments.filter(e => e.percentageGrade !== undefined).length
                        : 0,
                },
            });
        }

        // Convert to array and sort by period
        let history = Array.from(sectionsByPeriod.values())
            .sort((a, b) => (b.period?.year || 0) - (a.period?.year || 0) ||
                (b.period?.bimesterNumber || 0) - (a.period?.bimesterNumber || 0));

        // Apply limit if specified
        if (args.limit) {
            history = history.slice(0, args.limit);
        }

        return {
            history,
            summary: {
                totalSections: allSections.length,
                totalPeriods: history.length,
                totalStudentsTaught: history.reduce((sum, p) =>
                    sum + p.sections.reduce((sectionSum: number, s: any) =>
                        sectionSum + s.statistics.enrolled, 0), 0),
            },
        };
    },
});
