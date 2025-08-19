// ################################################################################
// # File: admin.ts                                                               #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Administrative functions for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
} from "./types";
import {
    requireAuth,
    requireRole,
} from "./helpers";

// ============================================================================
// SYSTEM STATISTICS
// ============================================================================

/**
 * Get system statistics (Admin)
 */
export const getSystemStats = query({
    args: {},
    handler: async (ctx) => {
        await requireRole(ctx, "admin");

        // Count users by role
        const allUsers = await ctx.db.query("users").collect();
        const userStats = {
            total: allUsers.length,
            students: allUsers.filter(u => u.role === "student").length,
            professors: allUsers.filter(u => u.role === "professor").length,
            admins: allUsers.filter(u => u.role === "admin").length,
        };

        // Count programs and courses
        const [programs, courses, periods, sections] = await Promise.all([
            ctx.db.query("programs").collect(),
            ctx.db.query("courses").collect(),
            ctx.db.query("periods").collect(),
            ctx.db.query("sections").collect(),
        ]);

        // Students by program
        const studentsByProgram = new Map();
        for (const user of allUsers.filter(u => u.role === "student" && u.studentProfile)) {
            const programId = user.studentProfile!.programId;
            if (!studentsByProgram.has(programId)) {
                const program = await ctx.db.get(programId);
                studentsByProgram.set(programId, {
                    program,
                    count: 0,
                    active: 0,
                    graduated: 0,
                });
            }
            const data = studentsByProgram.get(programId);
            data.count++;
            if (user.studentProfile!.status === "active") data.active++;
            if (user.studentProfile!.status === "graduated") data.graduated++;
        }

        // Calculate average GPAs
        const enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("status"), "completed"))
            .collect();

        const totalGrades = enrollments.reduce((sum, e) => sum + (e.effectiveGrade || 0), 0);
        const averageGPA = enrollments.length > 0 ? totalGrades / enrollments.length : 0;

        return {
            users: userStats,
            programs: {
                total: programs.length,
                byProgram: Array.from(studentsByProgram.values()),
            },
            courses: {
                total: courses.length,
                byCategory: {
                    humanities: courses.filter(c => c.category === "humanities").length,
                    core: courses.filter(c => c.category === "core").length,
                    elective: courses.filter(c => c.category === "elective").length,
                },
            },
            periods: {
                total: periods.length,
                current: periods.filter(p => p.status === "active").length,
            },
            sections: {
                total: sections.length,
                active: sections.filter(s => s.isActive).length,
            },
            academics: {
                totalEnrollments: enrollments.length,
                averageGPA: parseFloat(averageGPA.toFixed(2)),
                completionRate: enrollments.length > 0
                    ? (enrollments.filter(e => (e.effectiveGrade || 0) >= 3.0).length / enrollments.length) * 100
                    : 0,
            },
        };
    },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk create students from CSV data (Admin)
 */
export const bulkCreateStudents = mutation({
    args: {
        students: v.array(v.object({
            email: v.string(),
            name: v.string(),
            studentCode: v.string(),
            programId: v.id("programs"),
            country: v.optional(v.string()),
            phone: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const results = {
            successful: 0,
            failed: [] as { email: string; reason: string }[],
        };

        for (const studentData of args.students) {
            try {
                // Check if email already exists in accessList
                const existingAccess = await ctx.db
                    .query("accessList")
                    .withIndex("by_email_unused", q => q.eq("email", studentData.email))
                    .first();

                if (existingAccess) {
                    results.failed.push({
                        email: studentData.email,
                        reason: "Email already in access list",
                    });
                    continue;
                }

                // Check if student code already exists
                const existingCode = await ctx.db
                    .query("userTemplates")
                    .filter(q => q.eq(q.field("studentCode"), studentData.studentCode))
                    .first();

                if (existingCode) {
                    results.failed.push({
                        email: studentData.email,
                        reason: "Student code already exists",
                    });
                    continue;
                }

                // Verify program exists
                const program = await ctx.db.get(studentData.programId);
                if (!program) {
                    results.failed.push({
                        email: studentData.email,
                        reason: "Program not found",
                    });
                    continue;
                }

                // Add to access list
                await ctx.db.insert("accessList", {
                    email: studentData.email,
                    role: "student" as const,
                    isUsed: false,
                    createdBy: (await requireAuth(ctx))._id,
                    createdAt: Date.now(),
                });

                // Create user template
                await ctx.db.insert("userTemplates", {
                    email: studentData.email,
                    name: studentData.name,
                    country: studentData.country,
                    phone: studentData.phone,
                    programId: studentData.programId,
                    studentCode: studentData.studentCode,
                    createdBy: (await requireAuth(ctx))._id,
                    createdAt: Date.now(),
                });

                results.successful++;
            } catch (error) {
                results.failed.push({
                    email: studentData.email,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        return {
            ...results,
            message: `Pre-registered ${results.successful} students, ${results.failed.length} failed`,
        };
    },
});

/**
 * Generate period rankings (Admin) - Dynamic calculation
 */
export const generatePeriodRankings = mutation({
    args: {
        periodId: v.id("periods"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Get all students with enrollments in this period
        const enrollments = await ctx.db
            .query("enrollments")
            .filter(q =>
                q.and(
                    q.eq(q.field("periodId"), args.periodId),
                    q.eq(q.field("status"), "completed")
                )
            )
            .collect();

        // Group by student and calculate period GPA
        const studentGPAs = new Map();

        for (const enrollment of enrollments) {
            if (!studentGPAs.has(enrollment.studentId)) {
                const student = await ctx.db.get(enrollment.studentId);
                studentGPAs.set(enrollment.studentId, {
                    student,
                    grades: [],
                    totalCredits: 0,
                    weightedSum: 0,
                });
            }

            const data = studentGPAs.get(enrollment.studentId);
            const course = await ctx.db.get(enrollment.courseId);
            const credits = course?.credits || 0;
            const grade = enrollment.effectiveGrade || 0;

            data.grades.push({ grade, credits });
            data.totalCredits += credits;
            data.weightedSum += grade * credits;
        }

        // Calculate GPAs and sort
        const rankings = Array.from(studentGPAs.entries())
            .map(([studentId, data]) => ({
                studentId,
                student: data.student,
                periodGPA: data.totalCredits > 0 ? data.weightedSum / data.totalCredits : 0,
                totalCredits: data.totalCredits,
            }))
            .sort((a, b) => b.periodGPA - a.periodGPA)
            .map((entry, index) => ({
                ...entry,
                rank: index + 1,
                periodGPA: parseFloat(entry.periodGPA.toFixed(2)),
            }));

        return {
            periodId: args.periodId,
            rankings,
            generatedAt: Date.now(),
            totalStudents: rankings.length,
        };
    },
});

/**
 * Close period (Admin)
 */
export const closePeriod = mutation({
    args: {
        periodId: v.id("periods"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new AppError("Period not found", ErrorCodes.USER_NOT_FOUND);
        }

        // Check if all sections have submitted grades
        const sections = await ctx.db
            .query("sections")
            .filter(q => q.eq(q.field("periodId"), args.periodId))
            .collect();

        const pendingSections = sections.filter(s => !s.gradesSubmitted);

        if (pendingSections.length > 0) {
            throw new AppError(
                `Cannot close period: ${pendingSections.length} sections have not submitted grades`,
                ErrorCodes.INVALID_INPUT
            );
        }

        // Close the period
        await ctx.db.patch(args.periodId, {
            status: "closed" as const,
        });

        return {
            success: true,
            message: `Period ${period.name} closed successfully`,
            sectionsProcessed: sections.length,
        };
    },
});
