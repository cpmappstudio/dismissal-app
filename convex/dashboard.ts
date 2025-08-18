// ################################################################################
// # File: dashboard.ts                                                           #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Dashboard data aggregation functions for students and professors
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
    ErrorCodes,
    AppError,
} from "./types";
import {
    requireAuth,
    requireRole,
    calculateLetterGrade,
    isPassingGrade,
} from "./helpers";

// Dashboard data types
export interface DashboardStats {
    [key: string]: number;
}

export interface RecentActivity {
    type: "grade" | "graded" | "enrollment" | "assignment";
    title: string;
    courseCode: string;
    timestamp: number;
    details: any;
}

export interface UpcomingDeadlines {
    activityTitle: string;
    courseCode: string;
    courseName: string;
    dueAt: number;
    category: string;
    maxPoints: number;
    isOverdue: boolean;
}

export interface StudentDashboard {
    semester: any;
    stats: DashboardStats;
    currentCourses: any[];
    upcomingDeadlines: UpcomingDeadlines[];
    recentActivity: RecentActivity[];
}

export interface ProfessorDashboard {
    semester: any;
    stats: DashboardStats;
    currentSections: any[];
    recentActivity: RecentActivity[];
    pendingGrading: number;
}

// ============================================================================
// STUDENT DASHBOARD QUERIES
// ============================================================================

/**
 * Get student dashboard data
 */
export const getStudentDashboard = query({
    args: {
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        if (currentUser.role !== "student") {
            throw new AppError(
                "Only students can access student dashboard",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Get current semester
        const semester = await ctx.db.get(args.semesterId);
        if (!semester) {
            throw new AppError(
                "Semester not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get student enrollments for the semester
        const allEnrollments = await ctx.db
            .query("enrollments")
            .collect();

        const enrollments = allEnrollments.filter(e =>
            e.studentId === currentUser._id &&
            e.semesterId === args.semesterId &&
            e.status !== "dropped"
        );

        // Get courses and sections
        const coursesData = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [course, section] = await Promise.all([
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                ]);

                if (!course || !section) return null;

                // Get professor info
                const professor = await ctx.db.get(section.professorId);

                return {
                    courseCode: course.code,
                    courseName: course.name,
                    credits: course.credits,
                    professor: professor ? {
                        name: professor.name,
                        email: professor.email,
                    } : null,
                    schedule: section.schedule,
                    currentGrade: enrollment.finalGrade || 0,
                    letterGrade: enrollment.letterGrade,
                    status: enrollment.status,
                };
            })
        );

        const currentCourses = coursesData.filter(Boolean);

        // Calculate statistics
        const stats: DashboardStats = {
            totalCredits: currentCourses.reduce((sum, c) => sum + (c?.credits || 0), 0),
            currentGPA: calculateSemesterGPA(currentCourses),
            completedCourses: currentCourses.filter(c => c?.status === "completed").length,
            inProgressCourses: currentCourses.filter(c => c?.status === "enrolled").length,
            upcomingDeadlines: 0,
            recentGrades: 0,
        };

        const dashboard: StudentDashboard = {
            semester: {
                _id: semester._id,
                name: `${semester.year}-${semester.period}`,
                startDate: semester.startDate,
                endDate: semester.endDate,
            },
            stats,
            currentCourses,
            upcomingDeadlines: [],
            recentActivity: [],
        };

        return dashboard;
    },
});

/**
 * Get student academic progress overview
 */
export const getStudentProgress = query({
    args: {
        studentId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);
        const targetStudentId = args.studentId || currentUser._id;

        // Authorization check
        if (currentUser.role === "student" && currentUser._id !== targetStudentId) {
            throw new AppError(
                "Not authorized to view other student's progress",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const student = await ctx.db.get(targetStudentId);
        if (!student || student.role !== "student") {
            throw new AppError(
                "Student not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get all enrollments for the student
        const allEnrollments = await ctx.db
            .query("enrollments")
            .collect();

        const enrollments = allEnrollments.filter(e => e.studentId === targetStudentId);

        // Get semesters and calculate progress by semester
        const semesterIds = [...new Set(enrollments.map(e => e.semesterId))];
        const semesters = await Promise.all(semesterIds.map(id => ctx.db.get(id)));

        const semesterProgress = await Promise.all(
            semesters.filter(Boolean).map(async (semester: any) => {
                const semesterEnrollments = enrollments.filter(e => e.semesterId === semester._id);

                const courseDetails = await Promise.all(
                    semesterEnrollments.map(async (enrollment) => {
                        const course = await ctx.db.get(enrollment.courseId);
                        return {
                            courseCode: course?.code || "Unknown",
                            courseName: course?.name || "Unknown",
                            credits: course?.credits || 0,
                            finalGrade: enrollment.finalGrade,
                            letterGrade: enrollment.letterGrade,
                            status: enrollment.status,
                            creditsEarned: enrollment.creditsEarned || 0,
                        };
                    })
                );

                const totalCredits = courseDetails.reduce((sum, c) => sum + c.credits, 0);
                const earnedCredits = courseDetails.reduce((sum, c) => sum + c.creditsEarned, 0);
                const gpa = calculateSemesterGPA(courseDetails);

                return {
                    semester: {
                        _id: semester._id,
                        name: `${semester.year}-${semester.period}`,
                        startDate: semester.startDate,
                        endDate: semester.endDate,
                    },
                    totalCredits,
                    earnedCredits,
                    gpa,
                    courses: courseDetails,
                };
            })
        );

        // Calculate overall statistics
        const totalCreditsAttempted = semesterProgress.reduce((sum, s) => sum + s.totalCredits, 0);
        const totalCreditsEarned = semesterProgress.reduce((sum, s) => sum + s.earnedCredits, 0);
        const overallGPA = calculateOverallGPA(semesterProgress);

        return {
            student: {
                _id: student._id,
                name: student.name,
                email: student.email,
                studentCode: student.studentProfile?.studentCode,
                program: student.studentProfile?.programId,
            },
            overallStats: {
                totalCreditsAttempted,
                totalCreditsEarned,
                overallGPA,
                completionRate: totalCreditsAttempted > 0 ? (totalCreditsEarned / totalCreditsAttempted) * 100 : 0,
            },
            semesterProgress: semesterProgress.sort((a, b) => b.semester.startDate - a.semester.startDate),
        };
    },
});

// ============================================================================
// PROFESSOR DASHBOARD QUERIES
// ============================================================================

/**
 * Get professor dashboard data
 */
export const getProfessorDashboard = query({
    args: {
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        if (currentUser.role !== "professor" && currentUser.role !== "admin") {
            throw new AppError(
                "Only professors and admins can access professor dashboard",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Get current semester
        const semester = await ctx.db.get(args.semesterId);
        if (!semester) {
            throw new AppError(
                "Semester not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get professor's sections for the semester
        const allSections = await ctx.db
            .query("sections")
            .collect();

        const sections = allSections.filter(s =>
            s.professorId === currentUser._id &&
            s.semesterId === args.semesterId
        );

        // Get courses for sections
        const courses = await Promise.all(
            sections.map(section => ctx.db.get(section.courseId))
        );

        // Get enrollments for all sections
        const sectionIds = sections.map(s => s._id);
        const allEnrollments = await ctx.db
            .query("enrollments")
            .collect();

        const enrollments = allEnrollments.filter(e =>
            sectionIds.includes(e.sectionId) &&
            e.status === "enrolled"
        );

        // Get activities that need grading
        const allActivities = await ctx.db
            .query("activities")
            .collect();

        const activities = allActivities.filter((a: any) =>
            sectionIds.includes(a.sectionId)
        );

        // Get grades to determine pending grading
        const allGrades = await ctx.db
            .query("grades")
            .collect();

        const enrollmentIds = enrollments.map(e => e._id);
        const existingGrades = allGrades.filter((g: any) =>
            enrollmentIds.includes(g.enrollmentId)
        );

        // Calculate pending grading
        let pendingGrading = 0;
        for (const activity of activities) {
            const sectionEnrollments = enrollments.filter(e => e.sectionId === activity.sectionId);
            const activityGrades = existingGrades.filter((g: any) => g.activityId === activity._id);
            pendingGrading += sectionEnrollments.length - activityGrades.length;
        }

        // Build section summaries
        const currentSections = await Promise.all(
            sections.map(async (section, index) => {
                const course = courses[index];

                if (!course) return null;

                const sectionEnrollments = enrollments.filter(e => e.sectionId === section._id);
                const sectionActivities = activities.filter((a: any) => a.sectionId === section._id);

                return {
                    _id: section._id,
                    courseCode: course.code,
                    courseName: course.name,
                    schedule: section.schedule,
                    enrolledStudents: sectionEnrollments.length,
                    maxCapacity: section.capacity,
                    activitiesCount: sectionActivities.length,
                    averageGrade: await calculateSectionAverageGrade(ctx, section._id),
                };
            })
        );

        // Get recent activity (recent grades submitted)
        const recentGrades = existingGrades
            .filter((g: any) => g.gradedBy === currentUser._id)
            .sort((a: any, b: any) => b.gradedAt - a.gradedAt)
            .slice(0, 10);

        const recentActivity: RecentActivity[] = await Promise.all(
            recentGrades.map(async (grade: any) => {
                const enrollment = await ctx.db.get(grade.enrollmentId);
                const activity = await ctx.db.get(grade.activityId);
                const student = enrollment ? await ctx.db.get((enrollment as any).studentId) : null;
                const section = enrollment ? await ctx.db.get((enrollment as any).sectionId) : null;
                const course = section ? await ctx.db.get((section as any).courseId) : null;

                return {
                    type: "graded" as const,
                    title: `Graded ${(activity as any)?.title || "activity"} for ${(student as any)?.name || "student"}`,
                    courseCode: (course as any)?.code || "Unknown",
                    timestamp: grade.gradedAt,
                    details: {
                        studentName: (student as any)?.name,
                        score: grade.score,
                        maxPoints: (activity as any)?.maxPoints,
                    },
                };
            })
        );

        // Calculate statistics
        const totalStudents = enrollments.length;
        const totalSections = sections.length;
        const totalActivities = activities.length;

        const stats: DashboardStats = {
            totalSections,
            totalStudents,
            totalActivities,
            pendingGrading,
            averageClassSize: totalSections > 0 ? Math.round(totalStudents / totalSections) : 0,
            completedGrading: existingGrades.filter((g: any) => g.gradedBy === currentUser._id).length,
        };

        const dashboard: ProfessorDashboard = {
            semester: {
                _id: semester._id,
                name: `${semester.year}-${semester.period}`,
                startDate: semester.startDate,
                endDate: semester.endDate,
            },
            stats,
            currentSections: currentSections.filter(Boolean) as any[],
            recentActivity,
            pendingGrading: pendingGrading,
        };

        return dashboard;
    },
});

/**
 * Get professor teaching load and performance metrics
 */
export const getProfessorMetrics = query({
    args: {
        professorId: v.optional(v.id("users")),
        semesterId: v.optional(v.id("semesters")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);
        const targetProfessorId = args.professorId || currentUser._id;

        // Authorization check
        if (currentUser.role === "professor" && currentUser._id !== targetProfessorId) {
            throw new AppError(
                "Not authorized to view other professor's metrics",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const professor = await ctx.db.get(targetProfessorId);
        if (!professor || professor.role !== "professor") {
            throw new AppError(
                "Professor not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get sections taught by professor
        const allSections = await ctx.db
            .query("sections")
            .collect();

        let sections = allSections.filter(s => s.professorId === targetProfessorId);

        if (args.semesterId) {
            sections = sections.filter(s => s.semesterId === args.semesterId);
        }

        // Get enrollment and grading statistics
        const sectionIds = sections.map(s => s._id);
        const allEnrollments = await ctx.db
            .query("enrollments")
            .collect();

        const enrollments = allEnrollments.filter(e => sectionIds.includes(e.sectionId));

        // Calculate metrics by semester
        const semesterIds = [...new Set(sections.map(s => s.semesterId))];
        const semesters = await Promise.all(semesterIds.map(id => ctx.db.get(id)));

        const semesterMetrics = await Promise.all(
            semesters.filter(Boolean).map(async (semester: any) => {
                const semesterSections = sections.filter(s => s.semesterId === semester._id);
                const semesterEnrollments = enrollments.filter(e =>
                    semesterSections.some(s => s._id === e.sectionId)
                );

                const courses = await Promise.all(
                    semesterSections.map(s => ctx.db.get(s.courseId))
                );

                const sectionDetails = await Promise.all(
                    semesterSections.map(async (section, index) => {
                        const course = courses[index];
                        const sectionEnrollments = semesterEnrollments.filter(e => e.sectionId === section._id);
                        const averageGrade = await calculateSectionAverageGrade(ctx, section._id);

                        return {
                            courseCode: course?.code || "Unknown",
                            courseName: course?.name || "Unknown",
                            enrolledStudents: sectionEnrollments.length,
                            maxCapacity: section.capacity,
                            utilizationRate: section.capacity > 0 ? (sectionEnrollments.length / section.capacity) * 100 : 0,
                            averageGrade,
                        };
                    })
                );

                const totalEnrolled = semesterEnrollments.length;
                const totalCapacity = semesterSections.reduce((sum, s) => sum + s.capacity, 0);
                const overallUtilization = totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0;

                return {
                    semester: {
                        _id: semester._id,
                        name: `${semester.year}-${semester.period}`,
                        startDate: semester.startDate,
                        endDate: semester.endDate,
                    },
                    sectionsCount: semesterSections.length,
                    totalEnrolled,
                    overallUtilization,
                    sections: sectionDetails,
                };
            })
        );

        return {
            professor: {
                _id: professor._id,
                name: professor.name,
                email: professor.email,
            },
            semesterMetrics: semesterMetrics.sort((a, b) => b.semester.startDate - a.semester.startDate),
        };
    },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate current grade for an enrollment
 */
async function calculateCurrentGradeForEnrollment(
    ctx: any,
    enrollmentId: Id<"enrollments">,
    section: any
): Promise<number> {
    if (!section) return 0;

    // Get all activities for this section
    const allActivities = await ctx.db
        .query("activities")
        .collect();
    const activities = allActivities.filter((a: any) => a.sectionId === section._id);

    // Get grades for this enrollment
    const allGrades = await ctx.db
        .query("grades")
        .collect();
    const grades = allGrades.filter((g: any) => g.enrollmentId === enrollmentId);

    const gradeMap = new Map(grades.map((grade: any) => [grade.activityId, grade]));

    // Simple weighted average calculation
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const activity of activities) {
        const grade = gradeMap.get(activity._id);
        if (grade) {
            const scorePercentage = ((grade as any).score / activity.maxPoints) * 100;
            const gradeOnScale = (scorePercentage / 100) * 5; // Convert to 0-5 scale
            totalWeightedScore += gradeOnScale * (activity.weight / 100);
            totalWeight += activity.weight / 100;
        }
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}

/**
 * Calculate semester GPA from courses
 */
function calculateSemesterGPA(courses: any[]): number {
    const gradedCourses = courses.filter(c => c.finalGrade !== null && c.finalGrade !== undefined);

    if (gradedCourses.length === 0) return 0;

    const totalGradePoints = gradedCourses.reduce((sum, course) => {
        return sum + (course.finalGrade * course.credits);
    }, 0);

    const totalCredits = gradedCourses.reduce((sum, course) => sum + course.credits, 0);

    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
}

/**
 * Calculate overall GPA across all semesters
 */
function calculateOverallGPA(semesterProgress: any[]): number {
    let totalGradePoints = 0;
    let totalCredits = 0;

    for (const semester of semesterProgress) {
        const gradedCourses = semester.courses.filter((c: any) =>
            c.finalGrade !== null && c.finalGrade !== undefined
        );

        for (const course of gradedCourses) {
            totalGradePoints += course.finalGrade * course.credits;
            totalCredits += course.credits;
        }
    }

    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
}

/**
 * Calculate average grade for a section
 */
async function calculateSectionAverageGrade(ctx: any, sectionId: Id<"sections">): Promise<number> {
    const allEnrollments = await ctx.db
        .query("enrollments")
        .collect();

    const enrollments = allEnrollments.filter((e: any) =>
        e.sectionId === sectionId &&
        e.status === "enrolled" &&
        e.finalGrade !== null &&
        e.finalGrade !== undefined
    );

    if (enrollments.length === 0) return 0;

    const totalGrade = enrollments.reduce((sum: number, e: any) => sum + (e.finalGrade || 0), 0);
    return totalGrade / enrollments.length;
}
