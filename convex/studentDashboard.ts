import { v } from "convex/values";
import { query } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
    type PeriodSummary,
} from "./types";
import {
    requireRole,
    requireAdminOrSelf,
    getCurrentPeriod,
    calculateStudentProgress,
    calculateGPA,
    calculatePeriodRanking,
    enrichEnrollmentsWithDetails,
} from "./helpers";

// ============================================================================
// STUDENT DASHBOARD QUERIES
// ============================================================================

/**
 * Get complete student dashboard data
 */
export const getStudentDashboard = query({
    args: {
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "student");
        const targetStudentId = args.studentId || currentUser._id;

        // Allow admin or self
        await requireAdminOrSelf(ctx, targetStudentId);

        const [student, currentPeriod] = await Promise.all([
            ctx.db.get(targetStudentId),
            getCurrentPeriod(ctx)
        ]);

        if (!student?.studentProfile) {
            throw new AppError("Student not found", ErrorCodes.USER_NOT_FOUND);
        }

        // Get current period enrollments
        let currentEnrollments: Array<{
            enrollment: any;
            course: any;
            section: any;
            professor: any;
            period: any;
        }> = [];
        let currentPeriodGPA = 0;
        let currentCredits = 0;
        let ranking = null;

        if (currentPeriod) {
            const enrollments = await ctx.db
                .query("enrollments")
                .withIndex("by_student_period", (q) =>
                    q.eq("studentId", targetStudentId).eq("periodId", currentPeriod._id)
                )
                .collect();

            currentEnrollments = await enrichEnrollmentsWithDetails(ctx, enrollments);

            // Calculate current period stats
            currentPeriodGPA = await calculateGPA(ctx, targetStudentId, currentPeriod._id);

            for (const { course, enrollment } of currentEnrollments) {
                if (course && enrollment.status === "enrolled") {
                    currentCredits += course.credits;
                }
            }

            // Calculate ranking for current period if has grades
            if (currentPeriodGPA > 0) {
                ranking = await calculatePeriodRanking(ctx, currentPeriod._id, targetStudentId);
            }
        }

        // Get overall progress and cumulative GPA
        const [progress, cumulativeGPA, program] = await Promise.all([
            calculateStudentProgress(ctx, targetStudentId),
            calculateGPA(ctx, targetStudentId), // No period = cumulative
            ctx.db.get(student.studentProfile.programId)
        ]);

        return {
            student,
            program,
            currentPeriod,

            // Current period data
            currentEnrollments,
            currentCredits,
            currentPeriodGPA,
            ranking: ranking ? {
                rank: ranking.rank,
                total: ranking.total,
                gpa: ranking.gpa
            } : null,

            // Overall progress
            progress: progress || {
                humanitiesCredits: 0,
                coreCredits: 0,
                electiveCredits: 0,
                totalCredits: 0,
                requiredHumanities: 40,
                requiredCore: 60,
                requiredElective: 20,
                requiredTotal: 120,
                humanitiesProgress: 0,
                coreProgress: 0,
                electiveProgress: 0,
                overallProgress: 0,
                program: program || null,
            },
            cumulativeGPA,
        };
    },
});

/**
 * Get detailed student progress (for progress visualization)
 */
export const getStudentProgress = query({
    args: {
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "student");
        const targetStudentId = args.studentId || currentUser._id;

        await requireAdminOrSelf(ctx, targetStudentId);

        const progress = await calculateStudentProgress(ctx, targetStudentId);

        if (!progress) {
            throw new AppError("Unable to calculate progress", ErrorCodes.USER_NOT_FOUND);
        }

        return progress;
    },
});

/**
 * Get student summary for a specific period
 */
export const getStudentPeriodSummary = query({
    args: {
        periodId: v.id("periods"),
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "student");
        const targetStudentId = args.studentId || currentUser._id;

        await requireAdminOrSelf(ctx, targetStudentId);

        const [period, enrollments] = await Promise.all([
            ctx.db.get(args.periodId),
            ctx.db
                .query("enrollments")
                .withIndex("by_student_period", (q) =>
                    q.eq("studentId", targetStudentId).eq("periodId", args.periodId)
                )
                .collect()
        ]);

        if (!period) {
            throw new AppError("Period not found", ErrorCodes.PERIOD_NOT_FOUND);
        }

        const enrichedEnrollments = await enrichEnrollmentsWithDetails(ctx, enrollments);

        // Calculate period metrics
        let creditsEnrolled = 0;
        let creditsApproved = 0;
        let totalPoints = 0;
        let totalCredits = 0;

        for (const { enrollment, course } of enrichedEnrollments) {
            if (course) {
                creditsEnrolled += course.credits;

                // Count approved credits (passing grade >= 3.0)
                if (enrollment.effectiveGrade && enrollment.effectiveGrade >= 3.0) {
                    creditsApproved += course.credits;
                }

                // For GPA calculation - any graded course
                if (enrollment.effectiveGrade !== null && enrollment.effectiveGrade !== undefined) {
                    totalPoints += enrollment.effectiveGrade * course.credits;
                    totalCredits += course.credits;
                }
            }
        }

        const periodGPA = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;

        // Get cumulative data up to this period
        const cumulativeGPA = await calculateGPA(ctx, targetStudentId);
        const progress = await calculateStudentProgress(ctx, targetStudentId);

        // Calculate ranking for this period
        let ranking = null;
        if (periodGPA > 0) {
            ranking = await calculatePeriodRanking(ctx, args.periodId, targetStudentId);
        }

        const periodSummary: PeriodSummary = {
            period,
            enrollments: enrichedEnrollments,

            // Period metrics
            creditsEnrolled,
            creditsApproved,
            creditPercentage: creditsEnrolled > 0 ? (creditsApproved / creditsEnrolled) * 100 : 0,
            periodGPA,

            // Cumulative metrics
            cumulativeCredits: progress?.totalCredits || 0,
            cumulativeGPA,

            // Ranking
            classRank: ranking?.rank,
            totalStudents: ranking?.total,
        };

        return periodSummary;
    },
});

/**
 * Get student's academic history (all periods)
 */
export const getStudentAcademicHistory = query({
    args: {
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "student");
        const targetStudentId = args.studentId || currentUser._id;

        await requireAdminOrSelf(ctx, targetStudentId);

        // Get all periods where student was enrolled
        const allEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_course", (q) => q.eq("studentId", targetStudentId))
            .collect();

        // Group by period
        const periodIds = [...new Set(allEnrollments.map(e => e.periodId))];

        const periodSummaries = await Promise.all(
            periodIds.map(async (periodId) => {
                const periodEnrollments = allEnrollments.filter(e => e.periodId === periodId);
                const period = await ctx.db.get(periodId);

                if (!period) return null;

                const enrichedEnrollments = await enrichEnrollmentsWithDetails(ctx, periodEnrollments);

                // Calculate period stats
                let creditsEnrolled = 0;
                let creditsApproved = 0;
                let totalPoints = 0;
                let totalCredits = 0;

                for (const { enrollment, course } of enrichedEnrollments) {
                    if (course) {
                        creditsEnrolled += course.credits;

                        if (enrollment.effectiveGrade && enrollment.effectiveGrade >= 3.0) {
                            creditsApproved += course.credits;
                        }

                        if (enrollment.effectiveGrade !== null && enrollment.effectiveGrade !== undefined) {
                            totalPoints += enrollment.effectiveGrade * course.credits;
                            totalCredits += course.credits;
                        }
                    }
                }

                const periodGPA = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;

                return {
                    period,
                    enrollments: enrichedEnrollments,
                    creditsEnrolled,
                    creditsApproved,
                    creditPercentage: creditsEnrolled > 0 ? (creditsApproved / creditsEnrolled) * 100 : 0,
                    periodGPA,
                };
            })
        );

        // Filter out null periods and sort by date
        const validPeriods = periodSummaries
            .filter(p => p !== null)
            .sort((a, b) => a!.period.startDate - b!.period.startDate);

        return validPeriods;
    },
});
