// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Users table - Simplified for username-based auth
   */
  // convex/schema.ts - Actualizado para Clerk

  users: defineTable({
    // Clerk integration - REQUERIDO
    clerkId: v.string(), // Subject ID from Clerk
    email: v.string(),

    // Display info (sync from Clerk)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),

    // NO almacenamos role aquí - viene de Clerk metadata

    // Campus assignment
    assignedCampuses: v.array(v.string()),

    // Para operator, permisos específicos
    operatorPermissions: v.optional(v.object({
      canAllocate: v.boolean(),
      canDispatch: v.boolean(),
      canView: v.boolean(),
    })),

    // System fields
    isActive: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"]) // Principal índice
    .index("by_email", ["email"])
    .index("by_active", ["isActive"]),

  /**
   * Students table
   */
  students: defineTable({
    // Personal information
    firstName: v.string(),
    lastName: v.string(),
    fullName: v.string(), // Denormalized for search/display

    // Academic info
    grade: v.string(), // "1st", "2nd", "3rd", etc.
    campusLocation: v.string(),

    // Birthday
    birthday: v.string(), // Display format: "July 09"

    // Car assignment
    carNumber: v.number(), // 0 = no car assigned

    // Additional info
    avatarUrl: v.optional(v.string()),

    // Status
    isActive: v.boolean(),

    // Metadata
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_campus_active", ["campusLocation", "isActive"])
    .index("by_car_campus", ["carNumber", "campusLocation", "isActive"])
    .index("by_campus_grade", ["campusLocation", "grade", "isActive"])
    .index("by_full_name", ["fullName"]),

  /**
   * Dismissal Queue - Current cars in lanes
   */
  dismissalQueue: defineTable({
    // Core info
    carNumber: v.number(),
    campusLocation: v.string(),

    // Lane assignment
    lane: v.union(
      v.literal("left"),
      v.literal("right")
    ),
    position: v.number(), // 1 = front of lane

    // Denormalized student info for performance
    students: v.array(v.object({
      studentId: v.id("students"),
      name: v.string(),
      grade: v.string(),
      avatarUrl: v.optional(v.string()),
    })),

    // Visual
    carColor: v.string(), // Hex color

    // Time tracking
    assignedTime: v.number(),

    // Who added it
    addedBy: v.id("users"),

    // Status
    status: v.union(
      v.literal("waiting"),
      v.literal("completed")
    ),
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
    campusName: v.string(), // Unique identifier
    displayName: v.string(), // Display name

    // Timezone for this campus
    timezone: v.string(), // "America/New_York"

    // Operational settings
    dismissalStartTime: v.optional(v.string()), // "14:30"
    dismissalEndTime: v.optional(v.string()), // "15:30"

    // Features flags
    allowMultipleStudentsPerCar: v.boolean(),
    requireCarNumber: v.boolean(),

    // Status
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_name", ["campusName"])
    .index("by_active", ["isActive"]),

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
      v.literal("logout")
    ),

    // Target
    targetType: v.optional(v.union(
      v.literal("student"),
      v.literal("queue"),
      v.literal("user")
    )),
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