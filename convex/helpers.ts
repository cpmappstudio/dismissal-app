// ################################################################################
// # File: schema.ts                                                              # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * ALEF UNIVERSITY: Student Information System (SIS)
 * Schema optimized for American grading system and bimester-based academic periods.
 * 
 * PERFORMANCE NOTES (Convex Best Practices):
 * - Indexes are designed to avoid full table scans on tables > 1000 documents
 * - Compound indexes ordered by selectivity (most selective field first)
 * - No redundant indexes (if we have ["a", "b"], we don't need ["a"])
 * - Maximum 32 indexes per table (we use ~4-5 per table)
 * - Strategic denormalization in enrollments table for dashboard queries
 * 
 * QUERY PATTERNS SUPPORTED:
 * - Student dashboard: Progress by category, GPA calculation, current enrollments
 * - Professor dashboard: Sections by period, grade submission, student lists
 * - Admin dashboard: Program management, enrollment statistics, user management
 * - Document generation: Transcripts, certificates with audit trail
 * 
 * Tables:
 * 1. users - Students, professors, admins (indexed by role, clerk_id, email)
 * 2. programs - Academic programs (indexed by code, type, language)
 * 3. periods - Bimester periods (indexed by year, status, dates)
 * 4. courses - Course catalog (indexed by code, category, language)
 * 5. program_courses - Many-to-many relationship (indexed by program, course)
 * 6. sections - Course sections (indexed by CRN, period, professor)
 * 7. enrollments - Student enrollments with grades (indexed by student, section, period)
 * 8. program_requirements - Credit requirements (indexed by program, dates)
 * 9. announcements - Section announcements (indexed by section, type)
 * 10. document_logs - Certificate/transcript audit (indexed by user, type, date)
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    /**
     * Users table - Students, Professors, Admins
     */
    users: defineTable({
        // Authentication
        clerkId: v.string(),
        email: v.string(),

        // Personal information
        firstName: v.string(),
        lastName: v.string(),
        secondLastName: v.optional(v.string()), // Common in Latin America

        // Additional fields for certificates
        dateOfBirth: v.optional(v.number()),
        nationality: v.optional(v.string()),
        documentType: v.optional(v.union(
            v.literal("passport"),
            v.literal("national_id"),
            v.literal("driver_license"),
            v.literal("other")
        )),
        documentNumber: v.optional(v.string()),

        // Contact
        phone: v.optional(v.string()),
        country: v.optional(v.string()),
        address: v.optional(v.object({
            street: v.optional(v.string()),
            city: v.optional(v.string()),
            state: v.optional(v.string()),
            zipCode: v.optional(v.string()),
            country: v.optional(v.string()),
        })),

        // System fields
        role: v.union(
            v.literal("student"),
            v.literal("professor"),
            v.literal("admin"),
            v.literal("superadmin"),
        ),
        isActive: v.boolean(),
        createdBy: v.optional(v.id("users")),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
        lastLoginAt: v.optional(v.number()),

        // Student-specific
        studentProfile: v.optional(v.object({
            studentCode: v.string(), // Student ID number
            programId: v.id("programs"),
            enrollmentDate: v.number(),
            expectedGraduationDate: v.optional(v.number()),
            status: v.union(
                v.literal("active"),
                v.literal("inactive"),
                v.literal("on_leave"),
                v.literal("graduated"),
                v.literal("withdrawn")
            ),
            // Academic standing
            academicStanding: v.optional(v.union(
                v.literal("good_standing"),
                v.literal("probation"),
                v.literal("suspension")
            )),
        })),

        // Professor-specific
        professorProfile: v.optional(v.object({
            employeeCode: v.string(),
            title: v.optional(v.string()), // Dr., Prof., etc.
            department: v.optional(v.string()),
            hireDate: v.optional(v.number()),
        })),
    })
        .index("by_clerk_id", ["clerkId"])
        .index("by_email", ["email"])
        .index("by_role_active", ["role", "isActive"])
        .index("by_document", ["documentType", "documentNumber"]),

    /**
     * Academic programs
     */
    programs: defineTable({
        code: v.string(),
        nameEs: v.string(),
        nameEn: v.optional(v.string()),
        descriptionEs: v.string(),
        descriptionEn: v.optional(v.string()),

        type: v.union(
            v.literal("diploma"),
            v.literal("bachelor"),
            v.literal("master"),
            v.literal("doctorate")
        ),

        degree: v.optional(v.string()), // "Bachelor of Arts", "Master of Science", etc.

        language: v.union(
            v.literal("es"),
            v.literal("en"),
            v.literal("both")
        ),

        totalCredits: v.number(),
        durationBimesters: v.number(),

        // Costs (optional for financial module)
        tuitionPerCredit: v.optional(v.number()),

        isActive: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_code", ["code"])
        .index("by_active", ["isActive"]) // For admin dashboard summary
        .index("by_type_active", ["type", "isActive"])
        .index("by_language_active", ["language", "isActive"]), // Combined for efficiency

    /**
     * Academic periods (bimesters)
     */
    periods: defineTable({
        code: v.string(), // "2024-B2"
        year: v.number(),
        bimesterNumber: v.number(), // 1-6

        nameEs: v.string(), // "Segundo Bimestre 2024"
        nameEn: v.optional(v.string()), // "Second Bimester 2024"

        // Period dates
        startDate: v.number(),
        endDate: v.number(),

        // Important dates
        enrollmentStart: v.number(),
        enrollmentEnd: v.number(),
        addDropDeadline: v.optional(v.number()),
        withdrawalDeadline: v.optional(v.number()),
        gradingStart: v.optional(v.number()),
        gradingDeadline: v.number(),

        status: v.union(
            v.literal("planning"),
            v.literal("enrollment"),
            v.literal("active"),
            v.literal("grading"),
            v.literal("closed")
        ),

        isCurrentPeriod: v.boolean(),

        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_year_bimester", ["year", "bimesterNumber"])
        .index("by_status", ["status"])
        .index("by_current", ["isCurrentPeriod"])
        .index("by_dates", ["startDate", "endDate"]),

    /**
     * Course catalog (shared across programs)
     */
    courses: defineTable({
        code: v.string(),
        nameEs: v.string(),
        nameEn: v.optional(v.string()),
        descriptionEs: v.string(),
        descriptionEn: v.optional(v.string()),

        credits: v.number(),

        // Course level
        level: v.optional(v.union(
            v.literal("introductory"),
            v.literal("intermediate"),
            v.literal("advanced"),
            v.literal("graduate")
        )),

        language: v.union(
            v.literal("es"),
            v.literal("en"),
            v.literal("both")
        ),

        // Category for requirements
        category: v.union(
            v.literal("humanities"),
            v.literal("core"),
            v.literal("elective"),
            v.literal("general")
        ),

        // Prerequisites (course codes)
        prerequisites: v.array(v.string()),
        corequisites: v.optional(v.array(v.string())),

        // Additional metadata
        syllabus: v.optional(v.string()), // URL or document reference

        isActive: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_code", ["code"])
        .index("by_active", ["isActive"]) // For listing all active courses
        .index("by_category_active", ["category", "isActive"])
        .index("by_language_active", ["language", "isActive"]) // Combined index
        .index("by_level_active", ["level", "isActive"]), // For course filtering by level

    /**
     * Program-Course relationship (many-to-many)
     * Allows courses to be shared across programs
     */
    program_courses: defineTable({
        programId: v.id("programs"),
        courseId: v.id("courses"),

        // Override category for this specific program (A course asociated to different programs
        // may have different categories)
        categoryOverride: v.optional(v.union(
            v.literal("humanities"),
            v.literal("core"),
            v.literal("elective"),
            v.literal("general")
        )),

        // Is this course required for this program?
        isRequired: v.boolean(),

        isActive: v.boolean(),
        createdAt: v.number(),
    })
        .index("by_course", ["courseId"])
        .index("by_program_course", ["programId", "courseId"]) // Serves both by_program and by_program_course queries
        .index("by_program_required", ["programId", "isRequired", "isActive"]), // Added isActive for better filtering

    /**
     * Course sections
     */
    sections: defineTable({
        courseId: v.id("courses"),
        periodId: v.id("periods"),
        groupNumber: v.string(), // "01", "02"
        crn: v.string(), // Course Reference Number

        professorId: v.id("users"),

        // Capacity management
        capacity: v.number(),
        enrolled: v.number(),
        waitlistCapacity: v.optional(v.number()),
        waitlisted: v.optional(v.number()),

        // Delivery method
        deliveryMethod: v.union(
            v.literal("online_sync"), // Synchronous online
            v.literal("online_async"), // Asynchronous online
            v.literal("hybrid"),
            v.literal("in_person")
        ),

        // Virtual schedule
        schedule: v.optional(v.object({
            sessions: v.array(v.object({
                day: v.union(
                    v.literal("monday"),
                    v.literal("tuesday"),
                    v.literal("wednesday"),
                    v.literal("thursday"),
                    v.literal("friday"),
                    v.literal("saturday"),
                    v.literal("sunday")
                ),
                startTime: v.string(), // "14:00"
                endTime: v.string(), // "16:00"
                roomUrl: v.optional(v.string()), // Zoom/Meet link
            })),
            timezone: v.string(), // "America/Bogota"
            notes: v.optional(v.string()),
        })),

        // Status tracking
        status: v.union(
            v.literal("draft"),
            v.literal("open"),
            v.literal("closed"),
            v.literal("active"),
            v.literal("grading"),
            v.literal("completed")
        ),

        gradesSubmitted: v.boolean(),
        gradesSubmittedAt: v.optional(v.number()),

        isActive: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_crn", ["crn"])
        .index("by_course_period", ["courseId", "periodId"])
        .index("by_period_status_active", ["periodId", "status", "isActive"]) // Combined index
        .index("by_professor_period", ["professorId", "periodId", "isActive"]), // Added isActive for filtering

    /**
     * Student enrollments with grades
     */
    enrollments: defineTable({
        // Core references
        studentId: v.id("users"),
        sectionId: v.id("sections"),

        // Denormalized for performance
        periodId: v.id("periods"),
        courseId: v.id("courses"),
        professorId: v.id("users"),

        // Enrollment tracking
        enrolledAt: v.number(),
        enrolledBy: v.optional(v.id("users")), // Who enrolled the student

        // Status
        status: v.union(
            v.literal("enrolled"),
            v.literal("withdrawn"), // Before deadline
            v.literal("dropped"), // After deadline
            v.literal("completed"),
            v.literal("failed"),
            v.literal("incomplete"),
            v.literal("in_progress")
        ),

        // Status change tracking
        statusChangedAt: v.optional(v.number()),
        statusChangedBy: v.optional(v.id("users")),
        statusChangeReason: v.optional(v.string()),

        // AMERICAN GRADING SYSTEM
        // Professor enters percentage, system calculates the rest
        percentageGrade: v.optional(v.number()), // 0-100
        letterGrade: v.optional(v.string()), // A+, A, A-, B+, etc.
        gradePoints: v.optional(v.number()), // 4.0 scale
        qualityPoints: v.optional(v.number()), // gradePoints * credits

        // Grade metadata
        gradedBy: v.optional(v.id("users")),
        gradedAt: v.optional(v.number()),
        gradeNotes: v.optional(v.string()),
        lastGradeUpdate: v.optional(v.number()),

        // Special flags
        isRetake: v.boolean(),
        isAuditing: v.boolean(),
        countsForGPA: v.boolean(),
        countsForProgress: v.boolean(),

        // For incomplete grades
        incompleteDeadline: v.optional(v.number()),

        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_student_period", ["studentId", "periodId"])
        .index("by_student_section", ["studentId", "sectionId"])
        .index("by_section", ["sectionId"])
        .index("by_student_course", ["studentId", "courseId"])
        .index("by_status_period", ["status", "periodId"])
        .index("by_professor_period", ["professorId", "periodId"]),

    /**
     * Program requirements for progress tracking
     */
    program_requirements: defineTable({
        programId: v.id("programs"),

        // Credit distribution
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

        // Graduation requirements
        minGPA: v.number(), // Minimum GPA to graduate
        minCGPA: v.optional(v.number()), // Minimum cumulative GPA
        maxBimesters: v.number(),
        maxYears: v.optional(v.number()),

        // Probation thresholds
        probationGPA: v.optional(v.number()),
        suspensionGPA: v.optional(v.number()),

        effectiveDate: v.number(),
        endDate: v.optional(v.number()),
        isActive: v.boolean(),

        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_program_active", ["programId", "isActive"])
        .index("by_program_dates", ["programId", "effectiveDate"]),

    /**
     * Section announcements
     */
    announcements: defineTable({
        sectionId: v.id("sections"),
        authorId: v.id("users"),

        title: v.string(),
        content: v.string(),

        // Type/Priority
        type: v.union(
            v.literal("general"),
            v.literal("assignment"),
            v.literal("exam"),
            v.literal("schedule"),
            v.literal("urgent")
        ),

        // Visibility
        isPublished: v.boolean(),
        publishedAt: v.optional(v.number()),

        // Optional expiration
        expiresAt: v.optional(v.number()),

        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_section_published", ["sectionId", "isPublished"])
        .index("by_author", ["authorId"])
        .index("by_type", ["type"])
        .index("by_created", ["createdAt"]),

    /**
     * Document generation audit log
     * Tracks all certificates, transcripts, and reports generated
     */
    document_logs: defineTable({
        // Who requested the document
        requestedBy: v.id("users"),
        requestedFor: v.id("users"), // Can be different for admin generating for student

        // Document details
        documentType: v.union(
            v.literal("transcript"),
            v.literal("enrollment_certificate"),
            v.literal("grade_report"),
            v.literal("completion_certificate"),
            v.literal("degree"),
            v.literal("schedule"),
            v.literal("other")
        ),

        // Scope
        scope: v.optional(v.object({
            periodId: v.optional(v.id("periods")),
            programId: v.optional(v.id("programs")),
            fromDate: v.optional(v.number()),
            toDate: v.optional(v.number()),
            includeInProgress: v.optional(v.boolean()),
        })),

        // Document metadata
        format: v.union(
            v.literal("pdf"),
            v.literal("html"),
            v.literal("csv"),
            v.literal("json")
        ),

        language: v.union(
            v.literal("es"),
            v.literal("en")
        ),

        // Storage reference (could be URL, file ID, etc.)
        documentUrl: v.optional(v.string()),
        documentHash: v.optional(v.string()), // For integrity verification

        // Status
        status: v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("expired")
        ),

        errorMessage: v.optional(v.string()),

        // Timestamps
        generatedAt: v.number(),
        expiresAt: v.optional(v.number()),

        // IP tracking for security
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
    })
        .index("by_requested_by", ["requestedBy", "generatedAt"]) // Added generatedAt for sorting
        .index("by_requested_for_type", ["requestedFor", "documentType", "status"]) // Combined index
        .index("by_generated", ["generatedAt"]),
});

/**
 * CONVEX LIMITS AND PERFORMANCE CONSIDERATIONS:
 * 
 * 1. Document size: Max 1MB per document (we're well below with our schema)
 * 2. Nesting depth: Max 16 levels (our max is 3 levels)
 * 3. Index limit: Max 32 indexes per table (we use 3-5 per table)
 * 4. Query performance:
 *    - Indexes prevent full table scans on large tables (1000+ docs)
 *    - Compound indexes can serve multiple query patterns
 *    - First field in compound index should be most selective
 * 5. Denormalization trade-offs:
 *    - enrollments table includes periodId, courseId, professorId for fast dashboards
 *    - Reduces query complexity at the cost of storage
 * 
 * EXPECTED SCALE:
 * - ~250 active students (from PDF requirements)
 * - ~9,000 historical enrollment records
 * - 6 periods per year
 * - Multiple programs with shared courses
 * 
 * INDEX STRATEGY:
 * - Primary access patterns covered by compound indexes
 * - No redundant indexes (compound indexes serve prefix queries)
 * - Status fields included in indexes for filtering active records
 * - Timestamp fields in indexes for sorting and pagination
 */