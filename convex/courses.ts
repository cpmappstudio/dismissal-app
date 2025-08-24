// ################################################################################
// # File: courses.ts                                                            # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Course and section management functions
 * Handles course catalog, section creation, and course-program relationships
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
    getUserByClerkId,
    getCurrentPeriod,
    hasAvailableCapacity
} from "./helpers";
import {
    courseCategoryValidator,
    languageValidator,
    deliveryMethodValidator,
    sectionStatusValidator,
    scheduleSessionValidator
} from "./types";

/**
 * Get all courses with filtering options
 */
export const getAllCourses = query({
    args: {
        programId: v.optional(v.id("programs")),
        category: v.optional(courseCategoryValidator),
        language: v.optional(languageValidator),
        level: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        searchTerm: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        let courses: Doc<"courses">[];

        // Use appropriate index based on filters
        if (args.category !== undefined && args.isActive !== undefined) {
            courses = await ctx.db
                .query("courses")
                .withIndex("by_category_active", q =>
                    q.eq("category", args.category!).eq("isActive", args.isActive!))
                .collect();
        } else if (args.language !== undefined && args.isActive !== undefined) {
            courses = await ctx.db
                .query("courses")
                .withIndex("by_language_active", q =>
                    q.eq("language", args.language!).eq("isActive", args.isActive!))
                .collect();
        } else if (args.isActive !== undefined) {
            courses = await ctx.db
                .query("courses")
                .withIndex("by_active", q => q.eq("isActive", args.isActive!))
                .collect();
        } else {
            courses = await ctx.db.query("courses").collect();
        }

        // Apply additional filters
        if (args.category !== undefined && args.isActive === undefined) {
            courses = courses.filter(course => course.category === args.category);
        }
        if (args.language !== undefined && args.isActive === undefined) {
            courses = courses.filter(course => course.language === args.language);
        }
        if (args.level !== undefined) {
            courses = courses.filter(course => course.level === args.level);
        }

        // Apply search term filter
        if (args.searchTerm) {
            const searchLower = args.searchTerm.toLowerCase();
            courses = courses.filter(course =>
                course.code.toLowerCase().includes(searchLower) ||
                course.nameEs.toLowerCase().includes(searchLower) ||
                (course.nameEn?.toLowerCase().includes(searchLower))
            );
        }

        // Filter by program if specified
        if (args.programId) {
            const programCourses = await ctx.db
                .query("program_courses")
                .withIndex("by_program_course", q => q.eq("programId", args.programId!))
                .collect();

            const programCourseIds = new Set(programCourses.map(pc => pc.courseId));
            courses = courses.filter(course => programCourseIds.has(course._id));
        }

        return courses;
    },
});

/**
 * Create new course (Admin only)
 */
export const createCourse = mutation({
    args: {
        code: v.string(),
        nameEs: v.string(),
        nameEn: v.optional(v.string()),
        descriptionEs: v.string(),
        descriptionEn: v.optional(v.string()),
        credits: v.number(),
        level: v.optional(v.union(
            v.literal("introductory"),
            v.literal("intermediate"),
            v.literal("advanced"),
            v.literal("graduate")
        )),
        language: languageValidator,
        category: courseCategoryValidator,
        prerequisites: v.array(v.string()),
        corequisites: v.optional(v.array(v.string())),
        syllabus: v.optional(v.string()),
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

        // Check for duplicate course code
        const existingCourse = await ctx.db
            .query("courses")
            .withIndex("by_code", q => q.eq("code", args.code))
            .first();

        if (existingCourse) {
            throw new ConvexError("Course code already exists");
        }

        // Validate credits
        if (args.credits <= 0) {
            throw new ConvexError("Credits must be greater than 0");
        }

        // Create course
        const courseId = await ctx.db.insert("courses", {
            ...args,
            isActive: true,
            createdAt: Date.now(),
        });

        return courseId;
    },
});

/**
 * Update existing course (Admin only)
 */
export const updateCourse = mutation({
    args: {
        courseId: v.id("courses"),
        nameEs: v.optional(v.string()),
        nameEn: v.optional(v.string()),
        descriptionEs: v.optional(v.string()),
        descriptionEn: v.optional(v.string()),
        credits: v.optional(v.number()),
        level: v.optional(v.union(
            v.literal("introductory"),
            v.literal("intermediate"),
            v.literal("advanced"),
            v.literal("graduate")
        )),
        language: v.optional(languageValidator),
        category: v.optional(courseCategoryValidator),
        prerequisites: v.optional(v.array(v.string())),
        corequisites: v.optional(v.array(v.string())),
        syllabus: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
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

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        // Validate credits if provided
        if (args.credits !== undefined && args.credits <= 0) {
            throw new ConvexError("Credits must be greater than 0");
        }

        // Update course
        const updateData: any = { updatedAt: Date.now() };

        if (args.nameEs !== undefined) updateData.nameEs = args.nameEs;
        if (args.nameEn !== undefined) updateData.nameEn = args.nameEn;
        if (args.descriptionEs !== undefined) updateData.descriptionEs = args.descriptionEs;
        if (args.descriptionEn !== undefined) updateData.descriptionEn = args.descriptionEn;
        if (args.credits !== undefined) updateData.credits = args.credits;
        if (args.level !== undefined) updateData.level = args.level;
        if (args.language !== undefined) updateData.language = args.language;
        if (args.category !== undefined) updateData.category = args.category;
        if (args.prerequisites !== undefined) updateData.prerequisites = args.prerequisites;
        if (args.corequisites !== undefined) updateData.corequisites = args.corequisites;
        if (args.syllabus !== undefined) updateData.syllabus = args.syllabus;
        if (args.isActive !== undefined) updateData.isActive = args.isActive;

        await ctx.db.patch(args.courseId, updateData);

        return args.courseId;
    },
});

/**
 * Get course with sections for a specific period
 */
export const getCourseWithSections = query({
    args: {
        courseId: v.id("courses"),
        periodId: v.optional(v.id("periods")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get sections for this course in the period
        const sections = await ctx.db
            .query("sections")
            .withIndex("by_course_period", q =>
                q.eq("courseId", args.courseId).eq("periodId", targetPeriod._id))
            .collect();

        // Get section details with professor info
        const sectionDetails = await Promise.all(
            sections.map(async (section) => {
                const professor = await ctx.db.get(section.professorId);

                // Get enrollment count
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section", q => q.eq("sectionId", section._id))
                    .collect();

                return {
                    section,
                    professor,
                    enrollmentStats: {
                        enrolled: enrollments.filter(e => e.status === "enrolled").length,
                        capacity: section.capacity,
                        available: section.capacity - section.enrolled,
                    },
                };
            })
        );

        return {
            course,
            period: targetPeriod,
            sections: sectionDetails,
        };
    },
});

/**
 * Create new section (Admin/Professor)
 */
export const createSection = mutation({
    args: {
        courseId: v.id("courses"),
        periodId: v.id("periods"),
        groupNumber: v.string(),
        professorId: v.id("users"),
        capacity: v.number(),
        deliveryMethod: deliveryMethodValidator,
        schedule: v.optional(v.object({
            sessions: v.array(scheduleSessionValidator),
            timezone: v.string(),
            notes: v.optional(v.string()),
        })),
        waitlistCapacity: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "professor")) {
            throw new ConvexError("Admin or Professor access required");
        }

        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new ConvexError("Course not found");
        }

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new ConvexError("Period not found");
        }

        const professor = await ctx.db.get(args.professorId);
        if (!professor || professor.role !== "professor") {
            throw new ConvexError("Professor not found or invalid role");
        }

        // If user is professor, they can only create sections for themselves
        if (user.role === "professor" && args.professorId !== user._id) {
            throw new ConvexError("Professors can only create sections for themselves");
        }

        // Validate capacity
        if (args.capacity <= 0) {
            throw new ConvexError("Capacity must be greater than 0");
        }

        // Generate CRN (Course Reference Number)
        const crn = `${course.code}-${args.groupNumber}-${period.code}`;

        // Check for duplicate CRN
        const existingSection = await ctx.db
            .query("sections")
            .withIndex("by_crn", q => q.eq("crn", crn))
            .first();

        if (existingSection) {
            throw new ConvexError("Section with this group number already exists for this period");
        }

        // Create section
        const sectionId = await ctx.db.insert("sections", {
            courseId: args.courseId,
            periodId: args.periodId,
            groupNumber: args.groupNumber,
            crn,
            professorId: args.professorId,
            capacity: args.capacity,
            enrolled: 0,
            waitlistCapacity: args.waitlistCapacity,
            waitlisted: 0,
            deliveryMethod: args.deliveryMethod,
            schedule: args.schedule,
            status: "draft",
            gradesSubmitted: false,
            isActive: true,
            createdAt: Date.now(),
        });

        return {
            sectionId,
            crn,
            message: "Section created successfully",
        };
    },
});

/**
 * Update section details (Admin/Professor who owns section)
 */
export const updateSection = mutation({
    args: {
        sectionId: v.id("sections"),
        capacity: v.optional(v.number()),
        deliveryMethod: v.optional(deliveryMethodValidator),
        schedule: v.optional(v.object({
            sessions: v.array(scheduleSessionValidator),
            timezone: v.string(),
            notes: v.optional(v.string()),
        })),
        status: v.optional(sectionStatusValidator),
        waitlistCapacity: v.optional(v.number()),
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

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Check permissions
        const canEdit = (user.role === "admin" || user.role === "superadmin") ||
            (user.role === "professor" && section.professorId === user._id);

        if (!canEdit) {
            throw new ConvexError("Permission denied");
        }

        // Validate capacity if provided
        if (args.capacity !== undefined && args.capacity < section.enrolled) {
            throw new ConvexError(`Cannot reduce capacity below current enrollment (${section.enrolled})`);
        }

        // Update section
        const updateData: any = { updatedAt: Date.now() };

        if (args.capacity !== undefined) updateData.capacity = args.capacity;
        if (args.deliveryMethod !== undefined) updateData.deliveryMethod = args.deliveryMethod;
        if (args.schedule !== undefined) updateData.schedule = args.schedule;
        if (args.status !== undefined) updateData.status = args.status;
        if (args.waitlistCapacity !== undefined) updateData.waitlistCapacity = args.waitlistCapacity;

        await ctx.db.patch(args.sectionId, updateData);

        return args.sectionId;
    },
});

/**
 * Get sections for a period with filtering
 */
export const getSectionsByPeriod = query({
    args: {
        periodId: v.optional(v.id("periods")),
        professorId: v.optional(v.id("users")),
        courseId: v.optional(v.id("courses")),
        status: v.optional(sectionStatusValidator),
        hasAvailableSeats: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await getCurrentPeriod(ctx.db);

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        let sections: Doc<"sections">[];

        // Use appropriate index based on filters
        if (args.professorId) {
            sections = await ctx.db
                .query("sections")
                .withIndex("by_professor_period", q =>
                    q.eq("professorId", args.professorId!).eq("periodId", targetPeriod._id).eq("isActive", true))
                .collect();
        } else if (args.courseId) {
            sections = await ctx.db
                .query("sections")
                .withIndex("by_course_period", q =>
                    q.eq("courseId", args.courseId!).eq("periodId", targetPeriod._id))
                .collect();
        } else {
            sections = await ctx.db
                .query("sections")
                .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
                .collect();
        }

        // Apply additional filters
        if (args.status) {
            sections = sections.filter(section => section.status === args.status);
        }

        if (args.hasAvailableSeats) {
            sections = sections.filter(section => hasAvailableCapacity(section));
        }

        // Get section details
        const sectionDetails = await Promise.all(
            sections.map(async (section) => {
                const [course, professor] = await Promise.all([
                    ctx.db.get(section.courseId),
                    ctx.db.get(section.professorId),
                ]);

                // Get enrollment statistics
                const enrollments = await ctx.db
                    .query("enrollments")
                    .withIndex("by_section", q => q.eq("sectionId", section._id))
                    .collect();

                return {
                    section,
                    course,
                    professor,
                    enrollmentStats: {
                        enrolled: enrollments.filter(e => e.status === "enrolled").length,
                        totalEnrollments: enrollments.length,
                        capacity: section.capacity,
                        available: section.capacity - section.enrolled,
                        hasCapacity: hasAvailableCapacity(section),
                    },
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
 * Delete section (Admin only)
 */
export const deleteSection = mutation({
    args: {
        sectionId: v.id("sections"),
        forceDelete: v.optional(v.boolean()),
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

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new ConvexError("Section not found");
        }

        // Check for enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", q => q.eq("sectionId", args.sectionId))
            .collect();

        if (enrollments.length > 0 && !args.forceDelete) {
            throw new ConvexError(`Cannot delete section with ${enrollments.length} enrollments. Use forceDelete to override.`);
        }

        // If force delete, remove all enrollments first
        if (args.forceDelete) {
            for (const enrollment of enrollments) {
                await ctx.db.delete(enrollment._id);
            }
        }

        // Delete section
        await ctx.db.delete(args.sectionId);

        return {
            message: "Section deleted successfully",
            deletedEnrollments: args.forceDelete ? enrollments.length : 0,
        };
    },
});

/**
 * Associate course with program (Admin only)
 */
export const addCourseToProgram = mutation({
    args: {
        courseId: v.id("courses"),
        programId: v.id("programs"),
        isRequired: v.boolean(),
        categoryOverride: v.optional(courseCategoryValidator),
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

        // Check if association already exists
        const existing = await ctx.db
            .query("program_courses")
            .withIndex("by_program_course", q =>
                q.eq("programId", args.programId).eq("courseId", args.courseId))
            .first();

        if (existing) {
            throw new ConvexError("Course is already associated with this program");
        }

        const course = await ctx.db.get(args.courseId);
        const program = await ctx.db.get(args.programId);

        if (!course || !program) {
            throw new ConvexError("Course or program not found");
        }

        // Create association
        const associationId = await ctx.db.insert("program_courses", {
            courseId: args.courseId,
            programId: args.programId,
            isRequired: args.isRequired,
            categoryOverride: args.categoryOverride,
            isActive: true,
            createdAt: Date.now(),
        });

        return associationId;
    },
});

/**
 * Remove course from program (Admin only)
 */
export const removeCourseFromProgram = mutation({
    args: {
        courseId: v.id("courses"),
        programId: v.id("programs"),
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

        const association = await ctx.db
            .query("program_courses")
            .withIndex("by_program_course", q =>
                q.eq("programId", args.programId).eq("courseId", args.courseId))
            .first();

        if (!association) {
            throw new ConvexError("Course is not associated with this program");
        }

        await ctx.db.delete(association._id);

        return {
            message: "Course removed from program successfully",
        };
    },
});
