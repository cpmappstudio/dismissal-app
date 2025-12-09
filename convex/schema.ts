// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Users/workers table - Simplified for username-based auth
   */
  users: defineTable({
    clerkId: v.string(),
    username: v.optional(v.string()), // Made optional for Clerk-only users
    email: v.optional(v.string()), // Required for matching

    // Display info (sync from Clerk)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()), // Computed name
    imageUrl: v.optional(v.string()),

    // Role-based access control
    role: v.optional(
      v.union(
        v.literal("viewer"),
        v.literal("dispatcher"),
        v.literal("allocator"),
        v.literal("operator"),
        v.literal("admin"),
        v.literal("superadmin"),
      ),
    ),

    // Campus assignment - References to campusSettings documents
    assignedCampuses: v.array(v.id("campusSettings")),

    // Legacy operator permissions (deprecated, use role instead)
    operatorPermissions: v.optional(
      v.object({
        canAllocate: v.boolean(),
        canDispatch: v.boolean(),
        canView: v.boolean(),
      }),
    ),

    // Additional info
    phone: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),

    // Status
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    isActive: v.boolean(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"])
    .index("by_email", ["email"])
    .index("by_active", ["isActive"])
    .index("by_role", ["role"]),

  /**
   * Students table
   */
  students: defineTable({
    // Personal information
    firstName: v.string(),
    lastName: v.string(),
    fullName: v.string(),

    // Academic info
    grade: v.string(), // "1st", "2nd", "3rd", etc.
    // Campus assignment - References to campusSettings documents
    // Optional during migration - new students will have this, old students use campusLocation
    campuses: v.array(v.id("campusSettings")),
    // Legacy field - kept for migration, will be removed after migration
    campusLocation: v.optional(v.string()),

    // Birthday
    birthday: v.string(), // Display format: "July 09"

    // Car assignment
    carNumber: v.number(), // 0 = no car assigned

    // Additional info
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")), // Convex file storage

    // Status
    isActive: v.boolean(),

    // Metadata
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_car_number", ["carNumber"])
    .index("by_full_name", ["fullName"])
    .index("by_active", ["isActive"]),

  /**
   * Dismissal Queue - Current cars in lanes
   */
  dismissalQueue: defineTable({
    // Core info
    carNumber: v.number(),
    campusLocation: v.string(),

    // Lane assignment
    lane: v.union(v.literal("left"), v.literal("right")),
    position: v.number(), // 1 = front of lane

    // Denormalized student info for performance
    students: v.array(
      v.object({
        studentId: v.id("students"),
        name: v.string(),
        grade: v.string(),
        birthday: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        avatarStorageId: v.optional(v.id("_storage")),
      }),
    ),

    // Visual
    carColor: v.string(), // Hex color

    // Time tracking
    assignedTime: v.number(),

    // Who added it
    addedBy: v.id("users"),

    // Status
    status: v.union(v.literal("waiting"), v.literal("completed")),
  })
    .index("by_campus_lane_position", ["campusLocation", "lane", "position"])
    .index("by_campus_status", ["campusLocation", "status"])
    .index("by_car_campus", ["carNumber", "campusLocation"]),

  /**
   * Dismissal History - Completed pickups
   */
  dismissalHistory: defineTable({
    // Reference info
    carNumber: v.number(),
    campusLocation: v.string(),
    lane: v.union(v.literal("left"), v.literal("right")),

    // Students picked up (denormalized)
    studentIds: v.array(v.id("students")),
    studentNames: v.array(v.string()),

    // Time metrics
    queuedAt: v.number(),
    completedAt: v.number(),
    waitTimeSeconds: v.number(),

    // Who managed it
    addedBy: v.id("users"),
    removedBy: v.id("users"),

    // Date for daily reports (YYYY-MM-DD format)
    date: v.string(),
  })
    .index("by_campus_date", ["campusLocation", "date"])
    .index("by_car_date", ["carNumber", "date"])
    .index("by_campus_completed", ["campusLocation", "completedAt"]),

  /**
   * Campus Settings - Basic campus configuration
   */
  campusSettings: defineTable({
    campusName: v.string(), // Unique identifier and display name
    description: v.optional(v.string()),
    code: v.optional(v.string()), // Short code for campus

    // Campus logo/image
    logoStorageId: v.optional(v.id("_storage")),

    // Director information
    directorId: v.optional(v.id("users")),
    directorName: v.optional(v.string()),
    directorEmail: v.optional(v.string()),
    directorPhone: v.optional(v.string()),

    // Contact information
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
    ),

    // Timezone for this campus
    timezone: v.string(), // "America/New_York"

    // Operational settings
    dismissalStartTime: v.optional(v.string()), // "14:30"
    dismissalEndTime: v.optional(v.string()), // "15:30"

    // Available grades for this campus
    availableGrades: v.optional(
      v.array(
        v.object({
          name: v.string(), // "1st", "2nd", "3rd", etc.
          code: v.string(), // "1", "2", "3", etc.
          order: v.number(), // For sorting
          isActive: v.boolean(),
        }),
      ),
    ),

    // Features flags
    allowMultipleStudentsPerCar: v.boolean(),
    requireCarNumber: v.boolean(),

    // Metrics (denormalized for performance)
    metrics: v.optional(
      v.object({
        totalStudents: v.number(),
        totalStaff: v.number(),
        activeStudents: v.number(),
        activeStaff: v.number(),
        lastUpdated: v.number(),
      }),
    ),

    // Status
    isActive: v.boolean(),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("maintenance"),
    ),

    // Timestamps
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_name", ["campusName"])
    .index("by_active", ["isActive"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  /**
   * Audit Log - Track critical actions
   */
  auditLogs: defineTable({
    // Who
    userId: v.id("users"),
    username: v.string(), // Denormalized
    userRole: v.string(), // Denormalized

    // What
    action: v.union(
      v.literal("student_created"),
      v.literal("student_updated"),
      v.literal("student_deleted"),
      v.literal("car_assigned"),
      v.literal("car_removed"),
      v.literal("car_added_to_queue"),
      v.literal("car_removed_from_queue"),
      v.literal("car_moved_lane"),
      v.literal("user_campus_updated"),
      v.literal("user_permissions_updated"),
      v.literal("user_status_updated"),
      v.literal("login"),
      v.literal("logout"),
    ),

    // Target
    targetType: v.optional(
      v.union(v.literal("student"), v.literal("queue"), v.literal("user")),
    ),
    targetId: v.optional(v.string()),

    // Where
    campusLocation: v.optional(v.string()),

    // Details
    details: v.optional(v.any()),

    // When
    timestamp: v.number(),
  })
    .index("by_user_time", ["userId", "timestamp"])
    .index("by_action_time", ["action", "timestamp"])
    .index("by_campus_time", ["campusLocation", "timestamp"]),
});
