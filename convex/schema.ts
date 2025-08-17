// ################################################################################
// # File: schema.tsx                                                             # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * HISTORY: Alef University’s Academic Records and Grading System (MVP). A Convex schema
 * designed to manage students, faculty, courses, and transcripts. The tables used are:
 * * users - Stores user information and profiles.
 * * programs - Stores academic program information.
 * * semesters - Stores academic period information.
 * * courses - Stores course catalog information.
 * * sections - Stores information about course sections offered each semester.
 * * enrollments - Stores student enrollments in sections.
 * * activities - Stores information about student activities and participation.
 * * grades - Stores student grades for activities.
 * * accessList - Stores pre-authorized registration emails.
 * * announcements - Stores important updates and notifications for students related to sections.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Users table with role-based profiles.
   */
  users: defineTable({
    // Authentication
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),

    // Core fields
    role: v.union(v.literal("student"), v.literal("professor"), v.literal("admin")),
    isActive: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),

    // Contact
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),

    // Student-specific
    studentProfile: v.optional(v.object({
      studentCode: v.string(),
      programId: v.id("programs"),
      enrollmentYear: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("graduated")
      ),
      // Privacy settings
      showProfile: v.boolean(),
      showCourses: v.boolean(),
      showGrades: v.boolean(),
    })),

    // Professor-specific
    professorProfile: v.optional(v.object({
      employeeCode: v.string(),
      department: v.string(),
      title: v.optional(v.string()),
    })),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role_active", ["role", "isActive"]),

  /**
   * Academic programs.
   */
  programs: defineTable({
    code: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("diploma program"),
      v.literal("bachelor’s degree"),
      v.literal("master’s degree"),
      v.literal("doctorate")
    ),
    department: v.string(),
    totalCredits: v.number(),
    durationSemesters: v.number(),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  /**
   * Academic periods.
   */
  semesters: defineTable({
    code: v.string(), // "2025-I"
    year: v.number(),
    period: v.union(v.literal("I"), v.literal("II"), v.literal("summer")),
    startDate: v.number(),
    endDate: v.number(),
    enrollmentStart: v.number(),
    enrollmentEnd: v.number(),
    status: v.union(
      v.literal("planning"),
      v.literal("enrollment"),
      v.literal("active"),
      v.literal("finished")
    ),
  })
    .index("by_year_period", ["year", "period"])
    .index("by_status", ["status"]),

  /**
   * Course catalog.
   */
  courses: defineTable({
    code: v.string(),
    name: v.string(),
    description: v.string(),
    credits: v.number(),
    programId: v.id("programs"),
    area: v.union(
      v.literal("core"),
      v.literal("elective"),
      v.literal("general")
    ),
    // Prerequisites as course codes to avoid circular deps
    prerequisites: v.array(v.string()),
    minSemester: v.number(),
    isActive: v.boolean(),
  })
    .index("by_program_active", ["programId", "isActive"])
    .index("by_code", ["code"]),

  /**
   * Course sections offered each semester.
   */
  sections: defineTable({
    courseId: v.id("courses"),
    semesterId: v.id("semesters"),
    sectionNumber: v.string(), // "01", "02"
    crn: v.string(), // Unique identifier

    professorId: v.id("users"),

    // Schedule as flexible array
    schedule: v.array(v.object({
      day: v.number(), // 0-6
      startTime: v.string(), // "14:00"
      endTime: v.string(),
      room: v.string(),
    })),

    capacity: v.number(),
    enrolled: v.number(),

    // Grade distribution as JSON for flexibility
    // Example: {"exams": 40, "assignments": 30, "project": 30}
    gradeWeights: v.string(),

    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("closed"),
      v.literal("active"),
      v.literal("finished")
    ),
  })
    .index("by_semester_status", ["semesterId", "status"])
    .index("by_professor_semester", ["professorId", "semesterId"])
    .index("by_crn", ["crn"]),

  /**
   * Student enrollments in sections.
   */
  enrollments: defineTable({
    studentId: v.id("users"),
    sectionId: v.id("sections"),

    // Denormalized for query performance only
    semesterId: v.id("semesters"),
    courseId: v.id("courses"),

    enrolledAt: v.number(),

    status: v.union(
      v.literal("enrolled"),
      v.literal("dropped"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("incomplete")
    ),

    // Final results only
    finalGrade: v.optional(v.number()),
    letterGrade: v.optional(v.string()),
    creditsEarned: v.optional(v.number()),

    // Metadata
    droppedAt: v.optional(v.number()),
    isRetake: v.boolean(),
  })
    .index("by_student_semester", ["studentId", "semesterId"])
    .index("by_section_status", ["sectionId", "status"])
    .index("by_student_status", ["studentId", "status"]),

  /**
   * Activities and assignments.
   */
  activities: defineTable({
    sectionId: v.id("sections"),
    title: v.string(),
    description: v.string(),

    // Flexible category
    category: v.union(
      v.literal("exam"),
      v.literal("quiz"),
      v.literal("lab"),
      v.literal("assignment"),
      v.literal("project")
    ),

    weight: v.number(), // Percentage of final grade
    maxPoints: v.number(),

    assignedAt: v.number(),
    dueAt: v.optional(v.number()),

    isVisible: v.boolean(),
    gradesReleased: v.boolean(),
  })
    .index("by_section_visible", ["sectionId", "isVisible"])
    .index("by_due", ["dueAt"]),

  /**
   * Student grades for activities.
   */
  grades: defineTable({
    activityId: v.id("activities"),
    enrollmentId: v.id("enrollments"),

    score: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    gradedAt: v.optional(v.number()),

    feedback: v.optional(v.string()),
    gradedBy: v.optional(v.id("users")),
  })
    .index("by_enrollment", ["enrollmentId"])
    .index("by_activity", ["activityId"]),

  /**
   * Pre-authorized registration emails.
   */
  accessList: defineTable({
    email: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("professor"),
      v.literal("admin")
    ),

    // Pre-assignments
    programId: v.optional(v.id("programs")),
    studentCode: v.optional(v.string()),

    // Control
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),

    // Status
    isUsed: v.boolean(),
    usedAt: v.optional(v.number()),
    usedBy: v.optional(v.id("users")),
  })
    .index("by_email_unused", ["email", "isUsed"])
    .index("by_created", ["createdBy", "createdAt"]),

  /**
   * Course announcements.
   */
  announcements: defineTable({
    sectionId: v.id("sections"),
    title: v.string(),
    content: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
    isPinned: v.boolean(),
  })
    .index("by_section_pinned", ["sectionId", "isPinned", "createdAt"]),
});