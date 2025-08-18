// ################################################################################
// # File: grades.ts                                                              #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Grade and activity management functions
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    activityCategoryValidator,
    enrollmentStatusValidator,
    ErrorCodes,
    AppError,
    type ActivityGrade,
    type GradeBreakdown,
    type CourseGradeSummary,
} from "./types";
import {
    requireAuth,
    requireRole,
    requireAdminOrSelf,
    calculateLetterGrade,
    isPassingGrade,
    parseGradeWeights,
    validateGradeWeights,
} from "./helpers";

// ============================================================================
// GRADE QUERIES
// ============================================================================

/**
 * Get student grades for a specific enrollment
 */
export const getStudentGrades = query({
    args: {
        enrollmentId: v.id("enrollments"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new AppError(
                "Enrollment not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Students can only see their own grades, professors can see their section's grades
        if (currentUser.role === "student" && currentUser._id !== enrollment.studentId) {
            throw new AppError(
                "Not authorized to view grades for this enrollment",
                ErrorCodes.UNAUTHORIZED
            );
        }

        if (currentUser.role === "professor") {
            const section = await ctx.db.get(enrollment.sectionId);
            if (!section || section.professorId !== currentUser._id) {
                throw new AppError(
                    "Not authorized to view grades for this enrollment",
                    ErrorCodes.UNAUTHORIZED
                );
            }
        }

        // Get section and activities
        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        const activities = await ctx.db
            .query("activities")
            .withIndex("by_section_visible", (q) =>
                q.eq("sectionId", section._id).eq("isVisible", true)
            )
            .collect();

        // Get grades for this enrollment
        const grades = await ctx.db
            .query("grades")
            .withIndex("by_enrollment", (q) => q.eq("enrollmentId", args.enrollmentId))
            .collect();

        const gradeMap = new Map(grades.map(g => [g.activityId, g]));

        // Build activity grades
        const activityGrades: ActivityGrade[] = activities.map(activity => ({
            activity,
            grade: gradeMap.get(activity._id) || null,
            score: gradeMap.get(activity._id)?.score || null,
            maxPoints: activity.maxPoints,
            weight: activity.weight,
            category: activity.category,
        }));

        // Parse grade weights
        const gradeWeights = parseGradeWeights(section.gradeWeights);

        return {
            enrollment,
            activities: activityGrades,
            gradeWeights,
            finalGrade: enrollment.finalGrade,
            letterGrade: enrollment.letterGrade,
        };
    },
});

/**
 * Get all grades for a student in a semester
 */
export const getStudentSemesterGrades = query({
    args: {
        studentId: v.id("users"),
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAdminOrSelf(ctx, args.studentId);

        // Get student enrollments for the semester
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_semester", (q) =>
                q.eq("studentId", args.studentId).eq("semesterId", args.semesterId)
            )
            .filter((q) => q.neq(q.field("status"), "dropped"))
            .collect();

        // Build course grade summaries
        const courseGrades = await Promise.all(
            enrollments.map(async (enrollment): Promise<CourseGradeSummary> => {
                const [course, section] = await Promise.all([
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                ]);

                return {
                    courseCode: course?.code || "Unknown",
                    courseName: course?.name || "Unknown",
                    currentGrade: await calculateCurrentGrade(ctx, enrollment._id, section),
                    finalGrade: enrollment.finalGrade || null,
                    letterGrade: enrollment.letterGrade || null,
                    credits: course?.credits || 0,
                    status: enrollment.status,
                };
            })
        );

        return courseGrades;
    },
});

/**
 * Get section grades for professor
 */
export const getSectionGrades = query({
    args: {
        sectionId: v.id("sections"),
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

        // Only professor or admin can view section grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to view section grades",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Get enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section_status", (q) =>
                q.eq("sectionId", args.sectionId).eq("status", "enrolled")
            )
            .collect();

        // Get activities
        const activities = await ctx.db
            .query("activities")
            .filter((q) => q.eq(q.field("sectionId"), args.sectionId))
            .collect();

        // Get all grades for this section
        const allGrades = await ctx.db
            .query("grades")
            .collect();

        // Build student grades
        const studentGrades = await Promise.all(
            enrollments.map(async (enrollment) => {
                const student = await ctx.db.get(enrollment.studentId);

                // Get grades for this enrollment
                const enrollmentGrades = allGrades.filter(g =>
                    g.enrollmentId === enrollment._id
                );

                const gradeMap = new Map(enrollmentGrades.map(g => [g.activityId, g]));

                const activityGrades = activities.map(activity => ({
                    activityId: activity._id,
                    activityName: activity.title,
                    score: gradeMap.get(activity._id)?.score || null,
                    maxPoints: activity.maxPoints,
                    submitted: gradeMap.get(activity._id)?.submittedAt !== undefined,
                    graded: gradeMap.get(activity._id)?.gradedAt !== undefined,
                }));

                return {
                    student: {
                        _id: student?._id,
                        name: student?.name,
                        studentCode: student?.studentProfile?.studentCode,
                        email: student?.email,
                    },
                    enrollment,
                    grades: activityGrades,
                    currentGrade: await calculateCurrentGrade(ctx, enrollment._id, section),
                };
            })
        );

        return {
            section,
            activities,
            studentGrades,
        };
    },
});

// ============================================================================
// ACTIVITY MUTATIONS
// ============================================================================

/**
 * Create new activity
 */
export const createActivity = mutation({
    args: {
        sectionId: v.id("sections"),
        title: v.string(),
        description: v.string(),
        category: activityCategoryValidator,
        weight: v.number(),
        maxPoints: v.number(),
        dueAt: v.optional(v.number()),
        isVisible: v.optional(v.boolean()),
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

        // Only professor or admin can create activities
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to create activities for this section",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate input
        if (args.weight < 0 || args.weight > 100) {
            throw new AppError(
                "Weight must be between 0 and 100",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (args.maxPoints <= 0) {
            throw new AppError(
                "Max points must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        const activityId = await ctx.db.insert("activities", {
            sectionId: args.sectionId,
            title: args.title,
            description: args.description,
            category: args.category,
            weight: args.weight,
            maxPoints: args.maxPoints,
            assignedAt: Date.now(),
            dueAt: args.dueAt,
            isVisible: args.isVisible ?? true,
            gradesReleased: false,
        });

        return {
            activityId,
            message: `Activity '${args.title}' created successfully`
        };
    },
});

/**
 * Update activity
 */
export const updateActivity = mutation({
    args: {
        activityId: v.id("activities"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        weight: v.optional(v.number()),
        maxPoints: v.optional(v.number()),
        dueAt: v.optional(v.number()),
        isVisible: v.optional(v.boolean()),
        gradesReleased: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const { activityId, ...updates } = args;

        const activity = await ctx.db.get(activityId);
        if (!activity) {
            throw new AppError(
                "Activity not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        const section = await ctx.db.get(activity.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only professor or admin can update activities
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to update this activity",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate updates
        if (updates.weight && (updates.weight < 0 || updates.weight > 100)) {
            throw new AppError(
                "Weight must be between 0 and 100",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (updates.maxPoints && updates.maxPoints <= 0) {
            throw new AppError(
                "Max points must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        await ctx.db.patch(activityId, updates);

        return {
            success: true,
            message: "Activity updated successfully"
        };
    },
});

// ============================================================================
// GRADE MUTATIONS
// ============================================================================

/**
 * Submit grade for a student activity
 */
export const submitGrade = mutation({
    args: {
        activityId: v.id("activities"),
        enrollmentId: v.id("enrollments"),
        score: v.number(),
        feedback: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const [activity, enrollment] = await Promise.all([
            ctx.db.get(args.activityId),
            ctx.db.get(args.enrollmentId),
        ]);

        if (!activity) {
            throw new AppError(
                "Activity not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        if (!enrollment) {
            throw new AppError(
                "Enrollment not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Verify activity belongs to enrollment's section
        if (activity.sectionId !== enrollment.sectionId) {
            throw new AppError(
                "Activity does not belong to enrollment's section",
                ErrorCodes.INVALID_INPUT
            );
        }

        const section = await ctx.db.get(activity.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only professor or admin can submit grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to submit grades for this activity",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate score
        if (args.score < 0 || args.score > activity.maxPoints) {
            throw new AppError(
                `Score must be between 0 and ${activity.maxPoints}`,
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if grade already exists
        const existingGrade = await ctx.db
            .query("grades")
            .filter((q) =>
                q.and(
                    q.eq(q.field("activityId"), args.activityId),
                    q.eq(q.field("enrollmentId"), args.enrollmentId)
                )
            )
            .first();

        if (existingGrade) {
            // Update existing grade
            await ctx.db.patch(existingGrade._id, {
                score: args.score,
                feedback: args.feedback,
                gradedAt: Date.now(),
                gradedBy: currentUser._id,
            });
        } else {
            // Create new grade
            await ctx.db.insert("grades", {
                activityId: args.activityId,
                enrollmentId: args.enrollmentId,
                score: args.score,
                feedback: args.feedback,
                gradedAt: Date.now(),
                gradedBy: currentUser._id,
            });
        }

        return {
            success: true,
            message: "Grade submitted successfully"
        };
    },
});

/**
 * Update final grade with automatic letter grade calculation
 */
export const updateFinalGrade = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        finalGrade: v.number(),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new AppError(
                "Enrollment not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only professor or admin can update final grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to update final grades for this enrollment",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Validate grade (Colombian scale 0-5)
        if (args.finalGrade < 0 || args.finalGrade > 5) {
            throw new AppError(
                "Final grade must be between 0 and 5",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Get course to determine credit value
        const course = await ctx.db.get(enrollment.courseId);
        const creditsEarned = isPassingGrade(args.finalGrade) ? (course?.credits || 0) : 0;

        await ctx.db.patch(args.enrollmentId, {
            finalGrade: args.finalGrade,
            letterGrade: calculateLetterGrade(args.finalGrade),
            creditsEarned,
            status: isPassingGrade(args.finalGrade) ? "completed" : "failed",
        });

        return {
            success: true,
            message: "Final grade updated successfully"
        };
    },
});

/**
 * Bulk update grades for an activity
 */
export const bulkUpdateGrades = mutation({
    args: {
        activityId: v.id("activities"),
        grades: v.array(v.object({
            enrollmentId: v.id("enrollments"),
            score: v.number(),
            feedback: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        const activity = await ctx.db.get(args.activityId);
        if (!activity) {
            throw new AppError(
                "Activity not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        const section = await ctx.db.get(activity.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Only professor or admin can bulk update grades
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to update grades for this activity",
                ErrorCodes.UNAUTHORIZED
            );
        }

        const results = {
            successful: 0,
            failed: [] as { enrollmentId: string; reason: string }[],
        };

        for (const gradeData of args.grades) {
            try {
                // Validate score
                if (gradeData.score < 0 || gradeData.score > activity.maxPoints) {
                    results.failed.push({
                        enrollmentId: gradeData.enrollmentId,
                        reason: `Score must be between 0 and ${activity.maxPoints}`,
                    });
                    continue;
                }

                // Check if grade already exists
                const existingGrade = await ctx.db
                    .query("grades")
                    .filter((q) =>
                        q.and(
                            q.eq(q.field("activityId"), args.activityId),
                            q.eq(q.field("enrollmentId"), gradeData.enrollmentId)
                        )
                    )
                    .first();

                if (existingGrade) {
                    // Update existing grade
                    await ctx.db.patch(existingGrade._id, {
                        score: gradeData.score,
                        feedback: gradeData.feedback,
                        gradedAt: Date.now(),
                        gradedBy: currentUser._id,
                    });
                } else {
                    // Create new grade
                    await ctx.db.insert("grades", {
                        activityId: args.activityId,
                        enrollmentId: gradeData.enrollmentId,
                        score: gradeData.score,
                        feedback: gradeData.feedback,
                        gradedAt: Date.now(),
                        gradedBy: currentUser._id,
                    });
                }

                results.successful++;
            } catch (error) {
                results.failed.push({
                    enrollmentId: gradeData.enrollmentId,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        return {
            ...results,
            message: `Updated ${results.successful} grades, ${results.failed.length} failed`,
        };
    },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate current grade for an enrollment
 */
async function calculateCurrentGrade(
    ctx: any,
    enrollmentId: Id<"enrollments">,
    section: Doc<"sections"> | null
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

    // Parse grade weights
    const gradeWeights = parseGradeWeights(section.gradeWeights);
    if (!gradeWeights) return 0;

    // Calculate weighted score by category
    const categoryScores = new Map<string, { earned: number; total: number; weight: number }>();

    for (const activity of activities) {
        const grade = gradeMap.get(activity._id);
        const score = (grade as any)?.score || 0;
        const maxPoints = activity.maxPoints;

        const category = activity.category;
        if (!categoryScores.has(category)) {
            categoryScores.set(category, { earned: 0, total: 0, weight: 0 });
        }

        const categoryData = categoryScores.get(category)!;
        categoryData.earned += score;
        categoryData.total += maxPoints;
        categoryData.weight = activity.weight; // Assuming all activities in category have same weight
    }

    // Calculate final weighted grade
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [category, data] of categoryScores) {
        if (data.total > 0) {
            const categoryPercentage = (data.earned / data.total) * 100;
            const categoryGrade = (categoryPercentage / 100) * 5; // Convert to 0-5 scale
            totalWeightedScore += categoryGrade * (data.weight / 100);
            totalWeight += data.weight / 100;
        }
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}
