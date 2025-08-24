// ################################################################################
// # File: admin.ts                                                              # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Administrative functions for system management
 * Handles user administration, program management, period management, and system analytics
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
    getUserByClerkId,
    getActiveStudentsCount,
    getActiveProfessorsCount,
    getActiveCoursesCount,
    getActiveProgramsCount
} from "./helpers";
import { roleValidator, periodStatusValidator, academicStandingValidator } from "./types";

/**
 * Get all users with filtering options (Admin only)
 */
export const getAllUsers = query({
    args: {
        role: v.optional(roleValidator),
        isActive: v.optional(v.boolean()),
        searchTerm: v.optional(v.string()),
        programId: v.optional(v.id("programs")), // For filtering students by program
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        let users: any[];

        // Apply role and active filters with index if both provided
        if (args.role !== undefined && args.isActive !== undefined) {
            users = await ctx.db
                .query("users")
                .withIndex("by_role_active", q =>
                    q.eq("role", args.role!).eq("isActive", args.isActive!))
                .collect();
        } else {
            users = await ctx.db.query("users").collect();
        }

        // Apply additional filters
        if (args.role !== undefined && args.isActive === undefined) {
            users = users.filter(user => user.role === args.role);
        }
        if (args.isActive !== undefined && args.role === undefined) {
            users = users.filter(user => user.isActive === args.isActive);
        }

        // Filter by program (for students)
        if (args.programId && args.role === "student") {
            users = users.filter(user =>
                user.studentProfile?.programId === args.programId);
        }

        // Apply search term filter
        if (args.searchTerm) {
            const searchLower = args.searchTerm.toLowerCase();
            users = users.filter(user =>
                user.firstName.toLowerCase().includes(searchLower) ||
                user.lastName.toLowerCase().includes(searchLower) ||
                user.email.toLowerCase().includes(searchLower) ||
                (user.studentProfile?.studentCode?.toLowerCase().includes(searchLower)) ||
                (user.professorProfile?.employeeCode?.toLowerCase().includes(searchLower))
            );
        }

        // Apply limit
        if (args.limit) {
            users = users.slice(0, args.limit);
        }

        // Get additional info for each user
        const usersWithDetails = await Promise.all(
            users.map(async (user) => {
                let additionalInfo = null;

                if (user.role === "student" && user.studentProfile) {
                    const program = await ctx.db.get(user.studentProfile.programId) as Doc<"programs"> | null;
                    additionalInfo = {
                        program: program ? {
                            _id: program._id,
                            code: program.code,
                            nameEs: program.nameEs,
                            type: program.type,
                        } : null,
                        studentCode: user.studentProfile.studentCode,
                        status: user.studentProfile.status,
                        academicStanding: user.studentProfile.academicStanding,
                    };
                }

                return {
                    ...user,
                    additionalInfo,
                };
            })
        );

        return usersWithDetails;
    },
});

/**
 * Create new academic period (Admin only)
 */
export const createPeriod = mutation({
    args: {
        code: v.string(),
        year: v.number(),
        bimesterNumber: v.number(),
        nameEs: v.string(),
        nameEn: v.optional(v.string()),
        startDate: v.number(),
        endDate: v.number(),
        enrollmentStart: v.number(),
        enrollmentEnd: v.number(),
        addDropDeadline: v.optional(v.number()),
        withdrawalDeadline: v.optional(v.number()),
        gradingStart: v.optional(v.number()),
        gradingDeadline: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        // Validate bimester number (1-6)
        if (args.bimesterNumber < 1 || args.bimesterNumber > 6) {
            throw new ConvexError("Bimester number must be between 1 and 6");
        }

        // Check for duplicate period code
        const existingPeriod = await ctx.db
            .query("periods")
            .filter(q => q.eq(q.field("code"), args.code))
            .first();

        if (existingPeriod) {
            throw new ConvexError("Period code already exists");
        }

        // Create period
        const periodId = await ctx.db.insert("periods", {
            ...args,
            status: "planning",
            isCurrentPeriod: false,
            createdAt: Date.now(),
        });

        return periodId;
    },
});

/**
 * Update period status and dates (Admin only)
 */
export const updatePeriodStatus = mutation({
    args: {
        periodId: v.id("periods"),
        status: periodStatusValidator,
        isCurrentPeriod: v.optional(v.boolean()),
        enrollmentStart: v.optional(v.number()),
        enrollmentEnd: v.optional(v.number()),
        gradingStart: v.optional(v.number()),
        gradingDeadline: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // If marking as current period, unmark others first
        if (args.isCurrentPeriod) {
            const currentPeriods = await ctx.db
                .query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .collect();

            for (const p of currentPeriods) {
                await ctx.db.patch(p._id, { isCurrentPeriod: false });
            }
        }

        // Update period
        const updateData: any = {
            status: args.status,
            updatedAt: Date.now(),
        };

        if (args.isCurrentPeriod !== undefined) {
            updateData.isCurrentPeriod = args.isCurrentPeriod;
        }
        if (args.enrollmentStart !== undefined) {
            updateData.enrollmentStart = args.enrollmentStart;
        }
        if (args.enrollmentEnd !== undefined) {
            updateData.enrollmentEnd = args.enrollmentEnd;
        }
        if (args.gradingStart !== undefined) {
            updateData.gradingStart = args.gradingStart;
        }
        if (args.gradingDeadline !== undefined) {
            updateData.gradingDeadline = args.gradingDeadline;
        }

        await ctx.db.patch(args.periodId, updateData);

        return args.periodId;
    },
});

/**
 * Update student's academic standing (Admin only)
 */
export const updateStudentStanding = mutation({
    args: {
        studentId: v.id("users"),
        academicStanding: academicStandingValidator,
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        const student = await ctx.db.get(args.studentId);
        if (!student || student.role !== "student" || !student.studentProfile) {
            throw new ConvexError("Student not found or invalid role");
        }

        // Update student's academic standing
        await ctx.db.patch(args.studentId, {
            studentProfile: {
                ...student.studentProfile,
                academicStanding: args.academicStanding,
            },
            updatedAt: Date.now(),
        });

        // TODO: Log the academic standing change for audit trail
        // This could be added to a separate audit log table

        return args.studentId;
    },
});

/**
 * Get comprehensive system statistics (Admin only)
 */
export const getSystemStatistics = query({
    args: {
        periodId: v.optional(v.id("periods")),
        includeHistorical: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        // Get basic counts
        const [activeStudents, activeProfessors, activeCourses, activePrograms] =
            await Promise.all([
                getActiveStudentsCount(ctx.db),
                getActiveProfessorsCount(ctx.db),
                getActiveCoursesCount(ctx.db),
                getActiveProgramsCount(ctx.db),
            ]);

        // Get period-specific data
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await ctx.db.query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

        let periodStats = null;
        if (targetPeriod) {
            const enrollments = await ctx.db
                .query("enrollments")
                .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
                .collect();

            const sections = await ctx.db
                .query("sections")
                .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
                .collect();

            periodStats = {
                period: targetPeriod,
                totalEnrollments: enrollments.length,
                activeEnrollments: enrollments.filter(e => e.status === "enrolled").length,
                completedEnrollments: enrollments.filter(e => e.status === "completed").length,
                totalSections: sections.length,
                activeSections: sections.filter(s => s.status === "active").length,
                gradedSections: sections.filter(s => s.gradesSubmitted).length,
            };
        }

        // Get user registration trends (last 6 months)
        const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
        const recentUsers = await ctx.db
            .query("users")
            .filter(q => q.gte(q.field("createdAt"), sixMonthsAgo))
            .collect();

        // Group users by month
        const usersByMonth = recentUsers.reduce((acc, user) => {
            const date = new Date(user.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!acc[monthKey]) {
                acc[monthKey] = { students: 0, professors: 0, total: 0 };
            }

            acc[monthKey].total++;
            if (user.role === "student") acc[monthKey].students++;
            if (user.role === "professor") acc[monthKey].professors++;

            return acc;
        }, {} as Record<string, { students: number; professors: number; total: number }>);

        // Get pending activations
        const pendingUsers = await ctx.db
            .query("users")
            .filter(q => q.eq(q.field("isActive"), false))
            .collect();

        return {
            userCounts: {
                activeStudents,
                activeProfessors,
                totalUsers: activeStudents + activeProfessors,
                pendingActivations: pendingUsers.length,
            },
            academicCounts: {
                activePrograms,
                activeCourses,
            },
            periodStats,
            trends: {
                usersByMonth: Object.entries(usersByMonth)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([month, counts]) => ({ month, ...counts })),
            },
            pendingActions: {
                userActivations: pendingUsers.length,
                gradeSubmissions: periodStats ?
                    periodStats.totalSections - periodStats.gradedSections : 0,
            },
        };
    },
});

/**
 * Get pending administrative actions (Admin only)
 */
export const getPendingActions = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        // Get inactive users needing activation
        const inactiveUsers = await ctx.db
            .query("users")
            .filter(q => q.eq(q.field("isActive"), false))
            .collect();

        // Get current period
        const currentPeriod = await ctx.db
            .query("periods")
            .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
            .first();

        // Get sections needing grade submission
        let sectionsNeedingGrades: any[] = [];
        if (currentPeriod) {
            const sections = await ctx.db
                .query("sections")
                .filter(q => q.eq(q.field("periodId"), currentPeriod._id))
                .filter(q => q.eq(q.field("gradesSubmitted"), false))
                .collect();

            sectionsNeedingGrades = await Promise.all(
                sections.map(async (section) => {
                    const [course, professor] = await Promise.all([
                        ctx.db.get(section.courseId),
                        ctx.db.get(section.professorId),
                    ]);

                    return { section, course, professor };
                })
            );
        }

        // Get document requests pending processing
        const pendingDocuments = await ctx.db
            .query("document_logs")
            .filter(q => q.eq(q.field("status"), "pending"))
            .collect();

        return {
            userActivations: inactiveUsers.map(user => ({
                user,
                daysSinceRegistration: Math.floor(
                    (Date.now() - user.createdAt) / (24 * 60 * 60 * 1000)
                ),
            })),
            gradeSubmissions: sectionsNeedingGrades,
            documentRequests: pendingDocuments,
            summary: {
                totalPendingUsers: inactiveUsers.length,
                totalPendingGrades: sectionsNeedingGrades.length,
                totalPendingDocuments: pendingDocuments.length,
            },
        };
    },
});

/**
 * Force enrollment (Admin only) - For administrative purposes
 */
export const forceEnrollStudent = mutation({
    args: {
        studentId: v.id("users"),
        sectionId: v.id("sections"),
        bypassPrerequisites: v.optional(v.boolean()),
        bypassCapacity: v.optional(v.boolean()),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
        }

        const student = await ctx.db.get(args.studentId);
        if (!student || student.role !== "student") {
            throw new ConvexError("Student not found or invalid role");
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Check for existing enrollment
        const existingEnrollment = await ctx.db
            .query("enrollments")
            .withIndex("by_student_section", q =>
                q.eq("studentId", args.studentId).eq("sectionId", args.sectionId))
            .first();

        if (existingEnrollment) {
            throw new ConvexError("Student is already enrolled in this section");
        }

        // Check capacity unless bypass is requested
        if (!args.bypassCapacity && section.enrolled >= section.capacity) {
            throw new ConvexError("Section is at capacity and bypass not requested");
        }

        // Create enrollment
        const enrollmentId = await ctx.db.insert("enrollments", {
            studentId: args.studentId,
            sectionId: args.sectionId,
            periodId: section.periodId,
            courseId: section.courseId,
            professorId: section.professorId,
            enrolledAt: Date.now(),
            enrolledBy: currentUser._id,
            status: "enrolled",
            isRetake: false,
            isAuditing: false,
            countsForGPA: true,
            countsForProgress: true,
            createdAt: Date.now(),
        });

        // Update section enrollment count if not bypassing capacity
        if (!args.bypassCapacity) {
            await ctx.db.patch(args.sectionId, {
                enrolled: section.enrolled + 1,
                updatedAt: Date.now(),
            });
        }

        return {
            enrollmentId,
            message: "Student force enrolled successfully",
            warnings: [
                ...(args.bypassPrerequisites ? ["Prerequisites bypassed"] : []),
                ...(args.bypassCapacity ? ["Capacity limit bypassed"] : []),
            ],
        };
    },
});

/**
 * Get enrollment statistics by program and period (Admin only)
 */
export const getEnrollmentStatistics = query({
    args: {
        periodId: v.optional(v.id("periods")),
        programId: v.optional(v.id("programs")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new ConvexError("Admin access required");
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

        // Get enrollments for the period
        const enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
            .collect();

        // Group statistics by program if not filtering by specific program
        const statsByProgram = new Map();

        for (const enrollment of enrollments) {
            const student = await ctx.db.get(enrollment.studentId);
            if (!student?.studentProfile) continue;

            // Skip if filtering by program and this doesn't match
            if (args.programId && student.studentProfile.programId !== args.programId) {
                continue;
            }

            const programId = student.studentProfile.programId;

            if (!statsByProgram.has(programId)) {
                const program = await ctx.db.get(programId);
                statsByProgram.set(programId, {
                    program,
                    enrolled: 0,
                    completed: 0,
                    withdrawn: 0,
                    failed: 0,
                    inProgress: 0,
                });
            }

            const stats = statsByProgram.get(programId);
            switch (enrollment.status) {
                case "enrolled":
                case "in_progress":
                    stats.inProgress++;
                    break;
                case "completed":
                    stats.completed++;
                    break;
                case "withdrawn":
                case "dropped":
                    stats.withdrawn++;
                    break;
                case "failed":
                    stats.failed++;
                    break;
            }
            stats.enrolled++;
        }

        const statistics = Array.from(statsByProgram.values());

        return {
            period: targetPeriod,
            statistics,
            summary: {
                totalEnrollments: enrollments.length,
                totalPrograms: statistics.length,
                totalCompleted: statistics.reduce((sum, s) => sum + s.completed, 0),
                totalWithdrawn: statistics.reduce((sum, s) => sum + s.withdrawn, 0),
                totalFailed: statistics.reduce((sum, s) => sum + s.failed, 0),
            },
        };
    },
});
