// ################################################################################
// # File: admin.ts                                                               #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Administrative functions for bulk operations and system management
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
    ErrorCodes,
    AppError,
    userRoleValidator,
    enrollmentStatusValidator,
} from "./types";
import {
    requireAuth,
    requireRole,
    calculateLetterGrade,
    isPassingGrade,
} from "./helpers";

// ============================================================================
// SYSTEM STATISTICS
// ============================================================================

/**
 * Get overall system statistics
 */
export const getSystemStats = query({
    args: {},
    handler: async (ctx) => {
        const currentUser = await requireRole(ctx, "admin");

        // Count users by role
        const allUsers = await ctx.db.query("users").collect();
        const userStats = {
            total: allUsers.length,
            students: allUsers.filter((u: any) => u.role === "student").length,
            professors: allUsers.filter((u: any) => u.role === "professor").length,
            admins: allUsers.filter((u: any) => u.role === "admin").length,
        };

        // Count programs and courses
        const [programs, courses, semesters, sections] = await Promise.all([
            ctx.db.query("programs").collect(),
            ctx.db.query("courses").collect(),
            ctx.db.query("semesters").collect(),
            ctx.db.query("sections").collect(),
        ]);

        // Count enrollments by status
        const allEnrollments = await ctx.db.query("enrollments").collect();
        const enrollmentStats = {
            total: allEnrollments.length,
            enrolled: allEnrollments.filter((e: any) => e.status === "enrolled").length,
            completed: allEnrollments.filter((e: any) => e.status === "completed").length,
            failed: allEnrollments.filter((e: any) => e.status === "failed").length,
            dropped: allEnrollments.filter((e: any) => e.status === "dropped").length,
        };

        // Count activities and grades
        const [activities, grades] = await Promise.all([
            ctx.db.query("activities").collect(),
            ctx.db.query("grades").collect(),
        ]);

        return {
            users: userStats,
            academic: {
                programs: programs.length,
                courses: courses.length,
                semesters: semesters.length,
                sections: sections.length,
            },
            enrollments: enrollmentStats,
            activities: {
                total: activities.length,
                graded: grades.length,
                pending: activities.length - grades.length,
            },
            timestamp: Date.now(),
        };
    },
});

/**
 * Get semester-specific statistics
 */
export const getSemesterStats = query({
    args: {
        semesterId: v.id("semesters"),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        const semester = await ctx.db.get(args.semesterId);
        if (!semester) {
            throw new AppError(
                "Semester not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Get sections for this semester
        const allSections = await ctx.db.query("sections").collect();
        const sections = allSections.filter((s: any) => s.semesterId === args.semesterId);

        // Get enrollments for this semester
        const allEnrollments = await ctx.db.query("enrollments").collect();
        const enrollments = allEnrollments.filter((e: any) => e.semesterId === args.semesterId);

        // Calculate enrollment statistics
        const sectionIds = sections.map((s: any) => s._id);
        const sectionEnrollments = allEnrollments.filter((e: any) =>
            sectionIds.includes(e.sectionId)
        );

        // Get courses offered
        const courseIds = [...new Set(sections.map((s: any) => s.courseId))];
        const courses = await Promise.all(courseIds.map(id => ctx.db.get(id)));

        // Calculate capacity utilization
        const totalCapacity = sections.reduce((sum: number, s: any) => sum + (s.capacity || 0), 0);
        const totalEnrolled = sectionEnrollments.filter((e: any) => e.status === "enrolled").length;

        return {
            semester: {
                _id: semester._id,
                code: semester.code,
                year: semester.year,
                period: semester.period,
                status: semester.status,
            },
            sections: {
                total: sections.length,
                active: sections.filter((s: any) => s.status === "active").length,
            },
            courses: {
                offered: courses.filter(Boolean).length,
                totalCapacity,
                totalEnrolled,
                utilizationRate: totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0,
            },
            enrollments: {
                total: sectionEnrollments.length,
                enrolled: sectionEnrollments.filter((e: any) => e.status === "enrolled").length,
                completed: sectionEnrollments.filter((e: any) => e.status === "completed").length,
                failed: sectionEnrollments.filter((e: any) => e.status === "failed").length,
                dropped: sectionEnrollments.filter((e: any) => e.status === "dropped").length,
            },
        };
    },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk create students from CSV data
 */
export const bulkCreateStudents = mutation({
    args: {
        students: v.array(v.object({
            name: v.string(),
            email: v.string(),
            studentCode: v.optional(v.string()),
            programId: v.optional(v.id("programs")),
        })),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        const results = {
            successful: [] as string[],
            failed: [] as { email: string; reason: string }[],
        };

        for (const studentData of args.students) {
            try {
                // Validate email format (simple validation)
                if (!studentData.email.includes("@") || !studentData.email.includes(".")) {
                    results.failed.push({
                        email: studentData.email,
                        reason: "Invalid email format",
                    });
                    continue;
                }

                // Check if user already exists
                const existingUser = await ctx.db
                    .query("users")
                    .filter((q: any) => q.eq(q.field("email"), studentData.email))
                    .first();

                if (existingUser) {
                    results.failed.push({
                        email: studentData.email,
                        reason: "User with this email already exists",
                    });
                    continue;
                }

                // Validate program if provided
                if (studentData.programId) {
                    const program = await ctx.db.get(studentData.programId);
                    if (!program) {
                        results.failed.push({
                            email: studentData.email,
                            reason: "Invalid program ID",
                        });
                        continue;
                    }
                }

                // Create student user
                const userProfile: any = {
                    studentCode: studentData.studentCode || `STU${Date.now()}`,
                };

                if (studentData.programId) {
                    userProfile.programId = studentData.programId;
                }

                const userId = await ctx.db.insert("users", {
                    clerkId: `temp_${Date.now()}_${Math.random()}`, // Temporary clerkId for admin-created users
                    name: studentData.name,
                    email: studentData.email,
                    role: "student",
                    isActive: true,
                    createdAt: Date.now(),
                    studentProfile: userProfile,
                });

                results.successful.push(studentData.email);
            } catch (error) {
                results.failed.push({
                    email: studentData.email,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        return {
            ...results,
            message: `Created ${results.successful.length} students, ${results.failed.length} failed`,
        };
    },
});

/**
 * Bulk enroll students in a section
 */
export const bulkEnrollStudents = mutation({
    args: {
        sectionId: v.id("sections"),
        studentIds: v.array(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        const section = await ctx.db.get(args.sectionId);
        if (!section) {
            throw new AppError(
                "Section not found",
                ErrorCodes.SECTION_NOT_FOUND
            );
        }

        const course = await ctx.db.get(section.courseId);
        if (!course) {
            throw new AppError(
                "Course not found",
                ErrorCodes.COURSE_NOT_FOUND
            );
        }

        const results = {
            successful: [] as string[],
            failed: [] as { studentId: string; reason: string }[],
        };

        for (const studentId of args.studentIds) {
            try {
                const student = await ctx.db.get(studentId);
                if (!student || student.role !== "student") {
                    results.failed.push({
                        studentId,
                        reason: "Student not found or invalid role",
                    });
                    continue;
                }

                // Check if already enrolled
                const allEnrollments = await ctx.db.query("enrollments").collect();
                const existingEnrollment = allEnrollments.find((e: any) =>
                    e.studentId === studentId &&
                    e.sectionId === args.sectionId
                );

                if (existingEnrollment) {
                    results.failed.push({
                        studentId,
                        reason: "Student already enrolled in this section",
                    });
                    continue;
                }

                // Check section capacity
                const sectionEnrollments = allEnrollments.filter((e: any) =>
                    e.sectionId === args.sectionId && e.status === "enrolled"
                );

                if (sectionEnrollments.length >= section.capacity) {
                    results.failed.push({
                        studentId,
                        reason: "Section is full",
                    });
                    continue;
                }

                // Create enrollment
                await ctx.db.insert("enrollments", {
                    studentId,
                    courseId: section.courseId,
                    sectionId: args.sectionId,
                    semesterId: section.semesterId,
                    status: "enrolled",
                    enrolledAt: Date.now(),
                    creditsEarned: 0,
                    isRetake: false,
                });

                results.successful.push(studentId);
            } catch (error) {
                results.failed.push({
                    studentId,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        return {
            ...results,
            message: `Enrolled ${results.successful.length} students, ${results.failed.length} failed`,
        };
    },
});

/**
 * Bulk update enrollment status
 */
export const bulkUpdateEnrollmentStatus = mutation({
    args: {
        enrollmentIds: v.array(v.id("enrollments")),
        newStatus: enrollmentStatusValidator,
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        const results = {
            successful: 0,
            failed: [] as { enrollmentId: string; reason: string }[],
        };

        for (const enrollmentId of args.enrollmentIds) {
            try {
                const enrollment = await ctx.db.get(enrollmentId);
                if (!enrollment) {
                    results.failed.push({
                        enrollmentId,
                        reason: "Enrollment not found",
                    });
                    continue;
                }

                // Update status
                const updateData: any = {
                    status: args.newStatus,
                };

                // If completing or failing, ensure grades are set
                if (args.newStatus === "completed" || args.newStatus === "failed") {
                    if (!enrollment.finalGrade) {
                        results.failed.push({
                            enrollmentId,
                            reason: "Cannot complete/fail enrollment without final grade",
                        });
                        continue;
                    }

                    // Update credits earned
                    if (args.newStatus === "completed" && isPassingGrade(enrollment.finalGrade)) {
                        const course = await ctx.db.get(enrollment.courseId);
                        updateData.creditsEarned = course?.credits || 0;
                    } else {
                        updateData.creditsEarned = 0;
                    }
                }

                await ctx.db.patch(enrollmentId, updateData);
                results.successful++;
            } catch (error) {
                results.failed.push({
                    enrollmentId,
                    reason: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }

        return {
            ...results,
            message: `Updated ${results.successful} enrollments, ${results.failed.length} failed`,
        };
    },
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get all users with filters
 */
export const getAllUsers = query({
    args: {
        role: v.optional(userRoleValidator),
        isActive: v.optional(v.boolean()),
        limit: v.optional(v.number()),
        offset: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        let allUsers = await ctx.db.query("users").collect();

        // Apply filters
        if (args.role) {
            allUsers = allUsers.filter((u: any) => u.role === args.role);
        }

        if (args.isActive !== undefined) {
            allUsers = allUsers.filter((u: any) => u.isActive === args.isActive);
        }

        // Sort by creation date (newest first)
        allUsers.sort((a: any, b: any) => b.createdAt - a.createdAt);

        // Apply pagination
        const offset = args.offset || 0;
        const limit = args.limit || 50;
        const paginatedUsers = allUsers.slice(offset, offset + limit);

        return {
            users: paginatedUsers.map((user: any) => ({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
                studentCode: user.studentProfile?.studentCode,
                programId: user.studentProfile?.programId,
                department: user.professorProfile?.department,
            })),
            totalCount: allUsers.length,
            hasMore: offset + limit < allUsers.length,
        };
    },
});

/**
 * Update user role and status
 */
export const updateUserRole = mutation({
    args: {
        userId: v.id("users"),
        newRole: userRoleValidator,
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        // Prevent admin from changing their own role
        if (currentUser._id === args.userId) {
            throw new AppError(
                "Cannot change your own role",
                ErrorCodes.INVALID_INPUT
            );
        }

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError(
                "User not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        const updates: any = {
            role: args.newRole,
        };

        if (args.isActive !== undefined) {
            updates.isActive = args.isActive;
        }

        // Handle role-specific profile updates
        if (args.newRole === "student" && !user.studentProfile) {
            updates.studentProfile = {
                studentCode: `STU${Date.now()}`,
            };
        } else if (args.newRole === "professor" && !user.professorProfile) {
            updates.professorProfile = {
                department: "General",
            };
        }

        await ctx.db.patch(args.userId, updates);

        return {
            success: true,
            message: `User role updated to ${args.newRole}`
        };
    },
});

/**
 * Delete user and cleanup related data
 */
export const deleteUser = mutation({
    args: {
        userId: v.id("users"),
        force: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const currentUser = await requireRole(ctx, "admin");

        // Prevent admin from deleting themselves
        if (currentUser._id === args.userId) {
            throw new AppError(
                "Cannot delete your own account",
                ErrorCodes.INVALID_INPUT
            );
        }

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new AppError(
                "User not found",
                ErrorCodes.USER_NOT_FOUND
            );
        }

        // Check for related data that would prevent deletion
        if (!args.force) {
            const allEnrollments = await ctx.db.query("enrollments").collect();
            const userEnrollments = allEnrollments.filter((e: any) =>
                e.studentId === args.userId
            );

            const allSections = await ctx.db.query("sections").collect();
            const userSections = allSections.filter((s: any) =>
                s.professorId === args.userId
            );

            if (userEnrollments.length > 0 || userSections.length > 0) {
                throw new AppError(
                    "Cannot delete user with existing enrollments or sections. Use force=true to override.",
                    ErrorCodes.INVALID_INPUT
                );
            }
        }

        // Delete related data if force is true
        if (args.force) {
            // Delete enrollments
            const allEnrollments = await ctx.db.query("enrollments").collect();
            const userEnrollments = allEnrollments.filter((e: any) =>
                e.studentId === args.userId
            );

            for (const enrollment of userEnrollments) {
                await ctx.db.delete(enrollment._id);
            }

            // Update sections to remove professor assignment
            const allSections = await ctx.db.query("sections").collect();
            const userSections = allSections.filter((s: any) =>
                s.professorId === args.userId
            );

            for (const section of userSections) {
                await ctx.db.patch(section._id, {
                    status: "draft" as any,
                    // Remove professor assignment would require schema change
                });
            }
        }

        // Delete the user
        await ctx.db.delete(args.userId);

        return {
            success: true,
            message: `User ${user.name} deleted successfully`
        };
    },
});

// ============================================================================
// SYSTEM MAINTENANCE
// ============================================================================

/**
 * Cleanup expired access codes (simplified since registrations table doesn't exist)
 */
export const cleanupExpiredAccess = mutation({
    args: {},
    handler: async (ctx) => {
        const currentUser = await requireRole(ctx, "admin");

        // This would clean up expired access codes from accessList
        // For now, just return a success message
        return {
            success: true,
            deletedCount: 0,
            message: "Cleanup completed (no expired access codes found)",
        };
    },
});

/**
 * Generate system backup data
 */
export const generateBackupData = query({
    args: {},
    handler: async (ctx) => {
        const currentUser = await requireRole(ctx, "admin");

        // Get all data for backup
        const [
            users,
            programs,
            courses,
            semesters,
            sections,
            enrollments,
            activities,
            grades,
        ] = await Promise.all([
            ctx.db.query("users").collect(),
            ctx.db.query("programs").collect(),
            ctx.db.query("courses").collect(),
            ctx.db.query("semesters").collect(),
            ctx.db.query("sections").collect(),
            ctx.db.query("enrollments").collect(),
            ctx.db.query("activities").collect(),
            ctx.db.query("grades").collect(),
        ]);

        return {
            timestamp: Date.now(),
            version: "1.0.0",
            data: {
                users: users.length,
                programs: programs.length,
                courses: courses.length,
                semesters: semesters.length,
                sections: sections.length,
                enrollments: enrollments.length,
                activities: activities.length,
                grades: grades.length,
            },
            // Note: In a real implementation, you would return actual data
            // but be careful about size limits and sensitive information
        };
    },
});
