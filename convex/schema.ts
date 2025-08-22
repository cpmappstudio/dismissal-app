// ################################################################################
// # File: schema.ts                                                              # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * HISTORY: Alef University's Student Information System (SIS)
 * Minimal viable schema for grade management and transcripts.
 * 
 * Core functionality:
 * - Student enrollment and grade tracking
 * - Progress visualization
 * - Transcript generation
 * - Professor grade submission
 * 
 * Tables (only what's needed):
 * 1. users - Students, professors, admins
 * 2. programs - Academic programs  
 * 3. periods - Academic periods
 * 4. courses - Course catalog with categories
 * 5. sections - Course sections (combines section + group concept)
 * 6. enrollments - Student enrollments with grades
 * 7. program_requirements - Credit requirements for progress bar
 * 8. accessList - Registration whitelist
 * 9. userTemplates - Pre-registration data
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
    name: v.string(),

    // Core fields
    role: v.union(
      v.literal("student"),
      v.literal("professor"),
      v.literal("admin"),
      v.literal("superadmin"),
    ),
    isActive: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),

    // Contact
    phone: v.optional(v.string()),
    country: v.optional(v.string()),

    // Student-specific
    studentProfile: v.optional(v.object({
      studentCode: v.string(),
      programId: v.id("programs"),
      enrollmentDate: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("graduated")
      ),
    })),

    // Professor-specific
    professorProfile: v.optional(v.object({
      employeeCode: v.string(),
      title: v.optional(v.string()),  // Dr., Prof., etc.
    })),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role_active", ["role", "isActive"]),

  /**
   * Academic programs (e.g., Bachelor's in Computer Science)
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
    language: v.union(
      v.literal("es"),
      v.literal("en"),
      v.literal("both")
    ),
    totalCredits: v.number(),
    durationBimesters: v.number(),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"])
    .index("by_language", ["language"]),

  /**
   * Academic periods (semesters, quarters, intensive)
   */
  periods: defineTable({
    code: v.string(),              // "2024-2"
    year: v.number(),
    bimesterNumber: v.number(),          // 1-6 (six bimesters per year)
    startDate: v.number(),
    endDate: v.number(),
    name: v.string(),              // "AGOSTO/2024 - DICIEMBRE/2024"

    // Key dates
    enrollmentStart: v.number(),
    enrollmentEnd: v.number(),
    gradingDeadline: v.number(),

    status: v.union(
      v.literal("planning"),
      v.literal("enrollment"),
      v.literal("active"),
      v.literal("grading"),
      v.literal("closed")
    ),

    isCurrentPeriod: v.boolean(),
  })
    .index("by_year_bimester", ["year", "bimesterNumber"])
    .index("by_status", ["status"])
    .index("by_current", ["isCurrentPeriod"]),

  /**
   * Course catalog
   */
  courses: defineTable({
    code: v.string(),
    nameEs: v.string(),
    nameEn: v.optional(v.string()),
    descriptionEs: v.string(),
    descriptionEn: v.optional(v.string()),
    credits: v.number(),
    programId: v.id("programs"),

    language: v.union(             // Language of instruction
      v.literal("es"),
      v.literal("en"),
      v.literal("both")
    ),

    // Category for requirements (40 humanities, 60 core, 20 electives)
    category: v.union(
      v.literal("humanities"),
      v.literal("core"),          // Troncales
      v.literal("elective"),
      v.literal("general")
    ),

    // Prerequisites (course codes)
    prerequisites: v.array(v.string()),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_program_active", ["programId", "isActive"])
    .index("by_program_category", ["programId", "category"])
    .index("by_language", ["language"]),

  /**
   * Course sections (simplified - no separate groups table)
   * Each section has one professor and one schedule
   */
  sections: defineTable({
    courseId: v.id("courses"),
    periodId: v.id("periods"),
    groupNumber: v.string(),       // "01", "02" - what students see as GRUPO
    crn: v.string(),              // Unique identifier for registration

    professorId: v.id("users"),

    // Capacity
    capacity: v.number(),
    enrolled: v.number(),

    // Simple schedule (when professor needs to know class times)
    scheduleNote: v.optional(v.string()),   // "Mon/Wed 2-4pm, Room A-101"

    // Status
    isActive: v.boolean(),
    gradesSubmitted: v.boolean(),

    status: v.union(
      v.literal("open"),          // Open for enrollment
      v.literal("active"),        // Currently running
      v.literal("grading"),       // Grade submission period
      v.literal("closed")         // Finished
    ),
  })
    .index("by_crn", ["crn"])
    .index("by_course_period", ["courseId", "periodId"])
    .index("by_period_status", ["periodId", "status"])
    .index("by_professor_period", ["professorId", "periodId"]),

  /**
   * Student enrollments with integrated grading
   * This is where grades are stored
   */
  enrollments: defineTable({
    // Core references
    studentId: v.id("users"),
    sectionId: v.id("sections"),

    // Denormalized for performance
    periodId: v.id("periods"),
    courseId: v.id("courses"),

    // Enrollment data
    enrolledAt: v.number(),        // Registration date (Fecha Matrícula)

    // Status
    status: v.union(
      v.literal("enrolled"),
      v.literal("cancelled"),      // With cancellation date
      v.literal("completed"),
      v.literal("failed"),
      v.literal("incomplete")
    ),

    // Cancellation tracking
    cancellationDate: v.optional(v.number()),
    reactivationDate: v.optional(v.number()),

    // AMERICAN GRADING SYSTEM
    percentageGrade: v.optional(v.number()),    // 0-100 numerical grade
    letterGrade: v.optional(v.string()),        // A, B, C, D, F, I
    gradePoints: v.optional(v.number()),        // 4.0, 3.0, 2.0, 1.0, 0.0
    qualityPoints: v.optional(v.number()),      // gradePoints * credits

    // Metadata
    gradedBy: v.optional(v.id("users")),
    gradedAt: v.optional(v.number()),
    gradeNotes: v.optional(v.string()),

    // Flags
    isRetake: v.boolean(),
    countsForGPA: v.boolean(),
  })
    .index("by_student_period", ["studentId", "periodId"])
    .index("by_student_period_status", ["studentId", "periodId", "status"])
    .index("by_section", ["sectionId"])
    .index("by_student_course", ["studentId", "courseId"]),

  /**
   * Program requirements for progress visualization
   * Defines the 40-60-20 credit distribution
   */
  program_requirements: defineTable({
    programId: v.id("programs"),

    // Credit requirements
    humanitiesCredits: v.number(),
    coreCredits: v.number(),
    electiveCredits: v.number(),
    generalCredits: v.number(),        // General education credits
    totalCredits: v.number(),

    // Graduation requirements
    minGPA: v.number(),                 // Minimum GPA to graduate
    maxBimesters: v.number(),

    effectiveDate: v.number(),
    isActive: v.boolean(),
  })
    .index("by_program_active", ["programId", "isActive"]),

  /**
   * Access control - Whitelist for registration
   */
  accessList: defineTable({
    email: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("professor"),
      v.literal("admin")
    ),

    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),

    isUsed: v.boolean(),
    usedAt: v.optional(v.number()),
    usedBy: v.optional(v.id("users")),
  })
    .index("by_email_unused", ["email", "isUsed"]),

  /**
   * User templates - Pre-registration data
   */
  userTemplates: defineTable({
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),

    // Student-specific
    programId: v.optional(v.id("programs")),
    studentCode: v.optional(v.string()),

    // Professor-specific
    employeeCode: v.optional(v.string()),
    title: v.optional(v.string()),

    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),
});