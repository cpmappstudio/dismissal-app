// ################################################################################
// # File: enrollments.ts                                                         #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Student enrollment and grade management for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    enrollmentStatusValidator,
    ErrorCodes,
    AppError,
} from "./types";
import {
    requireAuth,
    requireRole,
    requireAdminOrSelf,
    calculateLetterGrade,
    calculateGradePoints,
    calculateQualityPoints,
} from "./helpers";

// ============================================================================
// ENROLLMENT QUERIES
// ============================================================================

/**
 * Get student enrollments for a period
 */
export const getStudentEnrollments = query({
    args: {
        studentId: v.id("users"),
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only see their own enrollments
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Not authorized to view enrollments",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let enrollments;
        if (args.periodId) {
            enrollments = await ctx.db
                .query("enrollments")
                .withIndex("by_student_period", (q) =>
                    q.eq("studentId", args.studentId).eq("periodId", args.periodId!)
                )
                .collect();
        } else {
            enrollments = await ctx.db
                .query("enrollments")
                .filter((q) => q.eq(q.field("studentId"), args.studentId))
                .collect();
        }

        // Enrich with course and section data
        const enrichedEnrollments = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [section, course] = await Promise.all([
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.courseId),
                ]);
                return {
                    ...enrollment,
                    section,
                    course,
                };
            })
        );

        return enrichedEnrollments;
    },
});

/**
 * Enroll student in section
 */
export const enrollStudent = mutation({
    args: {
        studentId: v.id("users"),
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only enroll themselves, admins can enroll anyone
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Students can only enroll themselves",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const [student, section] = await Promise.all([
            ctx.db.get(args.studentId),
            ctx.db.get(args.sectionId),
        ]);

        if (!student?.studentProfile) {
            throw new AppError("Student not found", ErrorCodes.USER_NOT_FOUND);
        }

        if (!section) {
            throw new AppError("Section not found", ErrorCodes.SECTION_NOT_FOUND);
        }

        // Check if already enrolled
        const existingEnrollment = await ctx.db
            .query("enrollments")
            .filter((q) =>
                q.and(
                    q.eq(q.field("studentId"), args.studentId),
                    q.eq(q.field("sectionId"), args.sectionId),
                    q.neq(q.field("status"), "cancelled")
                )
            )
            .first();

        if (existingEnrollment) {
            throw new AppError(
                "Student is already enrolled in this section",
                ErrorCodes.ALREADY_ENROLLED
            );
        }

        // Check capacity
        if (section.enrolled >= section.capacity) {
            throw new AppError(
                "Section is at full capacity",
                ErrorCodes.SECTION_FULL
            );
        }

        // Create enrollment
        const enrollmentId = await ctx.db.insert("enrollments", {
            studentId: args.studentId,
            sectionId: args.sectionId,
            courseId: section.courseId,
            periodId: section.periodId,
            enrolledAt: Date.now(),
            status: "enrolled" as const,
            isRetake: false, // TODO: Detect if this is a retake
            countsForGPA: true,
        });

        // Update section enrollment count
        await ctx.db.patch(args.sectionId, {
            enrolled: section.enrolled + 1,
        });

        return {
            enrollmentId,
            message: "Successfully enrolled in section",
        };
    },
});

/**
 * Cancel enrollment (Student)
 */
export const cancelEnrollment = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new AppError("Enrollment not found", ErrorCodes.USER_NOT_FOUND);
        }

        // Students can only cancel their own enrollments
        if (currentUser.role === "student" && currentUser._id !== enrollment.studentId) {
            throw new AppError(
                "Students can only cancel their own courses",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Can't cancel if already completed
        if (enrollment.status === "completed") {
            throw new AppError(
                "Cannot cancel a completed course",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Update enrollment status
        await ctx.db.patch(args.enrollmentId, {
            status: "cancelled" as const,
            cancellationDate: Date.now(),
        });

        // Update section enrollment count
        const section = await ctx.db.get(enrollment.sectionId);
        if (section) {
            await ctx.db.patch(enrollment.sectionId, {
                enrolled: Math.max(0, section.enrolled - 1),
            });
        }

        return {
            success: true,
            message: "Successfully cancelled enrollment",
        };
    },
});

/**
 * Submit grades for multiple students (Professor)
 */
export const submitGrades = mutation({
    args: {
        sectionId: v.id("sections"),
        grades: v.array(v.object({
            enrollmentId: v.id("enrollments"),
            percentageGrade: v.number(), // 0-100 American system
            gradeNotes: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError("Section not found", ErrorCodes.SECTION_NOT_FOUND);
        }

        // Only admin or assigned professor can submit grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to submit grades for this section",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const results = {
            successful: 0,
            failed: [] as { enrollmentId: string; reason: string }[],
        };

        for (const gradeData of args.grades) {
            try {
                const enrollment = await ctx.db.get(gradeData.enrollmentId);
                if (!enrollment) {
                    results.failed.push({
                        enrollmentId: gradeData.enrollmentId,
                        reason: "Enrollment not found",
                    });
                    continue;
                }

                // Validate percentage grade (0-100 American system)
                if (gradeData.percentageGrade < 0 || gradeData.percentageGrade > 100) {
                    results.failed.push({
                        enrollmentId: gradeData.enrollmentId,
                        reason: "Grade must be between 0 and 100",
                    });
                    continue;
                }

                const course = await ctx.db.get(enrollment.courseId);
                if (!course) {
                    results.failed.push({
                        enrollmentId: gradeData.enrollmentId,
                        reason: "Course not found",
                    });
                    continue;
                }

                // Calculate American system values
                const letterGrade = calculateLetterGrade(gradeData.percentageGrade);
                const gradePoints = calculateGradePoints(gradeData.percentageGrade);
                const qualityPoints = calculateQualityPoints(gradePoints, course.credits);
                const finalStatus = gradeData.percentageGrade >= 65 ? "completed" : "failed";

                // Update enrollment with American grading system
                await ctx.db.patch(gradeData.enrollmentId, {
                    percentageGrade: gradeData.percentageGrade,
                    letterGrade,
                    gradePoints,
                    qualityPoints,
                    status: finalStatus,
                    gradedBy: currentUser._id,
                    gradedAt: Date.now(),
                    gradeNotes: gradeData.gradeNotes,
                    countsForGPA: true,
                });

                results.successful++;
            } catch (error) {
                results.failed.push({
                    enrollmentId: gradeData.enrollmentId,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        // Mark section grades as submitted
        await ctx.db.patch(args.sectionId, {
            gradesSubmitted: true,
        });

        return {
            ...results,
            message: `Submitted ${results.successful} grades, ${results.failed.length} failed`,
        };
    },
});

/**
 * Submit makeup grade (Professor)
 */
export const submitMakeupGrade = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        percentageGrade: v.number(), // 0-100 American system
        gradeNotes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new AppError("Enrollment not found", ErrorCodes.USER_NOT_FOUND);
        }

        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
            throw new AppError("Section not found", ErrorCodes.SECTION_NOT_FOUND);
        }

        // Only admin or assigned professor can submit makeup grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to submit makeup grades",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate percentage grade (0-100 American system)
        if (args.percentageGrade < 0 || args.percentageGrade > 100) {
            throw new AppError(
                "Grade must be between 0 and 100",
                ErrorCodes.INVALID_INPUT
            );
        }

        const course = await ctx.db.get(enrollment.courseId);
        if (!course) {
            throw new AppError("Course not found", ErrorCodes.COURSE_NOT_FOUND);
        }

        // Calculate American system values
        const letterGrade = calculateLetterGrade(args.percentageGrade);
        const gradePoints = calculateGradePoints(args.percentageGrade);
        const qualityPoints = calculateQualityPoints(gradePoints, course.credits);
        const finalStatus = args.percentageGrade >= 65 ? "completed" : "failed";

        // Update enrollment with makeup grade
        await ctx.db.patch(args.enrollmentId, {
            percentageGrade: args.percentageGrade,
            letterGrade,
            gradePoints,
            qualityPoints,
            status: finalStatus,
            gradedBy: currentUser._id,
            gradedAt: Date.now(),
            gradeNotes: args.gradeNotes,
            countsForGPA: true,
        });

        return {
            success: true,
            message: `Makeup grade ${args.percentageGrade}% (${letterGrade}) submitted successfully`,
        };
    },
});

/**
 * Generate student transcript
 */
export const getTranscript = query({
    args: {
        studentId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdminOrSelf(ctx, args.studentId);

        const student = await ctx.db.get(args.studentId);
        if (!student?.studentProfile) {
            throw new AppError("Student not found", ErrorCodes.USER_NOT_FOUND);
        }

        // Get all completed enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .filter((q) =>
                q.and(
                    q.eq(q.field("studentId"), args.studentId),
                    q.eq(q.field("status"), "completed")
                )
            )
            .collect();

        // Group by period and enrich with course data
        const transcriptByPeriod = new Map();

        for (const enrollment of enrollments) {
            if (!transcriptByPeriod.has(enrollment.periodId)) {
                const period = await ctx.db.get(enrollment.periodId);
                transcriptByPeriod.set(enrollment.periodId, {
                    period,
                    courses: [],
                    totalCredits: 0,
                    creditsEarned: 0,
                    humanitiesCredits: 0,
                    coreCredits: 0,
                    electiveCredits: 0,
                });
            }

            const course = await ctx.db.get(enrollment.courseId);
            const periodData = transcriptByPeriod.get(enrollment.periodId);

            const passed = (enrollment.percentageGrade || 0) >= 65; // American passing threshold
            const creditsEarned = passed ? (course?.credits || 0) : 0;

            periodData.courses.push({
                course,
                enrollment: {
                    percentageGrade: enrollment.percentageGrade,
                    letterGrade: enrollment.letterGrade,
                    gradePoints: enrollment.gradePoints,
                    qualityPoints: enrollment.qualityPoints,
                    creditsEarned,
                    gradeNotes: enrollment.gradeNotes,
                },
            });

            periodData.totalCredits += course?.credits || 0;
            periodData.creditsEarned += creditsEarned;

            // Count by category
            if (course?.category === "humanities") {
                periodData.humanitiesCredits += creditsEarned;
            } else if (course?.category === "core") {
                periodData.coreCredits += creditsEarned;
            } else if (course?.category === "elective") {
                periodData.electiveCredits += creditsEarned;
            }
        }

        // Convert to array and calculate totals
        const transcript = Array.from(transcriptByPeriod.values());

        // Calculate overall GPA using quality points
        let totalQualityPoints = 0;
        let totalCredits = 0;

        for (const enrollment of enrollments) {
            if (enrollment.countsForGPA && enrollment.qualityPoints !== undefined) {
                const course = await ctx.db.get(enrollment.courseId);
                totalQualityPoints += enrollment.qualityPoints;
                totalCredits += course?.credits || 0;
            }
        }

        const summary = {
            humanitiesCredits: transcript.reduce((sum, p) => sum + p.humanitiesCredits, 0),
            coreCredits: transcript.reduce((sum, p) => sum + p.coreCredits, 0),
            electiveCredits: transcript.reduce((sum, p) => sum + p.electiveCredits, 0),
            totalCreditsEarned: transcript.reduce((sum, p) => sum + p.creditsEarned, 0),
            overallGPA: totalCredits > 0 ? totalQualityPoints / totalCredits : 0,
            coursesCompleted: enrollments.length,
        };

        return {
            student: {
                name: student.name,
                studentCode: student.studentProfile.studentCode,
                program: await ctx.db.get(student.studentProfile.programId),
                enrollmentDate: student.studentProfile.enrollmentDate,
                status: student.studentProfile.status,
            },
            transcript,
            summary: {
                ...summary,
                overallGPA: parseFloat(summary.overallGPA.toFixed(2)),
            },
            generatedAt: Date.now(),
        };
    },
});