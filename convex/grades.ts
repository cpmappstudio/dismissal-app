// ################################################################################
// # File: grades.ts                                                             # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Grade-specific operations and calculations
 * Handles grade analytics, batch operations, and reporting
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
    getUserByClerkId,
    calculateGPA,
    calculateLetterGrade,
    calculateGradePoints,
    calculateQualityPoints,
    isGradingOpen
} from "./helpers";

/**
 * Get grade distribution for a section
 */
export const getSectionGradeDistribution = query({
    args: {
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) {
            throw new ConvexError("User not found");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Check permissions
        const canView = (user.role === "admin" || user.role === "superadmin") ||
            (user.role === "professor" && section.professorId === user._id);

        if (!canView) {
            throw new ConvexError("Permission denied");
        }

        // Get enrollments with grades
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .collect();

        const gradedEnrollments = enrollments.filter(e => e.percentageGrade !== undefined);

        // Calculate grade distribution
        const distribution = {
            "A+": 0, "A": 0, "A-": 0,
            "B+": 0, "B": 0, "B-": 0,
            "C+": 0, "C": 0, "C-": 0,
            "D+": 0, "D": 0, "F": 0
        };

        gradedEnrollments.forEach(enrollment => {
            if (enrollment.letterGrade && enrollment.letterGrade in distribution) {
                distribution[enrollment.letterGrade as keyof typeof distribution]++;
            }
        });

        // Calculate statistics
        const percentageGrades = gradedEnrollments.map(e => e.percentageGrade!);
        const averageGrade = percentageGrades.length > 0
            ? percentageGrades.reduce((sum, grade) => sum + grade, 0) / percentageGrades.length
            : 0;

        const median = percentageGrades.length > 0
            ? percentageGrades.sort((a, b) => a - b)[Math.floor(percentageGrades.length / 2)]
            : 0;

        const passRate = gradedEnrollments.length > 0
            ? gradedEnrollments.filter(e => e.percentageGrade! >= 65).length / gradedEnrollments.length * 100
            : 0;

        return {
            section,
            distribution,
            statistics: {
                totalStudents: enrollments.length,
                gradedStudents: gradedEnrollments.length,
                pendingGrades: enrollments.length - gradedEnrollments.length,
                averageGrade: Math.round(averageGrade * 100) / 100,
                medianGrade: median,
                passRate: Math.round(passRate * 100) / 100,
                highestGrade: Math.max(...percentageGrades, 0),
                lowestGrade: Math.min(...percentageGrades, 100),
            },
        };
    },
});

/**
 * Calculate period GPA for a student
 */
export const calculatePeriodGPA = query({
    args: {
        studentId: v.optional(v.id("users")), // Admin can specify student
        periodId: v.id("periods"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) {
            throw new ConvexError("User not found");
        }

        // Determine target student
        let targetStudentId = user._id;
        if (args.studentId) {
            // Admin can calculate for any student, students only for themselves
            if (user.role === "admin" || user.role === "superadmin") {
                targetStudentId = args.studentId;
            } else if (user.role === "student" && args.studentId === user._id) {
                targetStudentId = args.studentId;
            } else {
                throw new ConvexError("Permission denied");
            }
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required or specify studentId");
        }

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments for the period
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", targetStudentId).eq("periodId", args.periodId))
            .filter(q => q.eq(q.field("countsForGPA"), true))
            .collect();

        // Calculate GPA
        const gpaResult = await calculateGPA(ctx.db, enrollments);

        // Get course details for each enrollment
        const courseDetails = await Promise.all(
            enrollments.map(async (enrollment) => {
                const course = await ctx.db.get(enrollment.courseId);
                return {
                    enrollment,
                    course,
                };
            })
        );

        return {
            period,
            gpaResult,
            courses: courseDetails,
            summary: {
                coursesAttempted: enrollments.length,
                coursesCompleted: enrollments.filter(e => e.status === "completed").length,
                creditsAttempted: gpaResult.attemptedCredits,
                creditsEarned: gpaResult.earnedCredits,
            },
        };
    },
});

/**
 * Submit grades for entire section (Professor only)
 */
export const submitSectionGrades = mutation({
    args: {
        sectionId: v.id("sections"),
        grades: v.array(v.object({
            studentId: v.id("users"),
            percentageGrade: v.number(),
            gradeNotes: v.optional(v.string()),
        })),
        markAsSubmitted: v.optional(v.boolean()),
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

        // Get all enrollments for the section
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        const results = [];

        for (const gradeSubmission of args.grades) {
            // Find the enrollment for this student
            const enrollment = enrollments.find(e => e.studentId === gradeSubmission.studentId);

            if (!enrollment) {
                throw new ConvexError(`Student ${gradeSubmission.studentId} is not enrolled in this section`);
            }

            // Validate percentage grade
            if (gradeSubmission.percentageGrade < 0 || gradeSubmission.percentageGrade > 100) {
                throw new ConvexError(`Invalid grade: ${gradeSubmission.percentageGrade}. Must be between 0-100`);
            }

            // Calculate derived grade values
            const letterGrade = calculateLetterGrade(gradeSubmission.percentageGrade);
            const gradePoints = calculateGradePoints(gradeSubmission.percentageGrade);
            const qualityPoints = calculateQualityPoints(gradePoints, course.credits);

            // Determine final status
            const finalStatus = gradeSubmission.percentageGrade >= 65 ? "completed" : "failed";

            // Update enrollment with grade
            await ctx.db.patch(enrollment._id, {
                percentageGrade: gradeSubmission.percentageGrade,
                letterGrade,
                gradePoints,
                qualityPoints,
                status: finalStatus,
                gradedBy: user._id,
                gradedAt: Date.now(),
                gradeNotes: gradeSubmission.gradeNotes,
                lastGradeUpdate: Date.now(),
                updatedAt: Date.now(),
            });

            results.push({
                studentId: gradeSubmission.studentId,
                enrollmentId: enrollment._id,
                percentageGrade: gradeSubmission.percentageGrade,
                letterGrade,
                gradePoints,
                status: finalStatus,
            });
        }

        // Mark section as grades submitted if requested
        if (args.markAsSubmitted) {
            await ctx.db.patch(args.sectionId, {
                gradesSubmitted: true,
                gradesSubmittedAt: Date.now(),
                updatedAt: Date.now(),
            });
        }

        return {
            sectionId: args.sectionId,
            gradesProcessed: results.length,
            sectionMarkedAsSubmitted: args.markAsSubmitted || false,
            results,
        };
    },
});

/**
 * Get grade statistics for a course across all sections and periods
 */
export const getCourseGradeStatistics = query({
    args: {
        courseId: v.id("courses"),
        periodIds: v.optional(v.array(v.id("periods"))),
        professorId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "professor")) {
            throw new ConvexError("Admin or Professor access required");
        }

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        // Get all enrollments for this course
        let enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("courseId"), args.courseId))
            .collect();

        // Apply filters
        if (args.periodIds) {
            enrollments = enrollments.filter(e => args.periodIds!.includes(e.periodId));
        }

        if (args.professorId) {
            enrollments = enrollments.filter(e => e.professorId === args.professorId);
        }

        // Professor can only view their own sections
        if (user.role === "professor") {
            enrollments = enrollments.filter(e => e.professorId === user._id);
        }

        const gradedEnrollments = enrollments.filter(e => e.percentageGrade !== undefined);

        // Calculate overall statistics
        const percentageGrades = gradedEnrollments.map(e => e.percentageGrade!);
        const averageGrade = percentageGrades.length > 0
            ? percentageGrades.reduce((sum, grade) => sum + grade, 0) / percentageGrades.length
            : 0;

        // Grade distribution
        const distribution = {
            "A+": 0, "A": 0, "A-": 0,
            "B+": 0, "B": 0, "B-": 0,
            "C+": 0, "C": 0, "C-": 0,
            "D+": 0, "D": 0, "F": 0
        };

        gradedEnrollments.forEach(enrollment => {
            if (enrollment.letterGrade && enrollment.letterGrade in distribution) {
                distribution[enrollment.letterGrade as keyof typeof distribution]++;
            }
        });

        // Group by period for trends
        const enrollmentsByPeriod = new Map();
        for (const enrollment of gradedEnrollments) {
            const periodId = enrollment.periodId;
            if (!enrollmentsByPeriod.has(periodId)) {
                const period = await ctx.db.get(periodId);
                enrollmentsByPeriod.set(periodId, {
                    period,
                    enrollments: [],
                });
            }
            enrollmentsByPeriod.get(periodId).enrollments.push(enrollment);
        }

        // Calculate period statistics
        const periodStatistics = Array.from(enrollmentsByPeriod.values()).map(({ period, enrollments }) => {
            const grades = enrollments.map((e: any) => e.percentageGrade);
            const average = grades.reduce((sum: number, grade: number) => sum + grade, 0) / grades.length;
            const passRate = enrollments.filter((e: any) => e.percentageGrade >= 65).length / enrollments.length * 100;

            return {
                period,
                enrollments: enrollments.length,
                averageGrade: Math.round(average * 100) / 100,
                passRate: Math.round(passRate * 100) / 100,
            };
        });

        return {
            course,
            overallStatistics: {
                totalEnrollments: enrollments.length,
                gradedEnrollments: gradedEnrollments.length,
                averageGrade: Math.round(averageGrade * 100) / 100,
                passRate: gradedEnrollments.length > 0
                    ? Math.round(gradedEnrollments.filter(e => e.percentageGrade! >= 65).length / gradedEnrollments.length * 100 * 100) / 100
                    : 0,
                withdrawalRate: enrollments.length > 0
                    ? Math.round(enrollments.filter(e => e.status === "withdrawn" || e.status === "dropped").length / enrollments.length * 100 * 100) / 100
                    : 0,
            },
            gradeDistribution: distribution,
            periodTrends: periodStatistics.sort((a, b) =>
                (b.period?.year || 0) - (a.period?.year || 0) ||
                (b.period?.bimesterNumber || 0) - (a.period?.bimesterNumber || 0)
            ),
        };
    },
});

/**
 * Get incomplete grades report (Admin/Professor)
 */
export const getIncompleteGradesReport = query({
    args: {
        periodId: v.optional(v.id("periods")),
        professorId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "professor")) {
            throw new ConvexError("Admin or Professor access required");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await ctx.db.query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments with status incomplete or enrolled students without grades
        let enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
            .collect();

        // Filter for incomplete or ungraded
        let incompleteEnrollments = enrollments.filter(enrollment =>
            enrollment.status === "incomplete" ||
            (enrollment.status === "enrolled" && enrollment.percentageGrade === undefined)
        );

        // Apply professor filter
        if (args.professorId) {
            incompleteEnrollments = incompleteEnrollments.filter(e => e.professorId === args.professorId);
        }

        // Professor can only view their own sections
        if (user.role === "professor") {
            incompleteEnrollments = incompleteEnrollments.filter(e => e.professorId === user._id);
        }

        // Get details for each incomplete enrollment
        const incompleteDetails = await Promise.all(
            incompleteEnrollments.map(async (enrollment) => {
                const [student, course, section, professor] = await Promise.all([
                    ctx.db.get(enrollment.studentId),
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.professorId),
                ]);

                return {
                    enrollment,
                    student,
                    course,
                    section,
                    professor,
                    daysOverdue: enrollment.incompleteDeadline
                        ? Math.max(0, Math.floor((Date.now() - enrollment.incompleteDeadline) / (24 * 60 * 60 * 1000)))
                        : null,
                };
            })
        );

        // Group by professor
        const byProfessor = incompleteDetails.reduce((acc, item) => {
            const professorId = item.professor?._id;
            if (!professorId) return acc;

            if (!acc[professorId]) {
                acc[professorId] = {
                    professor: item.professor,
                    incompletes: [],
                };
            }
            acc[professorId].incompletes.push(item);
            return acc;
        }, {} as any);

        return {
            period: targetPeriod,
            summary: {
                totalIncomplete: incompleteEnrollments.length,
                byStatus: {
                    incomplete: incompleteEnrollments.filter(e => e.status === "incomplete").length,
                    ungraded: incompleteEnrollments.filter(e => e.status === "enrolled" && e.percentageGrade === undefined).length,
                },
                professorCount: Object.keys(byProfessor).length,
            },
            incompletesByProfessor: Object.values(byProfessor),
            allIncompletes: incompleteDetails,
        };
    },
});

/**
 * Bulk grade import/validation (Admin/Professor)
 */
export const validateBulkGrades = mutation({
    args: {
        sectionId: v.id("sections"),
        grades: v.array(v.object({
            studentCode: v.string(),
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
        if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "professor")) {
            throw new ConvexError("Admin or Professor access required");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Check permissions
        const canEdit = (user.role === "admin" || user.role === "superadmin") ||
            (user.role === "professor" && section.professorId === user._id);

        if (!canEdit) {
            throw new ConvexError("Permission denied");
        }

        // Get all students enrolled in this section
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        const students = await Promise.all(
            enrollments.map(async (enrollment) => {
                const student = await ctx.db.get(enrollment.studentId);
                return { enrollment, student };
            })
        );

        // Validate grades
        const validationResults = [];
        const errors = [];

        for (const gradeEntry of args.grades) {
            // Find student by student code
            const studentMatch = students.find(s =>
                s.student?.studentProfile?.studentCode === gradeEntry.studentCode
            );

            if (!studentMatch) {
                errors.push(`Student code ${gradeEntry.studentCode} not found in this section`);
                continue;
            }

            // Validate grade
            if (gradeEntry.percentageGrade < 0 || gradeEntry.percentageGrade > 100) {
                errors.push(`Invalid grade ${gradeEntry.percentageGrade} for student ${gradeEntry.studentCode}. Must be 0-100`);
                continue;
            }

            // Calculate derived values
            const letterGrade = calculateLetterGrade(gradeEntry.percentageGrade);
            const gradePoints = calculateGradePoints(gradeEntry.percentageGrade);

            validationResults.push({
                studentCode: gradeEntry.studentCode,
                studentName: `${studentMatch.student?.firstName} ${studentMatch.student?.lastName}`,
                enrollmentId: studentMatch.enrollment._id,
                percentageGrade: gradeEntry.percentageGrade,
                letterGrade,
                gradePoints,
                gradeNotes: gradeEntry.gradeNotes,
                isValid: true,
            });
        }

        return {
            sectionId: args.sectionId,
            totalSubmitted: args.grades.length,
            validGrades: validationResults.length,
            errors,
            validationResults,
            canProceed: errors.length === 0,
        };
    },
});
