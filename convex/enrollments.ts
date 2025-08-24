// ################################################################################
// # File: enrollments.ts                                                        # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Enrollment management - student registration in course sections
 * Handles enrollment validation, prerequisites, capacity checks
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
    getUserByClerkId,
    getCurrentPeriod,
    validateEnrollment,
    validatePrerequisites,
    hasAvailableCapacity,
    isEnrollmentOpen
} from "./helpers";

/**
 * Get available sections for enrollment
 */
export const getAvailableSections = query({
    args: {
        periodId: v.optional(v.id("periods")),
        programId: v.optional(v.id("programs")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || user.role !== "student" || !user.studentProfile) {
            throw new ConvexError("Student access required");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Check if enrollment is open
        if (!isEnrollmentOpen(targetPeriod)) {
            throw new ConvexError("Enrollment is not currently open");
        }

        // Get target program (student's program or specified)
        const targetProgramId = args.programId || user.studentProfile.programId;

        // Get available courses for the program
        const programCourses = await ctx.db
            .query("program_courses")
            .withIndex("by_program_course", q => q.eq("programId", targetProgramId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        const courseIds = programCourses.map(pc => pc.courseId);

        // Get sections for the period
        const allSections = await ctx.db
            .query("sections")
            .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
            .filter(q => q.eq(q.field("status"), "open"))
            .collect();

        // Filter sections for program courses
        const availableSections = allSections.filter(section =>
            courseIds.includes(section.courseId)
        );

        // Get section details with enrollment info
        const sectionDetails = await Promise.all(
            availableSections.map(async (section) => {
                const [course, professor] = await Promise.all([
                    ctx.db.get(section.courseId),
                    ctx.db.get(section.professorId),
                ]);

                // Check if student is already enrolled
                const existingEnrollment = await ctx.db
                    .query("enrollments")
                    .withIndex("by_student_section", q =>
                        q.eq("studentId", user._id).eq("sectionId", section._id))
                    .first();

                // Validate prerequisites
                const prereqValidation = course ?
                    await validatePrerequisites(ctx.db, user._id, course._id) : null;

                return {
                    section,
                    course,
                    professor,
                    isEnrolled: !!existingEnrollment,
                    hasCapacity: hasAvailableCapacity(section),
                    canEnroll: !existingEnrollment && hasAvailableCapacity(section) &&
                        (prereqValidation?.isValid || false),
                    prerequisiteInfo: prereqValidation,
                };
            })
        );

        return {
            period: targetPeriod,
            sections: sectionDetails,
        };
    },
});

/**
 * Enroll student in a section
 */
export const enrollInSection = mutation({
    args: {
        sectionId: v.id("sections"),
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

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        const course = await ctx.db.get(section.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        const period = await ctx.db.get(section.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Validate enrollment
        const validation = await validateEnrollment(ctx.db, user._id, args.sectionId);
        if (!validation.canEnroll) {
            throw new ConvexError(`Enrollment failed: ${validation.reasons.join(", ")}`);
        }

        // Check section capacity
        if (!hasAvailableCapacity(section)) {
            throw new ConvexError("Section is at full capacity");
        }

        // Check if enrollment period is open
        if (!isEnrollmentOpen(period)) {
            throw new ConvexError("Enrollment period is closed");
        }

        // Create enrollment record
        const enrollmentId = await ctx.db.insert("enrollments", {
            studentId: user._id,
            sectionId: args.sectionId,
            periodId: section.periodId,
            courseId: section.courseId,
            professorId: section.professorId,
            enrolledAt: Date.now(),
            status: "enrolled",
            isRetake: false,
            isAuditing: false,
            countsForGPA: true,
            countsForProgress: true,
            createdAt: Date.now(),
        });

        // Update section enrollment count
        await ctx.db.patch(args.sectionId, {
            enrolled: section.enrolled + 1,
            updatedAt: Date.now(),
        });

        return {
            enrollmentId,
            message: "Successfully enrolled in course",
        };
    },
});

/**
 * Withdraw from a section
 */
export const withdrawFromSection = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        reason: v.optional(v.string()),
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

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new ConvexError("Enrollment not found");
        }

        // Verify ownership
        if (enrollment.studentId !== user._id) {
            throw new ConvexError("You can only withdraw from your own enrollments");
        }

        // Check current status
        if (enrollment.status !== "enrolled") {
            throw new ConvexError("Cannot withdraw from this enrollment");
        }

        const period = await ctx.db.get(enrollment.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        // Determine if it's withdrawal or drop based on deadline
        const now = Date.now();
        const isWithdrawal = period.withdrawalDeadline && now <= period.withdrawalDeadline;
        const newStatus = isWithdrawal ? "withdrawn" : "dropped";

        // Update enrollment status
        await ctx.db.patch(args.enrollmentId, {
            status: newStatus,
            statusChangedAt: now,
            statusChangedBy: user._id,
            statusChangeReason: args.reason,
            updatedAt: now,
        });

        // Update section enrollment count
        const section = await ctx.db.get(enrollment.sectionId);
        if (section) {
            await ctx.db.patch(enrollment.sectionId, {
                enrolled: Math.max(0, section.enrolled - 1),
                updatedAt: now,
            });
        }

        return {
            status: newStatus,
            message: `Successfully ${newStatus} from course`,
        };
    },
});

/**
 * Validate if student can enroll in a section
 */
export const validateSectionEnrollment = query({
    args: {
        sectionId: v.id("sections"),
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

        const validation = await validateEnrollment(ctx.db, user._id, args.sectionId);
        const section = await ctx.db.get(args.sectionId);

        if (!section) {
            return { isValid: false, reason: "Section not found" };
        }

        const course = await ctx.db.get(section.courseId);
        if (!course) {
            return { isValid: false, reason: "Course not found" };
        }

        // Check prerequisites
        const prereqValidation = await validatePrerequisites(ctx.db, user._id, course._id);

        return {
            ...validation,
            prerequisiteValidation: prereqValidation,
            hasCapacity: hasAvailableCapacity(section),
            section,
            course,
        };
    },
});

/**
 * Get student's enrollment history
 */
export const getEnrollmentHistory = query({
    args: {
        studentId: v.optional(v.id("users")), // Admin can specify student
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
            // Admin can view any student's history
            if (user.role !== "admin" && user.role !== "superadmin") {
                throw new ConvexError("Admin access required to view other students");
            }
            targetStudentId = args.studentId;
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required");
        }

        // Get all enrollments for the student
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q => q.eq("studentId", targetStudentId))
            .collect();

        // Group enrollments by period
        const enrollmentsByPeriod = new Map();

        for (const enrollment of enrollments) {
            const [period, course, section, professor] = await Promise.all([
                ctx.db.get(enrollment.periodId),
                ctx.db.get(enrollment.courseId),
                ctx.db.get(enrollment.sectionId),
                ctx.db.get(enrollment.professorId),
            ]);

            const periodKey = enrollment.periodId;
            if (!enrollmentsByPeriod.has(periodKey)) {
                enrollmentsByPeriod.set(periodKey, {
                    period,
                    enrollments: [],
                });
            }

            enrollmentsByPeriod.get(periodKey).enrollments.push({
                enrollment,
                course,
                section,
                professor,
            });
        }

        // Convert to array and sort by period
        const history = Array.from(enrollmentsByPeriod.values())
            .sort((a, b) => (b.period?.year || 0) - (a.period?.year || 0) ||
                (b.period?.bimesterNumber || 0) - (a.period?.bimesterNumber || 0));

        return {
            studentId: targetStudentId,
            history,
            summary: {
                totalEnrollments: enrollments.length,
                completedCourses: enrollments.filter(e => e.status === "completed").length,
                withdrawnCourses: enrollments.filter(e => e.status === "withdrawn").length,
                droppedCourses: enrollments.filter(e => e.status === "dropped").length,
                failedCourses: enrollments.filter(e => e.status === "failed").length,
            },
        };
    },
});
