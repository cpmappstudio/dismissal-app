// ################################################################################
// # File: programs.ts                                                           # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Academic program management functions
 * Handles program creation, requirements, student assignments
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
    getUserByClerkId,
    getProgramCourses,
    calculateAcademicProgress
} from "./helpers";
import {
    programTypeValidator,
    languageValidator,
    courseCategoryValidator
} from "./types";

/**
 * Get all programs with filtering
 */
export const getAllPrograms = query({
    args: {
        type: v.optional(programTypeValidator),
        language: v.optional(languageValidator),
        isActive: v.optional(v.boolean()),
        searchTerm: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        let programs: Doc<"programs">[];

        // Use appropriate index based on filters
        if (args.type !== undefined && args.isActive !== undefined) {
            programs = await ctx.db
                .query("programs")
                .withIndex("by_type_active", q =>
                    q.eq("type", args.type!).eq("isActive", args.isActive!))
                .collect();
        } else if (args.language !== undefined && args.isActive !== undefined) {
            programs = await ctx.db
                .query("programs")
                .withIndex("by_language_active", q =>
                    q.eq("language", args.language!).eq("isActive", args.isActive!))
                .collect();
        } else if (args.isActive !== undefined) {
            programs = await ctx.db
                .query("programs")
                .withIndex("by_active", q => q.eq("isActive", args.isActive!))
                .collect();
        } else {
            programs = await ctx.db.query("programs").collect();
        }

        // Apply additional filters
        if (args.type !== undefined && args.isActive === undefined) {
            programs = programs.filter(program => program.type === args.type);
        }
        if (args.language !== undefined && args.isActive === undefined) {
            programs = programs.filter(program => program.language === args.language);
        }

        // Apply search term filter
        if (args.searchTerm) {
            const searchLower = args.searchTerm.toLowerCase();
            programs = programs.filter(program =>
                program.code.toLowerCase().includes(searchLower) ||
                program.nameEs.toLowerCase().includes(searchLower) ||
                (program.nameEn?.toLowerCase().includes(searchLower))
            );
        }

        return programs;
    },
});

/**
 * Create new program (Admin only)
 */
export const createProgram = mutation({
    args: {
        code: v.string(),
        nameEs: v.string(),
        nameEn: v.optional(v.string()),
        descriptionEs: v.string(),
        descriptionEn: v.optional(v.string()),
        type: programTypeValidator,
        degree: v.optional(v.string()),
        language: languageValidator,
        totalCredits: v.number(),
        durationBimesters: v.number(),
        tuitionPerCredit: v.optional(v.number()),
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

        // Check for duplicate program code
        const existingProgram = await ctx.db
            .query("programs")
            .withIndex("by_code", q => q.eq("code", args.code))
            .first();

        if (existingProgram) {
            throw new ConvexError("Program code already exists");
        }

        // Validate credits and duration
        if (args.totalCredits <= 0) {
            throw new ConvexError("Total credits must be greater than 0");
        }
        if (args.durationBimesters <= 0) {
            throw new ConvexError("Duration must be greater than 0");
        }

        // Create program
        const programId = await ctx.db.insert("programs", {
            ...args,
            isActive: true,
            createdAt: Date.now(),
        });

        return programId;
    },
});

/**
 * Update existing program (Admin only)
 */
export const updateProgram = mutation({
    args: {
        programId: v.id("programs"),
        nameEs: v.optional(v.string()),
        nameEn: v.optional(v.string()),
        descriptionEs: v.optional(v.string()),
        descriptionEn: v.optional(v.string()),
        degree: v.optional(v.string()),
        language: v.optional(languageValidator),
        totalCredits: v.optional(v.number()),
        durationBimesters: v.optional(v.number()),
        tuitionPerCredit: v.optional(v.number()),
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

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Validate credits and duration if provided
        if (args.totalCredits !== undefined && args.totalCredits <= 0) {
            throw new ConvexError("Total credits must be greater than 0");
        }
        if (args.durationBimesters !== undefined && args.durationBimesters <= 0) {
            throw new ConvexError("Duration must be greater than 0");
        }

        // Update program
        const updateData: any = { updatedAt: Date.now() };

        if (args.nameEs !== undefined) updateData.nameEs = args.nameEs;
        if (args.nameEn !== undefined) updateData.nameEn = args.nameEn;
        if (args.descriptionEs !== undefined) updateData.descriptionEs = args.descriptionEs;
        if (args.descriptionEn !== undefined) updateData.descriptionEn = args.descriptionEn;
        if (args.degree !== undefined) updateData.degree = args.degree;
        if (args.language !== undefined) updateData.language = args.language;
        if (args.totalCredits !== undefined) updateData.totalCredits = args.totalCredits;
        if (args.durationBimesters !== undefined) updateData.durationBimesters = args.durationBimesters;
        if (args.tuitionPerCredit !== undefined) updateData.tuitionPerCredit = args.tuitionPerCredit;
        if (args.isActive !== undefined) updateData.isActive = args.isActive;

        await ctx.db.patch(args.programId, updateData);

        return args.programId;
    },
});

/**
 * Get program with courses and requirements
 */
export const getProgramDetails = query({
    args: {
        programId: v.id("programs"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get program courses
        const programCourses = await getProgramCourses(ctx.db, args.programId);

        // Get program requirements
        const requirements = await ctx.db
            .query("program_requirements")
            .withIndex("by_program_active", q =>
                q.eq("programId", args.programId).eq("isActive", true))
            .first();

        // Get student count for this program
        const students = await ctx.db
            .query("users")
            .withIndex("by_role_active", q => q.eq("role", "student").eq("isActive", true))
            .collect();

        const enrolledStudents = students.filter(student =>
            student.studentProfile?.programId === args.programId
        );

        // Organize courses by category
        const coursesByCategory = {
            humanities: programCourses.filter(pc => pc.category === "humanities"),
            core: programCourses.filter(pc => pc.category === "core"),
            elective: programCourses.filter(pc => pc.category === "elective"),
            general: programCourses.filter(pc => pc.category === "general"),
        };

        return {
            program,
            requirements,
            courses: coursesByCategory,
            statistics: {
                totalCourses: programCourses.length,
                requiredCourses: programCourses.filter(pc => pc.isRequired).length,
                electives: programCourses.filter(pc => !pc.isRequired).length,
                enrolledStudents: enrolledStudents.length,
                totalCredits: programCourses.reduce((sum, pc) => sum + pc.course.credits, 0),
            },
        };
    },
});

/**
 * Create or update program requirements (Admin only)
 */
export const setProgramRequirements = mutation({
    args: {
        programId: v.id("programs"),
        requirements: v.object({
            humanities: v.object({
                required: v.number(),
                description: v.optional(v.string()),
            }),
            core: v.object({
                required: v.number(),
                description: v.optional(v.string()),
            }),
            elective: v.object({
                required: v.number(),
                minPerCategory: v.optional(v.number()),
                description: v.optional(v.string()),
            }),
            general: v.object({
                required: v.number(),
                description: v.optional(v.string()),
            }),
            total: v.number(),
        }),
        minGPA: v.number(),
        minCGPA: v.optional(v.number()),
        maxBimesters: v.number(),
        maxYears: v.optional(v.number()),
        probationGPA: v.optional(v.number()),
        suspensionGPA: v.optional(v.number()),
        effectiveDate: v.optional(v.number()), // Defaults to now
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

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Validate requirements
        const totalRequired =
            args.requirements.humanities.required +
            args.requirements.core.required +
            args.requirements.elective.required +
            args.requirements.general.required;

        if (totalRequired !== args.requirements.total) {
            throw new ConvexError("Sum of category requirements must equal total requirements");
        }

        if (args.requirements.total !== program.totalCredits) {
            throw new ConvexError("Total requirements must match program total credits");
        }

        // Validate GPA thresholds
        if (args.minGPA < 0 || args.minGPA > 4.0) {
            throw new ConvexError("Minimum GPA must be between 0 and 4.0");
        }

        // Deactivate existing requirements
        const existingRequirements = await ctx.db
            .query("program_requirements")
            .withIndex("by_program_active", q =>
                q.eq("programId", args.programId).eq("isActive", true))
            .collect();

        for (const req of existingRequirements) {
            await ctx.db.patch(req._id, {
                isActive: false,
                endDate: Date.now(),
                updatedAt: Date.now(),
            });
        }

        // Create new requirements
        const requirementsId = await ctx.db.insert("program_requirements", {
            programId: args.programId,
            requirements: args.requirements,
            minGPA: args.minGPA,
            minCGPA: args.minCGPA,
            maxBimesters: args.maxBimesters,
            maxYears: args.maxYears,
            probationGPA: args.probationGPA,
            suspensionGPA: args.suspensionGPA,
            effectiveDate: args.effectiveDate || Date.now(),
            isActive: true,
            createdAt: Date.now(),
        });

        return requirementsId;
    },
});

/**
 * Get students enrolled in a program
 */
export const getProgramStudents = query({
    args: {
        programId: v.id("programs"),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("on_leave"),
            v.literal("graduated"),
            v.literal("withdrawn")
        )),
        academicStanding: v.optional(v.union(
            v.literal("good_standing"),
            v.literal("probation"),
            v.literal("suspension")
        )),
        includeProgress: v.optional(v.boolean()),
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

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Get all students
        const allStudents = await ctx.db
            .query("users")
            .withIndex("by_role_active", q => q.eq("role", "student").eq("isActive", true))
            .collect();

        // Filter students by program
        let programStudents = allStudents.filter(student =>
            student.studentProfile?.programId === args.programId
        );

        // Apply status filter
        if (args.status) {
            programStudents = programStudents.filter(student =>
                student.studentProfile?.status === args.status
            );
        }

        // Apply academic standing filter
        if (args.academicStanding) {
            programStudents = programStudents.filter(student =>
                student.studentProfile?.academicStanding === args.academicStanding
            );
        }

        // Get student details with progress if requested
        const studentDetails = await Promise.all(
            programStudents.map(async (student) => {
                let academicProgress = null;

                if (args.includeProgress) {
                    academicProgress = await calculateAcademicProgress(ctx.db, student._id);
                }

                return {
                    student,
                    academicProgress,
                };
            })
        );

        // Calculate summary statistics
        const summary: any = {
            totalStudents: studentDetails.length,
            byStatus: {
                active: studentDetails.filter(s => s.student.studentProfile?.status === "active").length,
                inactive: studentDetails.filter(s => s.student.studentProfile?.status === "inactive").length,
                onLeave: studentDetails.filter(s => s.student.studentProfile?.status === "on_leave").length,
                graduated: studentDetails.filter(s => s.student.studentProfile?.status === "graduated").length,
                withdrawn: studentDetails.filter(s => s.student.studentProfile?.status === "withdrawn").length,
            },
            byStanding: {
                goodStanding: studentDetails.filter(s => s.student.studentProfile?.academicStanding === "good_standing").length,
                probation: studentDetails.filter(s => s.student.studentProfile?.academicStanding === "probation").length,
                suspension: studentDetails.filter(s => s.student.studentProfile?.academicStanding === "suspension").length,
            },
        };

        if (args.includeProgress) {
            const progressData = studentDetails
                .filter(s => s.academicProgress)
                .map(s => s.academicProgress!);

            if (progressData.length > 0) {
                summary.averageGPA = progressData.reduce((sum, p) => sum + p.gpa, 0) / progressData.length;
                summary.averageCompletion = progressData.reduce((sum, p) => sum + p.completionPercentage, 0) / progressData.length;
            }
        }

        return {
            program,
            students: studentDetails,
            summary,
        };
    },
});

/**
 * Assign student to program (Admin only)
 */
export const assignStudentToProgram = mutation({
    args: {
        studentId: v.id("users"),
        programId: v.id("programs"),
        studentCode: v.string(),
        enrollmentDate: v.optional(v.number()),
        expectedGraduationDate: v.optional(v.number()),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("on_leave"),
            v.literal("graduated"),
            v.literal("withdrawn")
        )),
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

        const student = await ctx.db.get(args.studentId);
        if (!student || student.role !== "student") {
            throw new ConvexError("Student not found or invalid role");
        }

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new ConvexError("Program not found");
        }

        // Check for duplicate student code
        const existingStudent = await ctx.db
            .query("users")
            .filter(q =>
                q.eq(q.field("role"), "student") &&
                q.neq(q.field("_id"), args.studentId)
            )
            .collect();

        const duplicateCode = existingStudent.find(s =>
            s.studentProfile?.studentCode === args.studentCode
        );

        if (duplicateCode) {
            throw new ConvexError("Student code already exists");
        }

        // Update student with program assignment
        await ctx.db.patch(args.studentId, {
            studentProfile: {
                studentCode: args.studentCode,
                programId: args.programId,
                enrollmentDate: args.enrollmentDate || Date.now(),
                expectedGraduationDate: args.expectedGraduationDate,
                status: args.status || "active",
                academicStanding: "good_standing",
            },
            isActive: true, // Activate student when assigning to program
            updatedAt: Date.now(),
        });

        return {
            studentId: args.studentId,
            programId: args.programId,
            message: "Student successfully assigned to program",
        };
    },
});

/**
 * Get program statistics and analytics (Admin only)
 */
export const getProgramStatistics = query({
    args: {
        programId: v.optional(v.id("programs")),
        includeTrends: v.optional(v.boolean()),
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

        let programs: Doc<"programs">[];

        if (args.programId) {
            const program = await ctx.db.get(args.programId);
            if (!program) {
                throw new ConvexError("Program not found");
            }
            programs = [program];
        } else {
            programs = await ctx.db
                .query("programs")
                .withIndex("by_active", q => q.eq("isActive", true))
                .collect();
        }

        const programStats = await Promise.all(
            programs.map(async (program) => {
                // Get all students in this program
                const allStudents = await ctx.db
                    .query("users")
                    .withIndex("by_role_active", q => q.eq("role", "student").eq("isActive", true))
                    .collect();

                const programStudents = allStudents.filter(student =>
                    student.studentProfile?.programId === program._id
                );

                // Calculate statistics
                const activeStudents = programStudents.filter(s =>
                    s.studentProfile?.status === "active"
                );

                const graduates = programStudents.filter(s =>
                    s.studentProfile?.status === "graduated"
                );

                // Get enrollment trends if requested
                let enrollmentTrends = null;
                if (args.includeTrends) {
                    // Group students by enrollment month
                    const enrollmentsByMonth = programStudents.reduce((acc, student) => {
                        if (!student.studentProfile?.enrollmentDate) return acc;

                        const date = new Date(student.studentProfile.enrollmentDate);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                        acc[monthKey] = (acc[monthKey] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    enrollmentTrends = Object.entries(enrollmentsByMonth)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([month, count]) => ({ month, enrollments: count }));
                }

                return {
                    program,
                    statistics: {
                        totalStudents: programStudents.length,
                        activeStudents: activeStudents.length,
                        graduates: graduates.length,
                        onLeave: programStudents.filter(s => s.studentProfile?.status === "on_leave").length,
                        withdrawn: programStudents.filter(s => s.studentProfile?.status === "withdrawn").length,
                        probation: programStudents.filter(s => s.studentProfile?.academicStanding === "probation").length,
                        suspension: programStudents.filter(s => s.studentProfile?.academicStanding === "suspension").length,
                    },
                    trends: enrollmentTrends,
                };
            })
        );

        return {
            programs: programStats,
            summary: args.programId ? null : {
                totalPrograms: programs.length,
                totalStudents: programStats.reduce((sum, p) => sum + p.statistics.totalStudents, 0),
                totalActiveStudents: programStats.reduce((sum, p) => sum + p.statistics.activeStudents, 0),
                totalGraduates: programStats.reduce((sum, p) => sum + p.statistics.graduates, 0),
            },
        };
    },
});
