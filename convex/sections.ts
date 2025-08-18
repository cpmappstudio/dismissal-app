// ################################################################################
// # File: sections.ts                                                            #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Course section management functions
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    scheduleSlotValidator,
    sectionStatusValidator,
    ErrorCodes,
    AppError,
    type SectionWithDetails,
    type SectionAvailability,
} from "./types";
import {
    requireAuth,
    requireRole,
    isCRNTaken,
    getSectionWithDetails,
    hasAvailableCapacity,
} from "./helpers";

// ============================================================================
// SECTION QUERIES
// ============================================================================

/**
 * Get professor's sections for a semester with enriched data
 */
export const getProfessorSections = query({
    args: {
        professorId: v.id("users"),
        semesterId: v.id("semesters"),
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

        const sections = await ctx.db
            .query("sections")
            .withIndex("by_professor_semester", (q) =>
                q.eq("professorId", args.professorId).eq("semesterId", args.semesterId)
            )
            .collect();

        // Enrich with course details and enrollment count
        const enrichedSections = await Promise.all(
            sections.map(async (section): Promise<SectionWithDetails> => {
                const course = await ctx.db.get(section.courseId);
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section_status", (q) =>
                        q.eq("sectionId", section._id).eq("status", "enrolled")
                    )
                    .collect();

                return {
                    section,
                    course,
                    enrollments,
                    enrolledCount: enrollments.length,
                };
            })
        );

        return enrichedSections;
    },
});

/**
 * Get section by ID with complete details
 */
export const getSectionById = query({
    args: {
        sectionId: v.id("sections")
    },
    handler: async (ctx, args) => {
        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        const [course, professor, semester, enrollments] = await Promise.all([
            ctx.db.get(section.courseId),
            ctx.db.get(section.professorId),
            ctx.db.get(section.semesterId),
            ctx.db
                .query("enrollments")
                .withIndex("by_section_status", (q) =>
                    q.eq("sectionId", args.sectionId).eq("status", "enrolled")
                )
                .collect(),
        ]);

        return {
            section,
            course,
            professor,
            semester,
            enrollments,
            enrolledCount: enrollments.length,
            availableSlots: section.capacity - enrollments.length,
        };
    },
});

/**
 * Get available sections for enrollment
 */
export const getAvailableSections = query({
    args: {
        semesterId: v.id("semesters"),
        programId: v.optional(v.id("programs")),
        courseId: v.optional(v.id("courses")),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        let sections = await ctx.db
            .query("sections")
            .withIndex("by_semester_status", (q) =>
                q.eq("semesterId", args.semesterId).eq("status", "open")
            )
            .collect();

        // Filter by course if specified
        if (args.courseId) {
            sections = sections.filter(s => s.courseId === args.courseId);
        }

        // Filter by program if specified
        if (args.programId) {
            const programCourses = await ctx.db
                .query("courses")
                .withIndex("by_program_active", (q) =>
                    q.eq("programId", args.programId!).eq("isActive", true)
                )
                .collect();
            const courseIds = new Set(programCourses.map(c => c._id));
            sections = sections.filter(s => courseIds.has(s.courseId));
        }

        // Enrich with details and availability
        const enrichedSections = await Promise.all(
            sections.map(async (section): Promise<SectionAvailability> => {
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section_status", (q) =>
                        q.eq("sectionId", section._id).eq("status", "enrolled")
                    )
                    .collect();

                const enrolled = enrollments.length;

                return {
                    section,
                    available: enrolled < section.capacity,
                    capacity: section.capacity,
                    enrolled,
                    waitlistAvailable: false, // TODO: Implement waitlist
                };
            })
        );

        return enrichedSections;
    },
});

/**
 * Get sections by course
 */
export const getSectionsByCourse = query({
    args: {
        courseId: v.id("courses"),
        semesterId: v.optional(v.id("semesters")),
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        let sections = await ctx.db
            .query("sections")
            .filter((q) => q.eq(q.field("courseId"), args.courseId))
            .collect();

        // Filter by semester
        if (args.semesterId) {
            sections = sections.filter(s => s.semesterId === args.semesterId);
        }

        // Filter by status
        if (!args.includeInactive) {
            sections = sections.filter(s =>
                ["open", "active"].includes(s.status)
            );
        }

        // Enrich with details
        const enrichedSections = await Promise.all(
            sections.map(async (section) => {
                const [professor, enrollments] = await Promise.all([
                    ctx.db.get(section.professorId),
                    ctx.db
                        .query("enrollments")
                        .withIndex("by_section_status", (q) =>
                            q.eq("sectionId", section._id).eq("status", "enrolled")
                        )
                        .collect(),
                ]);

                return {
                    ...section,
                    professor,
                    enrolledCount: enrollments.length,
                    availableSlots: section.capacity - enrollments.length,
                };
            })
        );

        return enrichedSections;
    },
});

/**
 * Get semester schedule for a user (student or professor)
 */
export const getUserSchedule = query({
    args: {
        userId: v.id("users"),
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Users can only see their own schedule, admins can see any
        if (currentUser.role !== "admin" && currentUser._id !== args.userId) {
            throw new AppError(
                "Not authorized to view schedule for this user",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError(
                "User not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        let sections;

        if (user.role === "student") {
            // Get student's enrolled sections
            const enrollments = await ctx.db
                .query("enrollments")
                .withIndex("by_student_semester", (q) =>
                    q.eq("studentId", args.userId).eq("semesterId", args.semesterId)
                )
                .filter((q) => q.eq(q.field("status"), "enrolled"))
                .collect();

            sections = await Promise.all(
                enrollments.map(e => ctx.db.get(e.sectionId))
            );
        } else if (user.role === "professor") {
            // Get professor's sections
            sections = await ctx.db
                .query("sections")
                .withIndex("by_professor_semester", (q) =>
                    q.eq("professorId", args.userId).eq("semesterId", args.semesterId)
                )
                .filter((q) =>
                    q.or(
                        q.eq(q.field("status"), "active"),
                        q.eq(q.field("status"), "open")
                    )
                )
                .collect();
        } else {
            return []; // Admins don't have schedules
        }

        // Enrich with course details
        const enrichedSections = await Promise.all(
            (sections.filter(s => s !== null) as Doc<"sections">[]).map(async (section) => {
                const course = await ctx.db.get(section.courseId);
                return {
                    section,
                    course,
                    schedule: section.schedule,
                };
            })
        );

        return enrichedSections;
    },
});

// ============================================================================
// SECTION MUTATIONS
// ============================================================================

/**
 * Create new section with proper validation
 */
export const createSection = mutation({
    args: {
        courseId: v.id("courses"),
        semesterId: v.id("semesters"),
        sectionNumber: v.string(),
        crn: v.string(),
        professorId: v.id("users"),
        schedule: v.array(scheduleSlotValidator),
        capacity: v.number(),
        gradeWeights: v.string(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate input
        if (args.capacity <= 0) {
            throw new AppError(
                "Capacity must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Validate CRN is unique
        if (await isCRNTaken(ctx, args.crn)) {
            throw new AppError(
                `CRN '${args.crn}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Verify course exists
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        // Verify professor exists and is a professor
        const professor = await ctx.db.get(args.professorId);
        if (!professor || professor.role !== "professor") {
            throw new AppError(
                "Professor not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Verify semester exists
        const semester = await ctx.db.get(args.semesterId);
        if (!semester) {
            throw new AppError(
                "Semester not found",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Validate grade weights JSON
        try {
            JSON.parse(args.gradeWeights);
        } catch {
            throw new AppError(
                "Invalid grade weights format",
                ErrorCodes.INVALID_INPUT
            );
        }

        const sectionId = await ctx.db.insert("sections", {
            ...args,
            enrolled: 0,
            status: "draft" as const,
        });

        return {
            sectionId,
            message: `Section ${args.sectionNumber} created successfully`
        };
    },
});

/**
 * Update section status
 */
export const updateSectionStatus = mutation({
    args: {
        sectionId: v.id("sections"),
        status: sectionStatusValidator,
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Validate status transitions
        const validTransitions: Record<typeof section.status, typeof args.status[]> = {
            draft: ["open", "closed"],
            open: ["active", "closed"],
            closed: ["open"],
            active: ["finished"],
            finished: [],
        };

        if (!validTransitions[section.status].includes(args.status)) {
            throw new AppError(
                `Cannot transition from ${section.status} to ${args.status}`,
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(args.sectionId, { status: args.status });

        return {
            success: true,
            message: `Section status updated to ${args.status}`
        };
    },
});

/**
 * Update section capacity
 */
export const updateSectionCapacity = mutation({
    args: {
        sectionId: v.id("sections"),
        capacity: v.number(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        if (args.capacity <= 0) {
            throw new AppError(
                "Capacity must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Check if new capacity is less than current enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section_status", (q) =>
                q.eq("sectionId", args.sectionId).eq("status", "enrolled")
            )
            .collect();

        if (args.capacity < enrollments.length) {
            throw new AppError(
                `Cannot reduce capacity below current enrollment count (${enrollments.length})`,
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(args.sectionId, { capacity: args.capacity });

        return {
            success: true,
            message: `Section capacity updated to ${args.capacity}`
        };
    },
});

/**
 * Update section schedule
 */
export const updateSectionSchedule = mutation({
    args: {
        sectionId: v.id("sections"),
        schedule: v.array(scheduleSlotValidator),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only admins or the assigned professor can update schedule
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to update this section's schedule",
                ErrorCodes.UNAUTHORIZED
            );
        }

        await ctx.db.patch(args.sectionId, { schedule: args.schedule });

        return {
            success: true,
            message: "Section schedule updated successfully"
        };
    },
});

/**
 * Update grade weights for a section
 */
export const updateSectionGradeWeights = mutation({
    args: {
        sectionId: v.id("sections"),
        gradeWeights: v.string(),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only admins or the assigned professor can update grade weights
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to update this section's grade weights",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate grade weights JSON
        try {
            JSON.parse(args.gradeWeights);
        } catch {
            throw new AppError(
                "Invalid grade weights format",
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(args.sectionId, { gradeWeights: args.gradeWeights });

        return {
            success: true,
            message: "Section grade weights updated successfully"
        };
    },
});

/**
 * Clone section to another semester
 */
export const cloneSection = mutation({
    args: {
        sectionId: v.id("sections"),
        targetSemesterId: v.id("semesters"),
        newCrn: v.string(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const originalSection = await ctx.db.get(args.sectionId);
        if (!originalSection) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Validate new CRN is unique
        if (await isCRNTaken(ctx, args.newCrn)) {
            throw new AppError(
                `CRN '${args.newCrn}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Verify target semester exists
        const semester = await ctx.db.get(args.targetSemesterId);
        if (!semester) {
            throw new AppError(
                "Target semester not found",
                ErrorCodes.INVALID_INPUT
            );
        }

        const newSectionId = await ctx.db.insert("sections", {
            courseId: originalSection.courseId,
            semesterId: args.targetSemesterId,
            sectionNumber: originalSection.sectionNumber,
            crn: args.newCrn,
            professorId: originalSection.professorId,
            schedule: originalSection.schedule,
            capacity: originalSection.capacity,
            gradeWeights: originalSection.gradeWeights,
            enrolled: 0,
            status: "draft" as const,
        });

        return {
            sectionId: newSectionId,
            message: "Section cloned successfully"
        };
    },
});

// ============================================================================
// SECTION ANALYTICS
// ============================================================================

/**
 * Get section enrollment statistics
 */
export const getSectionStatistics = query({
    args: {
        sectionId: v.id("sections")
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only admins or the assigned professor can view section statistics
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to view this section's statistics",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const enrollments = await ctx.db
            .query("enrollments")
            .filter((q) => q.eq(q.field("sectionId"), args.sectionId))
            .collect();

        const enrolled = enrollments.filter(e => e.status === "enrolled").length;
        const dropped = enrollments.filter(e => e.status === "dropped").length;
        const completed = enrollments.filter(e => e.status === "completed").length;

        return {
            section,
            capacity: section.capacity,
            enrolled,
            dropped,
            completed,
            availableSlots: section.capacity - enrolled,
            utilizationRate: (enrolled / section.capacity) * 100,
            dropRate: enrollments.length > 0 ? (dropped / enrollments.length) * 100 : 0,
        };
    },
});
