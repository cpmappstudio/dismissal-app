// ################################################################################
// # File: reports.ts                                                            # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Document generation and reporting functions
 * Handles transcript generation, certificates, and academic reports
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
    getUserByClerkId,
    calculateAcademicProgress,
    getAcademicHistory,
    calculateGPA,
    validateGraduationRequirements
} from "./helpers";
import { documentTypeValidator, languageValidator } from "./types";

/**
 * Generate transcript data (Student/Admin)
 */
export const generateTranscriptData = query({
    args: {
        studentId: v.optional(v.id("users")), // Admin can generate for any student
        language: v.optional(languageValidator),
        includeInProgress: v.optional(v.boolean()),
        fromDate: v.optional(v.number()),
        toDate: v.optional(v.number()),
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
            // Admin can generate for any student, students only for themselves
            if (user.role === "admin" || user.role === "superadmin") {
                targetStudentId = args.studentId;
            } else if (user.role === "student" && args.studentId === user._id) {
                targetStudentId = args.studentId;
            } else {
                throw new ConvexError("Permission denied");
            }
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required or specify studentId");
        }

        const student = await ctx.db.get(targetStudentId);
        if (!student || student.role !== "student" || !student.studentProfile) {
            throw new ConvexError("Student not found or invalid profile");
        }

        const program = await ctx.db.get(student.studentProfile.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get academic history
        const academicHistory = await getAcademicHistory(ctx.db, targetStudentId);

        // Filter by date range if specified
        let filteredHistory = academicHistory;
        if (args.fromDate || args.toDate) {
            filteredHistory = academicHistory.filter(periodSummary => {
                const periodStart = periodSummary.period.startDate;
                const periodEnd = periodSummary.period.endDate;

                if (args.fromDate && periodEnd < args.fromDate) return false;
                if (args.toDate && periodStart > args.toDate) return false;
                return true;
            });
        }

        // Filter out in-progress courses if not requested
        if (!args.includeInProgress) {
            filteredHistory = filteredHistory.map(periodSummary => ({
                ...periodSummary,
                enrollments: periodSummary.enrollments.filter(e =>
                    e.enrollment.status === "completed" || e.enrollment.status === "failed"
                ),
            })).filter(p => p.enrollments.length > 0);
        }

        // Calculate overall GPA
        const allEnrollments = filteredHistory.flatMap(p =>
            p.enrollments.map(e => e.enrollment)
        ).filter(e => e.countsForGPA);

        const overallGPA = await calculateGPA(ctx.db, allEnrollments);

        // Get academic progress
        const academicProgress = await calculateAcademicProgress(ctx.db, targetStudentId);

        // Get graduation requirements validation
        const graduationValidation = await validateGraduationRequirements(ctx.db, targetStudentId);

        return {
            student: {
                ...student,
                program,
            },
            academicHistory: filteredHistory,
            overallGPA,
            academicProgress,
            graduationValidation,
            generatedAt: Date.now(),
            language: args.language || "en",
            metadata: {
                totalPeriodsIncluded: filteredHistory.length,
                totalCreditsAttempted: overallGPA.attemptedCredits,
                totalCreditsEarned: overallGPA.earnedCredits,
                cumulativeGPA: overallGPA.gpa,
                academicStanding: student.studentProfile.academicStanding,
            },
        };
    },
});

/**
 * Generate enrollment certificate data
 */
export const generateEnrollmentCertificate = query({
    args: {
        studentId: v.optional(v.id("users")),
        periodId: v.optional(v.id("periods")),
        language: v.optional(languageValidator),
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
            if (user.role === "admin" || user.role === "superadmin") {
                targetStudentId = args.studentId;
            } else if (user.role === "student" && args.studentId === user._id) {
                targetStudentId = args.studentId;
            } else {
                throw new ConvexError("Permission denied");
            }
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required or specify studentId");
        }

        const student = await ctx.db.get(targetStudentId);
        if (!student || student.role !== "student" || !student.studentProfile) {
            throw new ConvexError("Student not found or invalid profile");
        }

        const program = await ctx.db.get(student.studentProfile.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get target period (current or specified)
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await ctx.db.query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get current enrollments
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", targetStudentId).eq("periodId", targetPeriod._id))
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        // Get enrollment details
        const enrollmentDetails = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [course, section] = await Promise.all([
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                ]);

                return {
                    enrollment,
                    course,
                    section,
                };
            })
        );

        return {
            student: {
                ...student,
                program,
            },
            period: targetPeriod,
            enrollments: enrollmentDetails,
            generatedAt: Date.now(),
            language: args.language || "en",
            metadata: {
                totalCourses: enrollments.length,
                totalCredits: enrollmentDetails.reduce((sum, e) => sum + (e.course?.credits || 0), 0),
                enrollmentStatus: student.studentProfile.status,
            },
        };
    },
});

/**
 * Generate grade report for a specific period
 */
export const generateGradeReport = query({
    args: {
        studentId: v.optional(v.id("users")),
        periodId: v.id("periods"),
        language: v.optional(languageValidator),
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
            if (user.role === "admin" || user.role === "superadmin") {
                targetStudentId = args.studentId;
            } else if (user.role === "student" && args.studentId === user._id) {
                targetStudentId = args.studentId;
            } else {
                throw new ConvexError("Permission denied");
            }
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required or specify studentId");
        }

        const student = await ctx.db.get(targetStudentId);
        if (!student || student.role !== "student" || !student.studentProfile) {
            throw new ConvexError("Student not found or invalid profile");
        }

        const program = await ctx.db.get(student.studentProfile.programId);
        const period = await ctx.db.get(args.periodId);

        if (!program || !period) {
            throw new ConvexError("Program or period not found");
        }

        // Get enrollments for the period
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", targetStudentId).eq("periodId", args.periodId))
            .collect();

        // Get grade details
        const gradeDetails = await Promise.all(
            enrollments.map(async (enrollment) => {
                const [course, section, professor] = await Promise.all([
                    ctx.db.get(enrollment.courseId),
                    ctx.db.get(enrollment.sectionId),
                    ctx.db.get(enrollment.professorId),
                ]);

                return {
                    enrollment,
                    course,
                    section,
                    professor,
                };
            })
        );

        // Calculate period GPA
        const periodGPA = await calculateGPA(ctx.db, enrollments);

        return {
            student: {
                ...student,
                program,
            },
            period,
            grades: gradeDetails,
            periodGPA,
            generatedAt: Date.now(),
            language: args.language || "en",
            metadata: {
                totalCourses: enrollments.length,
                completedCourses: enrollments.filter(e => e.status === "completed").length,
                failedCourses: enrollments.filter(e => e.status === "failed").length,
                withdrawnCourses: enrollments.filter(e => e.status === "withdrawn" || e.status === "dropped").length,
                totalCredits: gradeDetails.reduce((sum, g) => sum + (g.course?.credits || 0), 0),
            },
        };
    },
});

/**
 * Log document request and return tracking information
 */
export const logDocumentRequest = mutation({
    args: {
        requestedFor: v.optional(v.id("users")), // Admin can request for others
        documentType: documentTypeValidator,
        scope: v.optional(v.object({
            periodId: v.optional(v.id("periods")),
            programId: v.optional(v.id("programs")),
            fromDate: v.optional(v.number()),
            toDate: v.optional(v.number()),
            includeInProgress: v.optional(v.boolean()),
        })),
        format: v.union(v.literal("pdf"), v.literal("html"), v.literal("csv"), v.literal("json")),
        language: languageValidator,
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

        // Determine target user
        let requestedFor = user._id;
        if (args.requestedFor) {
            if (user.role === "admin" || user.role === "superadmin") {
                requestedFor = args.requestedFor;
            } else {
                throw new ConvexError("Only administrators can request documents for other users");
            }
        }

        // Verify requested user exists
        const targetUser = await ctx.db.get(requestedFor);
        if (!targetUser) {
            throw new ConvexError("Target user not found");
        }

        // Create document log entry
        const documentLogId = await ctx.db.insert("document_logs", {
            requestedBy: user._id,
            requestedFor,
            documentType: args.documentType,
            scope: args.scope,
            format: args.format,
            language: args.language === "both" ? "en" : args.language,
            status: "pending",
            generatedAt: Date.now(),
            // Note: In a real implementation, IP address and user agent would be captured
            // from the HTTP context in an action, not a mutation
        });

        return {
            documentLogId,
            trackingNumber: `${args.documentType.toUpperCase()}-${documentLogId.slice(-8)}`,
            status: "pending",
            estimatedTime: "5-10 minutes",
            message: "Document request logged successfully",
        };
    },
});

/**
 * Get document generation history for user
 */
export const getDocumentHistory = query({
    args: {
        userId: v.optional(v.id("users")), // Admin can view for any user
        documentType: v.optional(documentTypeValidator),
        status: v.optional(v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("expired")
        )),
        limit: v.optional(v.number()),
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

        // Determine target user
        let targetUserId = user._id;
        if (args.userId) {
            if (user.role === "admin" || user.role === "superadmin") {
                targetUserId = args.userId;
            } else if (user.role === "student" && args.userId === user._id) {
                targetUserId = args.userId;
            } else {
                throw new ConvexError("Permission denied");
            }
        }

        // Get document logs
        let documentLogs = await ctx.db
            .query("document_logs")
            .withIndex("by_requested_for_type", q =>
                q.eq("requestedFor", targetUserId)
                    .eq("documentType", args.documentType || "transcript"))
            .collect();

        // If no documentType filter was applied, get all documents
        if (!args.documentType) {
            documentLogs = await ctx.db
                .query("document_logs")
                .withIndex("by_requested_by", q => q.eq("requestedBy", targetUserId))
                .collect();
        }

        // Apply status filter
        if (args.status) {
            documentLogs = documentLogs.filter(log => log.status === args.status);
        }

        // Sort by generation date (newest first)
        documentLogs.sort((a, b) => b.generatedAt - a.generatedAt);

        // Apply limit
        if (args.limit) {
            documentLogs = documentLogs.slice(0, args.limit);
        }

        // Get details for each log entry
        const documentDetails = await Promise.all(
            documentLogs.map(async (log) => {
                const [requestedBy, requestedFor] = await Promise.all([
                    ctx.db.get(log.requestedBy),
                    ctx.db.get(log.requestedFor),
                ]);

                return {
                    ...log,
                    requestedByUser: requestedBy,
                    requestedForUser: requestedFor,
                    trackingNumber: `${log.documentType.toUpperCase()}-${log._id.slice(-8)}`,
                    ageInHours: Math.floor((Date.now() - log.generatedAt) / (1000 * 60 * 60)),
                };
            })
        );

        return {
            documents: documentDetails,
            summary: {
                total: documentDetails.length,
                pending: documentDetails.filter(d => d.status === "pending").length,
                completed: documentDetails.filter(d => d.status === "completed").length,
                failed: documentDetails.filter(d => d.status === "failed").length,
            },
        };
    },
});

/**
 * Update document generation status (Internal/Admin use)
 */
export const updateDocumentStatus = mutation({
    args: {
        documentLogId: v.id("document_logs"),
        status: v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("expired")
        ),
        documentUrl: v.optional(v.string()),
        documentHash: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
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

        const documentLog = await ctx.db.get(args.documentLogId);
        if (!documentLog) {
            throw new ConvexError("Document log not found");
        }

        // Update document status
        const updateData: any = {
            status: args.status,
        };

        if (args.documentUrl) updateData.documentUrl = args.documentUrl;
        if (args.documentHash) updateData.documentHash = args.documentHash;
        if (args.errorMessage) updateData.errorMessage = args.errorMessage;
        if (args.expiresAt) updateData.expiresAt = args.expiresAt;

        // Set default expiration for completed documents (30 days)
        if (args.status === "completed" && !args.expiresAt) {
            updateData.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        }

        await ctx.db.patch(args.documentLogId, updateData);

        return {
            documentLogId: args.documentLogId,
            status: args.status,
            message: "Document status updated successfully",
        };
    },
});

/**
 * Generate completion certificate data (for graduated students)
 */
export const generateCompletionCertificate = query({
    args: {
        studentId: v.optional(v.id("users")),
        language: v.optional(languageValidator),
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
            if (user.role === "admin" || user.role === "superadmin") {
                targetStudentId = args.studentId;
            } else if (user.role === "student" && args.studentId === user._id) {
                targetStudentId = args.studentId;
            } else {
                throw new ConvexError("Permission denied");
            }
        } else if (user.role !== "student") {
            throw new ConvexError("Student access required or specify studentId");
        }

        const student = await ctx.db.get(targetStudentId);
        if (!student || student.role !== "student" || !student.studentProfile) {
            throw new ConvexError("Student not found or invalid profile");
        }

        // Check if student has graduated
        if (student.studentProfile.status !== "graduated") {
            throw new ConvexError("Certificate can only be generated for graduated students");
        }

        const program = await ctx.db.get(student.studentProfile.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get graduation validation to ensure requirements were met
        const graduationValidation = await validateGraduationRequirements(ctx.db, targetStudentId);
        if (!graduationValidation?.isEligible) {
            throw new ConvexError("Student does not meet graduation requirements");
        }

        // Get academic summary
        const academicProgress = await calculateAcademicProgress(ctx.db, targetStudentId);
        if (!academicProgress) {
            throw new ConvexError("Unable to calculate academic progress");
        }

        // Get all completed enrollments for transcript summary
        const allEnrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", q => q.eq("studentId", targetStudentId))
            .filter(q => q.eq(q.field("status"), "completed"))
            .collect();

        const overallGPA = await calculateGPA(ctx.db, allEnrollments);

        return {
            student: {
                ...student,
                program,
            },
            academicSummary: {
                totalCreditsCompleted: academicProgress.creditsCompleted,
                cumulativeGPA: overallGPA.gpa,
                programCompletionDate: student.studentProfile.expectedGraduationDate || Date.now(),
                academicStanding: student.studentProfile.academicStanding,
            },
            graduationValidation,
            generatedAt: Date.now(),
            language: args.language || "en",
            certificateNumber: `${program.code}-${student.studentProfile.studentCode}-${new Date().getFullYear()}`,
        };
    },
});

/**
 * Get academic analytics for reporting (Admin only)
 */
export const getAcademicAnalytics = query({
    args: {
        periodId: v.optional(v.id("periods")),
        programId: v.optional(v.id("programs")),
        includeGradeDistribution: v.optional(v.boolean()),
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

        // Get target period
        const targetPeriod = args.periodId
            ? await ctx.db.get(args.periodId)
            : await ctx.db.query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

        if (!targetPeriod) {
            throw new ConvexError("Period not found");
        }

        // Get enrollments for analysis
        let enrollments = await ctx.db
            .query("enrollments")
            .filter(q => q.eq(q.field("periodId"), targetPeriod._id))
            .collect();

        // Filter by program if specified
        if (args.programId) {
            const programStudents = await ctx.db
                .query("users")
                .withIndex("by_role_active", q => q.eq("role", "student").eq("isActive", true))
                .collect();

            const programStudentIds = new Set(
                programStudents
                    .filter(s => s.studentProfile?.programId === args.programId)
                    .map(s => s._id)
            );

            enrollments = enrollments.filter(e => programStudentIds.has(e.studentId));
        }

        // Basic statistics
        const totalEnrollments = enrollments.length;
        const completedEnrollments = enrollments.filter(e => e.status === "completed");
        const failedEnrollments = enrollments.filter(e => e.status === "failed");
        const withdrawnEnrollments = enrollments.filter(e => e.status === "withdrawn" || e.status === "dropped");
        const gradedEnrollments = enrollments.filter(e => e.percentageGrade !== undefined);

        // Grade distribution
        let gradeDistribution: any = null;
        if (args.includeGradeDistribution) {
            gradeDistribution = {
                "A+": 0, "A": 0, "A-": 0,
                "B+": 0, "B": 0, "B-": 0,
                "C+": 0, "C": 0, "C-": 0,
                "D+": 0, "D": 0, "F": 0
            };

            gradedEnrollments.forEach(enrollment => {
                if (enrollment.letterGrade && enrollment.letterGrade in gradeDistribution) {
                    gradeDistribution[enrollment.letterGrade as keyof typeof gradeDistribution]++;
                }
            });
        }

        // Calculate average GPA
        const averageGPA = gradedEnrollments.length > 0
            ? gradedEnrollments.reduce((sum, e) => sum + (e.gradePoints || 0), 0) / gradedEnrollments.length
            : 0;

        return {
            period: targetPeriod,
            programId: args.programId,
            analytics: {
                enrollmentStatistics: {
                    total: totalEnrollments,
                    completed: completedEnrollments.length,
                    failed: failedEnrollments.length,
                    withdrawn: withdrawnEnrollments.length,
                    inProgress: enrollments.filter(e => e.status === "enrolled").length,
                },
                gradeStatistics: {
                    graded: gradedEnrollments.length,
                    pending: totalEnrollments - gradedEnrollments.length,
                    averageGPA: Math.round(averageGPA * 100) / 100,
                    passRate: gradedEnrollments.length > 0
                        ? Math.round(completedEnrollments.length / gradedEnrollments.length * 100 * 100) / 100
                        : 0,
                },
                gradeDistribution,
            },
            generatedAt: Date.now(),
        };
    },
});
