// ################################################################################
// # File: dashboard.ts                                                           # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Dashboard queries for different user roles
 * Provides comprehensive data for student, professor, and admin dashboards
 */

import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
    getUserByClerkId,
    getCurrentPeriod,
    calculateAcademicProgress,
    getActiveStudentsCount,
    getActiveProfessorsCount,
    getActiveCoursesCount,
    getActiveProgramsCount,
    calculateGPA
} from "./helpers";

/**
 * Get comprehensive student dashboard data
 */
export const getStudentDashboard = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student" || !user.studentProfile) {
            throw new ConvexError("Student not found or invalid role");
        }

        const currentPeriod = await getCurrentPeriod(ctx.db);
        if (!currentPeriod) {
            throw new ConvexError("No current period found");
        }

        // Get student program
        const program = await ctx.db.get(user.studentProfile.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get current enrollments
        const currentEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", user._id).eq("periodId", currentPeriod._id))
            .collect();

        // Get enrollment details with course and section info
        const enrollmentDetails = await Promise.all(
            currentEnrollments.map(async (enrollment) => {
                const section = await ctx.db.get(enrollment.sectionId);
                const course = await ctx.db.get(enrollment.courseId);
                const professor = await ctx.db.get(enrollment.professorId);

                return {
                    enrollment,
                    section,
                    course,
                    professor,
                };
            })
        );

        // Calculate academic progress
        const academicProgress = await calculateAcademicProgress(ctx.db, user._id);

        // Get all student enrollments for GPA calculation
        const allEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q => q.eq("studentId", user._id))
            .filter(q => q.eq(q.field("countsForGPA"), true))
            .collect();

        // Calculate cumulative GPA
        const gpaResult = await calculateGPA(ctx.db, allEnrollments);

        // Get period GPA (current period only)
        const periodGpaResult = await calculateGPA(ctx.db, currentEnrollments.filter(e => e.countsForGPA));

        return {
            user: {
                ...user,
                program,
            },
            currentPeriod,
            enrollments: enrollmentDetails,
            academicProgress,
            gpa: {
                cumulative: gpaResult,
                period: periodGpaResult,
            },
            summary: {
                totalCreditsEnrolled: enrollmentDetails.reduce((sum, e) =>
                    sum + (e.course?.credits || 0), 0),
                completedCourses: allEnrollments.filter(e =>
                    e.status === "completed").length,
                totalCourses: allEnrollments.length,
                academicStanding: user.studentProfile.academicStanding || "good_standing",
            }
        };
    },
});

/**
 * Get comprehensive professor dashboard data
 */
export const getProfessorDashboard = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "professor") {
            throw new ConvexError("Professor not found or invalid role");
        }

        const currentPeriod = await getCurrentPeriod(ctx.db);
        if (!currentPeriod) {
            throw new ConvexError("No current period found");
        }

        // Get professor's current sections
        const currentSections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", q =>
                q.eq("professorId", user._id).eq("periodId", currentPeriod._id).eq("isActive", true))
            .collect();

        // Get section details with course info and enrollments
        const sectionDetails = await Promise.all(
            currentSections.map(async (section) => {
                const course = await ctx.db.get(section.courseId);

                // Get enrollments for this section
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section", q => q.eq("sectionId", section._id))
                    .collect();

                // Get student details for enrollments
                const studentEnrollments = await Promise.all(
                    enrollments.map(async (enrollment) => {
                        const student = await ctx.db.get(enrollment.studentId);
                        return { enrollment, student };
                    })
                );

                return {
                    section,
                    course,
                    enrollments: studentEnrollments,
                    statistics: {
                        enrolled: enrollments.filter(e => e.status === "enrolled").length,
                        graded: enrollments.filter(e => e.percentageGrade !== undefined).length,
                        avgGrade: enrollments.length > 0 ?
                            enrollments
                                .filter(e => e.percentageGrade !== undefined)
                                .reduce((sum, e) => sum + (e.percentageGrade || 0), 0) /
                            enrollments.filter(e => e.percentageGrade !== undefined).length
                            : 0,
                    }
                };
            })
        );

        // Get teaching statistics
        const allSections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", q => q.eq("professorId", user._id))
            .collect();

        const totalStudents = await ctx.db
            .query("enrollments")
            .withIndex("by_professor_period", q =>
                q.eq("professorId", user._id).eq("periodId", currentPeriod._id))
            .collect();

        return {
            user,
            currentPeriod,
            sections: sectionDetails,
            summary: {
                totalSections: currentSections.length,
                totalStudents: totalStudents.length,
                gradingPending: sectionDetails.filter(s => !s.section.gradesSubmitted).length,
                totalSectionsAllTime: allSections.length,
            }
        };
    },
});

/**
 * Get comprehensive admin dashboard data
 */
export const getAdminDashboard = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        const currentPeriod = await getCurrentPeriod(ctx.db);

        // Get system statistics
        const [
            activeStudents,
            activeProfessors,
            activeCourses,
            activePrograms
        ] = await Promise.all([
            getActiveStudentsCount(ctx.db),
            getActiveProfessorsCount(ctx.db),
            getActiveCoursesCount(ctx.db),
            getActiveProgramsCount(ctx.db)
        ]);

        // Get current period enrollments
        let currentEnrollments = 0;
        let currentSections = 0;

        if (currentPeriod) {
            const enrollments = await ctx.db
                .query("enrollments")
                .filter(q => q.eq(q.field("periodId"), currentPeriod._id))
                .collect();

            const sections = await ctx.db
                .query("sections")
                .withIndex("by_period_status_active", q =>
                    q.eq("periodId", currentPeriod._id).eq("status", "active").eq("isActive", true))
                .collect();

            currentEnrollments = enrollments.filter(e => e.status === "enrolled").length;
            currentSections = sections.length;
        }

        // Get recent user registrations (last 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentUsers = await ctx.db
            .query("users")
            .filter(q => q.gte(q.field("createdAt"), thirtyDaysAgo))
            .collect();

        // Get pending activations
        const pendingUsers = await ctx.db
            .query("users")
            .filter(q => q.eq(q.field("isActive"), false))
            .collect();

        // Period status overview
        const allPeriods = await ctx.db
            .query("periods")
            .collect();

        // Sort periods by creation time (newest first) and take last 6
        const recentPeriods = allPeriods
            .sort((a, b) => b._creationTime - a._creationTime)
            .slice(0, 6);

        return {
            user,
            currentPeriod,
            statistics: {
                users: {
                    activeStudents,
                    activeProfessors,
                    recentRegistrations: recentUsers.length,
                    pendingActivations: pendingUsers.length,
                },
                academic: {
                    activePrograms,
                    activeCourses,
                    currentSections,
                    currentEnrollments,
                },
            },
            recentPeriods: recentPeriods,
            pendingActions: {
                userActivations: pendingUsers.length,
                gradeSubmissions: currentPeriod ? (
                    await ctx.db
                        .query("sections")
                        .withIndex("by_period_status_active", q =>
                            q.eq("periodId", currentPeriod._id).eq("status", "active").eq("isActive", true))
                        .filter(q => q.eq(q.field("gradesSubmitted"), false))
                        .collect()
                ).length : 0,
            }
        };
    },
});

/**
 * Get system-wide statistics (Admin only)
 */
export const getSystemStatistics = query({
    args: {
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments for the period
        const enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
            .collect();

        // Get sections for the period
        const sections = await ctx.db
            .query("sections")
            .withIndex("by_period_status_active", q =>
                q.eq("periodId", targetPeriod._id).eq("status", "active").eq("isActive", true))
            .collect();

        // Calculate grade distribution
        const gradedEnrollments = enrollments.filter(e => e.percentageGrade !== undefined);
        const gradeDistribution = {
            "A+": 0, "A": 0, "A-": 0,
            "B+": 0, "B": 0, "B-": 0,
            "C+": 0, "C": 0, "C-": 0,
            "D+": 0, "D": 0, "F": 0
        };

        gradedEnrollments.forEach(enrollment => {
            if (enrollment.letterGrade && enrollment.letterGrade in gradeDistribution) {
                gradeDistribution[enrollment.letterGrade as keyof typeof gradeDistribution]++;
            }
        });

        return {
            period: targetPeriod,
            enrollmentStats: {
                total: enrollments.length,
                enrolled: enrollments.filter(e => e.status === "enrolled").length,
                completed: enrollments.filter(e => e.status === "completed").length,
                withdrawn: enrollments.filter(e => e.status === "withdrawn").length,
                failed: enrollments.filter(e => e.status === "failed").length,
            },
            gradeStats: {
                graded: gradedEnrollments.length,
                pending: enrollments.filter(e => e.percentageGrade === undefined).length,
                distribution: gradeDistribution,
                averageGrade: gradedEnrollments.length > 0 ?
                    gradedEnrollments.reduce((sum, e) => sum + (e.percentageGrade || 0), 0) / gradedEnrollments.length
                    : 0,
            },
            sectionStats: {
                total: sections.length,
                gradesSubmitted: sections.filter(s => s.gradesSubmitted).length,
                gradesPending: sections.filter(s => !s.gradesSubmitted).length,
            }
        };
    },
});
