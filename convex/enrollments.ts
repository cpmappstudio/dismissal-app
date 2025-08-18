// ################################################################################
// # File: enrollments.ts                                                         #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Student enrollment management functions
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    enrollmentStatusValidator,
    ErrorCodes,
    AppError,
    type EnrollmentWithDetails,
    type EnrollmentValidation,
} from "./types";
import {
    requireAuth,
    requireRole,
    requireAdminOrSelf,
    enrichEnrollmentsWithDetails,
    isStudentEnrolledInCourse,
    hasCompletedPrerequisites,
    hasAvailableCapacity,
    meetsMinimumSemester,
} from "./helpers";

// ============================================================================
// ENROLLMENT QUERIES
// ============================================================================

/**
 * Get student enrollments with course details
 */
export const getStudentEnrollments = query({
    args: {
        studentId: v.id("users"),
        semesterId: v.optional(v.id("semesters")),
        status: v.optional(enrollmentStatusValidator),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only see their own enrollments, admins and professors can see any
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Not authorized to view enrollments for this student",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let enrollments;

        if (args.semesterId) {
            enrollments = await ctx.db
                .query("enrollments")
                .withIndex("by_student_semester", (q) =>
                    q.eq("studentId", args.studentId).eq("semesterId", args.semesterId!)
                )
                .collect();
        } else {
            enrollments = await ctx.db
                .query("enrollments")
                .filter((q) => q.eq(q.field("studentId"), args.studentId))
                .collect();
        }

        // Filter by status if specified
        if (args.status) {
            enrollments = enrollments.filter(e => e.status === args.status);
        }

        return await enrichEnrollmentsWithDetails(ctx, enrollments);
    },
});

/**
 * Get section enrollments (for professors and admins)
 */
export const getSectionEnrollments = query({
    args: {
        sectionId: v.id("sections"),
        includeInactive: v.optional(v.boolean()),
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

        // Only admins or the assigned professor can view section enrollments
        if (currentUser.role !== "admin" && currentUser._id !== section.professorId) {
            throw new AppError(
                "Not authorized to view enrollments for this section",
                ErrorCodes.UNAUTHORIZED
            );
        }

        let enrollments = await ctx.db
            .query("enrollments")
            .filter((q) => q.eq(q.field("sectionId"), args.sectionId))
            .collect();

        // Filter by active status if requested
        if (!args.includeInactive) {
            enrollments = enrollments.filter(e =>
                ["enrolled", "completed"].includes(e.status)
            );
        }

        // Enrich with student details
        const enrichedEnrollments = await Promise.all(
            enrollments.map(async (enrollment) => {
                const student = await ctx.db.get(enrollment.studentId);
                return {
                    enrollment,
                    student,
                };
            })
        );

        return enrichedEnrollments;
    },
});

/**
 * Get classmates for a student in a specific section
 */
export const getClassmates = query({
    args: {
        studentId: v.id("users"),
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only see their own classmates, others can see any
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Not authorized to view classmates",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Verify student is enrolled in the section
        const studentEnrollment = await ctx.db
            .query("enrollments")
            .filter((q) =>
                q.and(
                    q.eq(q.field("studentId"), args.studentId),
                    q.eq(q.field("sectionId"), args.sectionId),
                    q.eq(q.field("status"), "enrolled")
                )
            )
            .first();

        if (!studentEnrollment) {
            throw new AppError(
                "Student is not enrolled in this section",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Get all enrollments in the section
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section_status", (q) =>
                q.eq("sectionId", args.sectionId).eq("status", "enrolled")
            )
            .collect();

        // Get student details for classmates (excluding the requesting student)
        const classmates = await Promise.all(
            enrollments
                .filter(e => e.studentId !== args.studentId)
                .map(async (enrollment) => {
                    const student = await ctx.db.get(enrollment.studentId);
                    if (student?.studentProfile) {
                        // Only return public information based on privacy settings
                        return {
                            _id: student._id,
                            name: student.studentProfile.showProfile ? student.name : "Private",
                            studentCode: student.studentProfile.showProfile ? student.studentProfile.studentCode : undefined,
                            enrollmentYear: student.studentProfile.showProfile ? student.studentProfile.enrollmentYear : undefined,
                            email: student.studentProfile.showProfile ? student.email : undefined,
                        };
                    }
                    return null;
                })
        );

        return classmates.filter(c => c !== null);
    },
});

/**
 * Validate enrollment before allowing registration
 */
export const validateEnrollment = query({
    args: {
        studentId: v.id("users"),
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args): Promise<EnrollmentValidation> => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const [student, section] = await Promise.all([
            ctx.db.get(args.studentId),
            ctx.db.get(args.sectionId),
        ]);

        if (!student?.studentProfile) {
            errors.push("Student not found");
            return { isValid: false, errors, warnings };
        }

        if (!section) {
            errors.push("Section not found");
            return { isValid: false, errors, warnings };
        }

        // Check if section is open for enrollment
        if (section.status !== "open") {
            errors.push("Section is not open for enrollment");
        }

        // Check if already enrolled in this course for this semester
        if (await isStudentEnrolledInCourse(
            ctx,
            args.studentId,
            section.courseId,
            section.semesterId
        )) {
            errors.push("Already enrolled in this course for this semester");
        }

        // Check capacity
        if (!hasAvailableCapacity(section)) {
            errors.push("Section is at full capacity");
        }

        // Check prerequisites
        const prereqCheck = await hasCompletedPrerequisites(
            ctx,
            args.studentId,
            section.courseId
        );

        if (!prereqCheck.hasCompleted) {
            errors.push(`Missing prerequisites: ${prereqCheck.missing.join(", ")}`);
        }

        // Check minimum semester requirement
        if (!(await meetsMinimumSemester(ctx, args.studentId, section.courseId))) {
            warnings.push("Student may not meet minimum semester requirement");
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    },
});

// ============================================================================
// ENROLLMENT MUTATIONS
// ============================================================================

/**
 * Enroll student in section with comprehensive validation
 */
export const enrollInSection = mutation({
    args: {
        studentId: v.id("users"),
        sectionId: v.id("sections"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAuth(ctx);

        // Students can only enroll themselves, admins can enroll anyone
        if (currentUser.role === "student" && currentUser._id !== args.studentId) {
            throw new AppError(
                "Students can only enroll themselves",
                ErrorCodes.UNAUTHORIZED
            );
        } else if (currentUser.role === "professor") {
            throw new AppError(
                "Professors cannot enroll students",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Inline validation
        const [student, section] = await Promise.all([
            ctx.db.get(args.studentId),
            ctx.db.get(args.sectionId),
        ]);

        if (!student?.studentProfile) {
            throw new AppError(
                "Student not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        // Check if section is open for enrollment
        if (section.status !== "open") {
            throw new AppError(
                "Section is not open for enrollment",
                ErrorCodes.ENROLLMENT_CLOSED
            );
        }

        // Check if already enrolled in this course for this semester
        if (await isStudentEnrolledInCourse(
            ctx,
            args.studentId,
            section.courseId,
            section.semesterId
        )) {
            throw new AppError(
                "Already enrolled in this course for this semester",
                ErrorCodes.ALREADY_ENROLLED
            );
        }

        // Check capacity
        if (!hasAvailableCapacity(section)) {
            throw new AppError(
                "Section is at full capacity",
                ErrorCodes.SECTION_FULL
            );
        }

        // Check prerequisites
        const prereqCheck = await hasCompletedPrerequisites(
            ctx,
            args.studentId,
            section.courseId
        );

        if (!prereqCheck.hasCompleted) {
            throw new AppError(
                `Missing prerequisites: ${prereqCheck.missing.join(", ")}`,
                ErrorCodes.PREREQUISITES_NOT_MET
            );
        }

        // Create enrollment
        const enrollmentId = await ctx.db.insert("enrollments", {
            studentId: args.studentId,
            sectionId: args.sectionId,
            semesterId: section.semesterId,
            courseId: section.courseId,
            enrolledAt: Date.now(),
            status: "enrolled" as const,
            isRetake: false, // TODO: Detect if this is a retake
        });

        // Update section enrollment count
        await ctx.db.patch(args.sectionId, {
            enrolled: section.enrolled + 1,
        });

        return {
            enrollmentId,
            message: "Successfully enrolled in section",
        };
    },
});

/**
 * Drop course (withdraw from enrollment)
 */
export const dropCourse = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        reason: v.optional(v.string()),
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

        // Students can only drop their own courses, admins can drop any
        if (currentUser.role === "student" && currentUser._id !== enrollment.studentId) {
            throw new AppError(
                "Students can only drop their own courses",
                ErrorCodes.UNAUTHORIZED
            );
        } else if (currentUser.role === "professor") {
            throw new AppError(
                "Professors cannot drop students from courses",
                ErrorCodes.UNAUTHORIZED
            );
        }

        // Check if already dropped or completed
        if (enrollment.status === "dropped") {
            throw new AppError(
                "Course is already dropped",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (enrollment.status === "completed") {
            throw new AppError(
                "Cannot drop a completed course",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Update enrollment status
        await ctx.db.patch(args.enrollmentId, {
            status: "dropped" as const,
            droppedAt: Date.now(),
        });

        // Update section enrollment count
        const section = await ctx.db.get(enrollment.sectionId);
        if (section) {
            await ctx.db.patch(enrollment.sectionId, {
                enrolled: Math.max(0, section.enrolled - 1),
            });
        }

        return {
            success: true,
            message: "Successfully dropped from course"
        };
    },
});

/**
 * Update enrollment status (Admin only)
 */
export const updateEnrollmentStatus = mutation({
    args: {
        enrollmentId: v.id("enrollments"),
        status: enrollmentStatusValidator,
        finalGrade: v.optional(v.number()),
        creditsEarned: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const enrollment = await ctx.db.get(args.enrollmentId);
        if (!enrollment) {
            throw new AppError(
                "Enrollment not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        const updates: any = {
            status: args.status,
        };

        // Handle status-specific updates
        if (args.status === "completed" || args.status === "failed") {
            if (args.finalGrade !== undefined) {
                updates.finalGrade = args.finalGrade;

                // Calculate letter grade (Colombian scale)
                if (args.finalGrade >= 4.5) updates.letterGrade = "A";
                else if (args.finalGrade >= 4.0) updates.letterGrade = "B";
                else if (args.finalGrade >= 3.5) updates.letterGrade = "C";
                else if (args.finalGrade >= 3.0) updates.letterGrade = "D";
                else updates.letterGrade = "F";

                // Auto-calculate credits earned based on passing grade
                if (!args.creditsEarned) {
                    const course = await ctx.db.get(enrollment.courseId);
                    updates.creditsEarned = args.finalGrade >= 3.0 ? (course?.credits || 0) : 0;
                } else {
                    updates.creditsEarned = args.creditsEarned;
                }
            }
        } else if (args.status === "dropped") {
            updates.droppedAt = Date.now();
            updates.creditsEarned = 0;
        }

        await ctx.db.patch(args.enrollmentId, updates);

        return {
            success: true,
            message: `Enrollment status updated to ${args.status}`
        };
    },
});

/**
 * Bulk enroll students (Admin only)
 */
export const bulkEnrollStudents = mutation({
    args: {
        studentIds: v.array(v.id("users")),
        sectionId: v.id("sections"),
        skipValidation: v.optional(v.boolean()),
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

        const results = {
            successful: [] as string[],
            failed: [] as { studentId: string; reason: string }[],
        };

        for (const studentId of args.studentIds) {
            try {
                const student = await ctx.db.get(studentId);
                if (!student?.studentProfile) {
                    results.failed.push({
                        studentId: studentId,
                        reason: "Student not found",
                    });
                    continue;
                }

                // Validate enrollment unless skipped
                if (!args.skipValidation) {
                    // Inline validation for bulk operations
                    if (await isStudentEnrolledInCourse(
                        ctx,
                        studentId,
                        section.courseId,
                        section.semesterId
                    )) {
                        results.failed.push({
                            studentId: student.name,
                            reason: "Already enrolled in this course for this semester",
                        });
                        continue;
                    }

                    if (!hasAvailableCapacity(section)) {
                        results.failed.push({
                            studentId: student.name,
                            reason: "Section is at full capacity",
                        });
                        continue;
                    }

                    const prereqCheck = await hasCompletedPrerequisites(
                        ctx,
                        studentId,
                        section.courseId
                    );

                    if (!prereqCheck.hasCompleted) {
                        results.failed.push({
                            studentId: student.name,
                            reason: `Missing prerequisites: ${prereqCheck.missing.join(", ")}`,
                        });
                        continue;
                    }
                }

                // Create enrollment
                await ctx.db.insert("enrollments", {
                    studentId,
                    sectionId: args.sectionId,
                    semesterId: section.semesterId,
                    courseId: section.courseId,
                    enrolledAt: Date.now(),
                    status: "enrolled" as const,
                    isRetake: false,
                });

                results.successful.push(student.name);
            } catch (error) {
                results.failed.push({
                    studentId: studentId,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        // Update section enrollment count
        await ctx.db.patch(args.sectionId, {
            enrolled: section.enrolled + results.successful.length,
        });

        return {
            ...results,
            message: `Enrolled ${results.successful.length} students, ${results.failed.length} failed`,
        };
    },
});

// ============================================================================
// ENROLLMENT ANALYTICS
// ============================================================================

/**
 * Get enrollment statistics for a semester (Admin only)
 */
export const getSemesterEnrollmentStatistics = query({
    args: {
        semesterId: v.id("semesters")
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const enrollments = await ctx.db
            .query("enrollments")
            .filter((q) => q.eq(q.field("semesterId"), args.semesterId))
            .collect();

        const totalEnrollments = enrollments.length;
        const activeEnrollments = enrollments.filter(e => e.status === "enrolled").length;
        const completedEnrollments = enrollments.filter(e => e.status === "completed").length;
        const droppedEnrollments = enrollments.filter(e => e.status === "dropped").length;
        const failedEnrollments = enrollments.filter(e => e.status === "failed").length;

        return {
            totalEnrollments,
            activeEnrollments,
            completedEnrollments,
            droppedEnrollments,
            failedEnrollments,
            completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
            dropRate: totalEnrollments > 0 ? (droppedEnrollments / totalEnrollments) * 100 : 0,
        };
    },
});

/**
 * Get student enrollment history
 */
export const getStudentEnrollmentHistory = query({
    args: {
        studentId: v.id("users")
    },
    handler: async (ctx, args) => {
        const currentUser = await requireAdminOrSelf(ctx, args.studentId);

        const enrollments = await ctx.db
            .query("enrollments")
            .filter((q) => q.eq(q.field("studentId"), args.studentId))
            .collect();

        // Group by semester
        const enrollmentsBySemester = new Map<Id<"semesters">, any[]>();

        for (const enrollment of enrollments) {
            if (!enrollmentsBySemester.has(enrollment.semesterId)) {
                enrollmentsBySemester.set(enrollment.semesterId, []);
            }

            const enriched = await enrichEnrollmentsWithDetails(ctx, [enrollment]);
            enrollmentsBySemester.get(enrollment.semesterId)!.push(enriched[0]);
        }

        // Convert to array and enrich with semester info
        const history = await Promise.all(
            Array.from(enrollmentsBySemester.entries()).map(async ([semesterId, enrollments]) => {
                const semester = await ctx.db.get(semesterId);

                return {
                    semester,
                    enrollments,
                    totalCredits: enrollments.reduce((sum, e) =>
                        sum + (e.course?.credits || 0), 0
                    ),
                    creditsEarned: enrollments.reduce((sum, e) =>
                        sum + (e.enrollment.creditsEarned || 0), 0
                    ),
                };
            })
        );

        // Sort by semester year and period
        history.sort((a, b) => {
            if (!a.semester || !b.semester) return 0;
            if (a.semester.year !== b.semester.year) {
                return a.semester.year - b.semester.year;
            }
            const periods = { "I": 1, "II": 2, "summer": 3 };
            return periods[a.semester.period] - periods[b.semester.period];
        });

        return history;
    },
});
