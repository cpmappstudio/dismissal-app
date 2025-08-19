import { v } from "convex/values";
import { query } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
    type ProfessorClass,
    type ProfessorPeriodView,
} from "./types";
import {
    requireRole,
    getCurrentPeriod,
} from "./helpers";

// ============================================================================
// PROFESSOR DASHBOARD QUERIES
// ============================================================================

/**
 * Get professor dashboard for current period
 */
export const getProfessorDashboard = query({
    args: {},
    handler: async (ctx) => {
        const professor = await requireRole(ctx, "professor");

        const currentPeriod = await getCurrentPeriod(ctx);
        if (!currentPeriod) {
            return {
                professor,
                currentPeriod: null,
                classes: [],
                totalStudents: 0,
                pendingGrades: 0,
            };
        }

        // Get professor's sections for current period
        const sections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", (q) =>
                q.eq("professorId", professor._id).eq("periodId", currentPeriod._id)
            )
            .collect();

        // Build classes with student data
        const classes: ProfessorClass[] = [];
        let totalStudents = 0;
        let pendingGrades = 0;

        for (const section of sections) {
            const [course, enrollments] = await Promise.all([
                ctx.db.get(section.courseId),
                ctx.db
                    .query("enrollments")
                    .withIndex("by_section", (q) => q.eq("sectionId", section._id))
                    .collect()
            ]);

            if (!course) continue;

            // Get students for this section
            const students = [];
            let sectionPendingGrades = 0;

            for (const enrollment of enrollments) {
                const student = await ctx.db.get(enrollment.studentId);
                if (student) {
                    students.push({
                        student,
                        enrollment,
                        currentGrade: enrollment.finalGrade || null,
                        makeupGrade: enrollment.makeupGrade || null,
                        status: enrollment.status,
                    });

                    // Count pending grades (enrolled students without final grade)
                    if (enrollment.status === "enrolled" && !enrollment.finalGrade) {
                        sectionPendingGrades++;
                    }
                }
            }

            classes.push({
                section,
                course,
                period: currentPeriod,
                students,
                scheduleNote: section.scheduleNote,
                gradesSubmitted: section.gradesSubmitted,
            });

            totalStudents += students.length;
            pendingGrades += sectionPendingGrades;
        }

        return {
            professor,
            currentPeriod,
            classes,
            totalStudents,
            pendingGrades,
        };
    },
});

/**
 * Get detailed class list for a specific section
 */
export const getClassList = query({
    args: {
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const professor = await requireRole(ctx, "professor");

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError("Section not found", ErrorCodes.SECTION_NOT_FOUND);
        }

        // Verify professor owns this section
        if (section.professorId !== professor._id) {
            throw new AppError("Not authorized for this section", ErrorCodes.UNAUTHORIZED);
        }

        const [course, period, enrollments] = await Promise.all([
            ctx.db.get(section.courseId),
            ctx.db.get(section.periodId),
            ctx.db
                .query("enrollments")
                .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
                .collect()
        ]);

        if (!course || !period) {
            throw new AppError("Course or period not found", ErrorCodes.COURSE_NOT_FOUND);
        }

        // Get students with enrollment details
        const students = [];
        for (const enrollment of enrollments) {
            const student = await ctx.db.get(enrollment.studentId);
            if (student) {
                students.push({
                    student,
                    enrollment,
                    currentGrade: enrollment.finalGrade || null,
                    makeupGrade: enrollment.makeupGrade || null,
                    effectiveGrade: enrollment.effectiveGrade || null,
                    status: enrollment.status,
                });
            }
        }

        // Sort students by name
        students.sort((a, b) => a.student.name.localeCompare(b.student.name));

        return {
            section,
            course,
            period,
            professor,
            students,
            scheduleNote: section.scheduleNote,
            gradesSubmitted: section.gradesSubmitted,

            // Summary stats
            totalStudents: students.length,
            enrolledStudents: students.filter(s => s.status === "enrolled").length,
            gradedStudents: students.filter(s => s.currentGrade !== null).length,
        };
    },
});

/**
 * Get professor's schedule for current period
 */
export const getProfessorSchedule = query({
    args: {
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const professor = await requireRole(ctx, "professor");

        let targetPeriod;
        if (args.periodId) {
            targetPeriod = await ctx.db.get(args.periodId);
        } else {
            targetPeriod = await getCurrentPeriod(ctx);
        }

        if (!targetPeriod) {
            return {
                period: null,
                schedule: [],
            };
        }

        // Get professor's sections for the period
        const sections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", (q) =>
                q.eq("professorId", professor._id).eq("periodId", targetPeriod._id)
            )
            .collect();

        // Build schedule entries
        const schedule = [];
        for (const section of sections) {
            const course = await ctx.db.get(section.courseId);
            if (course) {
                schedule.push({
                    section,
                    course,
                    scheduleNote: section.scheduleNote,
                    enrolledCount: section.enrolled,
                    capacity: section.capacity,
                    status: section.status,
                    gradesSubmitted: section.gradesSubmitted,
                });
            }
        }

        // Sort by course code
        schedule.sort((a, b) => a.course.code.localeCompare(b.course.code));

        return {
            period: targetPeriod,
            schedule,
        };
    },
});

/**
 * Get professor's historical periods
 */
export const getProfessorPeriodHistory = query({
    args: {},
    handler: async (ctx) => {
        const professor = await requireRole(ctx, "professor");

        // Get all sections professor has taught
        const allSections = await ctx.db
            .query("sections")
            .withIndex("by_professor_period", (q) => q.eq("professorId", professor._id))
            .collect();

        // Group by period
        const periodIds = [...new Set(allSections.map(s => s.periodId))];

        const periodViews: ProfessorPeriodView[] = [];

        for (const periodId of periodIds) {
            const period = await ctx.db.get(periodId);
            if (!period) continue;

            const periodSections = allSections.filter(s => s.periodId === periodId);

            const classes: ProfessorClass[] = [];
            let totalStudents = 0;
            let pendingGrades = 0;

            for (const section of periodSections) {
                const [course, enrollments] = await Promise.all([
                    ctx.db.get(section.courseId),
                    ctx.db
                        .query("enrollments")
                        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
                        .collect()
                ]);

                if (!course) continue;

                const students = [];
                for (const enrollment of enrollments) {
                    const student = await ctx.db.get(enrollment.studentId);
                    if (student) {
                        students.push({
                            student,
                            enrollment,
                            currentGrade: enrollment.finalGrade || null,
                            makeupGrade: enrollment.makeupGrade || null,
                            status: enrollment.status,
                        });

                        if (enrollment.status === "enrolled" && !enrollment.finalGrade) {
                            pendingGrades++;
                        }
                    }
                }

                classes.push({
                    section,
                    course,
                    period,
                    students,
                    scheduleNote: section.scheduleNote,
                    gradesSubmitted: section.gradesSubmitted,
                });

                totalStudents += students.length;
            }

            periodViews.push({
                period,
                classes,
                totalStudents,
                pendingGrades,
            });
        }

        // Sort by period start date (most recent first)
        periodViews.sort((a, b) => b.period.startDate - a.period.startDate);

        return periodViews;
    },
});
