// ################################################################################
// # File: sections.ts                                                            #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/19/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Section management functions for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    ErrorCodes,
    AppError,
    type SectionWithDetails,
} from "./types";
import {
    requireAuth,
    requireRole,
    isCRNTaken,
    hasAvailableCapacity,
} from "./helpers";

// ============================================================================
// SECTION QUERIES
// ============================================================================

/**
 * Get sections by period
 */
export const getSectionsByPeriod = query({
    args: {
        periodId: v.id("periods"),
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const sections = await ctx.db
            .query("sections")
            .withIndex("by_period_status", q => q.eq("periodId", args.periodId))
            .collect();

        // Filter by status if needed
        const filteredSections = args.includeInactive
            ? sections
            : sections.filter(s => s.isActive);

        // Enrich with course and professor details
        const enrichedSections = await Promise.all(
            filteredSections.map(async (section): Promise<SectionWithDetails> => {
                const [course, professor] = await Promise.all([
                    ctx.db.get(section.courseId),
                    ctx.db.get(section.professorId),
                ]);

                return {
                    section,
                    course,
                    professor,
                    enrolledCount: section.enrolled,
                    availableSlots: section.capacity - section.enrolled,
                };
            })
        );

        return enrichedSections;
    },
});

/**
 * Get section by ID with details
 */
export const getSectionById = query({
    args: {
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError("Section not found", ErrorCodes.SECTION_NOT_FOUND);
        }

        const [course, professor, period] = await Promise.all([
            ctx.db.get(section.courseId),
            ctx.db.get(section.professorId),
            ctx.db.get(section.periodId),
        ]);

        // Get enrolled students
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .filter(q =>
                q.and(
                    q.neq(q.field("status"), "cancelled"),
                    q.neq(q.field("status"), "withdrawn")
                )
            )
            .collect();

        const students = await Promise.all(
            enrollments.map(async (enrollment) => {
                const student = await ctx.db.get(enrollment.studentId);
                return {
                    enrollment,
                    student,
                };
            })
        );

        return {
            section,
            course,
            professor,
            period,
            students,
            enrolledCount: section.enrolled,
            availableSlots: section.capacity - section.enrolled,
        };
    },
});

/**
 * Get professor's sections for period
 */
export const getProfessorSections = query({
    args: {
        professorId: v.id("users"),
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Professors can only see their own sections, admins can see any
        if (currentUser.role === "professor" && currentUser._id !== args.professorId) {
            throw new AppError(
                "Not authorized to view sections for this professor",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let sections;

        if (args.periodId) {
            sections = await ctx.db
                .query("sections")
                .filter(q =>
                    q.and(
                        q.eq(q.field("professorId"), args.professorId),
                        q.eq(q.field("periodId"), args.periodId)
                    )
                )
                .collect();
        } else {
            // Get current period sections
            const currentPeriod = await ctx.db
                .query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

            if (!currentPeriod) {
                return [];
            }

            sections = await ctx.db
                .query("sections")
                .filter(q =>
                    q.and(
                        q.eq(q.field("professorId"), args.professorId),
                        q.eq(q.field("periodId"), currentPeriod._id)
                    )
                )
                .collect();
        }

        // Enrich with course details and student lists
        const enrichedSections = await Promise.all(
            sections.map(async (section) => {
                const [course, period] = await Promise.all([
                    ctx.db.get(section.courseId),
                    ctx.db.get(section.periodId),
                ]);

                // Get enrolled students
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section", q => q.eq("sectionId", section._id))
                    .filter(q => q.eq(q.field("status"), "enrolled"))
                    .collect();

                const students = await Promise.all(
                    enrollments.map(async (enrollment) => {
                        const student = await ctx.db.get(enrollment.studentId);
                        return {
                            student,
                            enrollment,
                            finalGrade: enrollment.finalGrade,
                            makeupGrade: enrollment.makeupGrade,
                            effectiveGrade: enrollment.effectiveGrade,
                        };
                    })
                );

                return {
                    section,
                    course,
                    period,
                    students,
                    enrolledCount: section.enrolled,
                };
            })
        );

        return enrichedSections;
    },
});

// ============================================================================
// SECTION MUTATIONS (Admin only)
// ============================================================================

/**
 * Create section
 */
export const createSection = mutation({
    args: {
        courseId: v.id("courses"),
        periodId: v.id("periods"),
        groupNumber: v.string(),
        crn: v.string(),
        professorId: v.id("users"),
        capacity: v.number(),
        scheduleNote: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate capacity
        if (args.capacity <= 0) {
            throw new AppError(
                "Capacity must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Validate CRN uniqueness
        if (await isCRNTaken(ctx, args.crn)) {
            throw new AppError(
                `CRN '${args.crn}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Verify course exists
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError("Course not found", ErrorCodes.COURSE_NOT_FOUND);
        }

        // Verify professor exists and is a professor
        const professor = await ctx.db.get(args.professorId);
        if (!professor || professor.role !== "professor") {
            throw new AppError("Professor not found", ErrorCodes.USER_NOT_FOUND);
        }

        // Verify period exists
        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new AppError("Period not found", ErrorCodes.PERIOD_NOT_FOUND);
        }

        const sectionId = await ctx.db.insert("sections", {
            courseId: args.courseId,
            periodId: args.periodId,
            groupNumber: args.groupNumber,
            crn: args.crn,
            professorId: args.professorId,
            capacity: args.capacity,
            enrolled: 0,
            scheduleNote: args.scheduleNote,
            isActive: true,
            gradesSubmitted: false,
            status: "open" as const,
        });

        return {
            sectionId,
            success: true,
            message: `Section ${args.groupNumber} for ${course.name} created successfully`,
        };
    },
});
