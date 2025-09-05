// convex/queue.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    validateUserAccess,
    getStudentsByCarNumber,
    isCarInQueue,
    getNextPosition,
    generateCarColor,
    studentToSummary,
    repositionLaneCars,
    createAuditLogFromContext,
    userCanAllocate,
    userCanDispatch
} from "./helpers";
import { laneValidator } from "./types";

/**
 * Get current queue state for a campus (reactive)
 */
export const getCurrentQueue = query({
    args: {
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const entries = await ctx.db
            .query("dismissalQueue")
            .withIndex("by_campus_status", q =>
                q.eq("campusLocation", args.campus).eq("status", "waiting")
            )
            .collect();

        const leftLane = entries
            .filter(e => e.lane === "left")
            .sort((a, b) => a.position - b.position);

        const rightLane = entries
            .filter(e => e.lane === "right")
            .sort((a, b) => a.position - b.position);

        return {
            campus: args.campus,
            leftLane,
            rightLane,
            totalCars: entries.length,
            lastUpdated: Date.now()
        };
    }
});

/**
 * Add car to queue (allocator action)
 */
export const addCar = mutation({
    args: {
        carNumber: v.number(),
        campus: v.string(),
        lane: laneValidator
    },
    handler: async (ctx, args) => {
        // Validate inputs
        if (!args.campus.trim()) {
            throw new Error("Campus is required");
        }
        if (args.carNumber <= 0) {
            throw new Error("Invalid car number");
        }

        // Validate access
        const { user, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin', 'allocator', 'operator'],
            args.campus
        );

        // If operator, check specific permissions
        if (role === 'operator' && !userCanAllocate(role, user.operatorPermissions)) {
            throw new Error("Operator doesn't have allocate permission");
        }

        // Check if car is already in queue
        if (await isCarInQueue(ctx.db, args.carNumber, args.campus)) {
            throw new Error("Car already in queue");
        }

        // Get students for this car
        const students = await getStudentsByCarNumber(ctx.db, args.carNumber, args.campus);
        if (students.length === 0) {
            throw new Error("No students found with this car number");
        }

        // Get next position in lane
        const position = await getNextPosition(ctx.db, args.campus, args.lane);

        // Add to queue
        const queueId = await ctx.db.insert("dismissalQueue", {
            carNumber: args.carNumber,
            campusLocation: args.campus,
            lane: args.lane,
            position,
            students: students.map(studentToSummary),
            carColor: generateCarColor(args.carNumber),
            assignedTime: Date.now(),
            addedBy: user._id,
            status: "waiting"
        });

        // Create audit log
        await createAuditLogFromContext(ctx, "car_added_to_queue", {
            targetType: "queue",
            targetId: queueId,
            campus: args.campus,
            metadata: {
                carNumber: args.carNumber,
                lane: args.lane,
                studentCount: students.length
            }
        });

        return queueId;
    }
});

/**
 * Remove car from queue (dispatcher action)
 */
export const removeCar = mutation({
    args: {
        queueId: v.id("dismissalQueue")
    },
    handler: async (ctx, args) => {
        const entry = await ctx.db.get(args.queueId);
        if (!entry) throw new Error("Queue entry not found");

        if (entry.status !== "waiting") {
            throw new Error("Car is not in waiting status");
        }

        // Validate access
        const { user, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin', 'dispatcher', 'operator'],
            entry.campusLocation
        );

        // If operator, check specific permissions
        if (role === 'operator' && !userCanDispatch(role, user.operatorPermissions)) {
            throw new Error("Operator doesn't have dispatch permission");
        }

        // Calculate wait time
        const waitTimeSeconds = Math.floor((Date.now() - entry.assignedTime) / 1000);

        // Create history entry
        await ctx.db.insert("dismissalHistory", {
            carNumber: entry.carNumber,
            campusLocation: entry.campusLocation,
            lane: entry.lane,
            studentIds: entry.students.map(s => s.studentId),
            studentNames: entry.students.map(s => s.name),
            queuedAt: entry.assignedTime,
            completedAt: Date.now(),
            waitTimeSeconds,
            addedBy: entry.addedBy,
            removedBy: user._id,
            date: new Date().toISOString().split('T')[0]
        });

        // Reposition remaining cars in lane
        await repositionLaneCars(ctx.db, entry.campusLocation, entry.lane, entry.position);

        // Remove from queue
        await ctx.db.delete(args.queueId);

        // Create audit log
        await createAuditLogFromContext(ctx, "car_removed_from_queue", {
            targetType: "queue",
            targetId: args.queueId,
            campus: entry.campusLocation,
            metadata: {
                carNumber: entry.carNumber,
                waitTime: waitTimeSeconds,
                studentCount: entry.students.length
            }
        });

        return {
            success: true,
            waitTime: waitTimeSeconds,
            carNumber: entry.carNumber
        };
    }
});

/**
 * Check if car is currently in queue
 */
export const checkCarInQueue = query({
    args: {
        carNumber: v.number(),
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const inQueue = await isCarInQueue(ctx.db, args.carNumber, args.campus);

        if (inQueue) {
            const entry = await ctx.db
                .query("dismissalQueue")
                .withIndex("by_car_campus", q =>
                    q.eq("carNumber", args.carNumber).eq("campusLocation", args.campus)
                )
                .filter(q => q.eq(q.field("status"), "waiting"))
                .first();

            return {
                inQueue: true,
                entry: entry ? {
                    id: entry._id,
                    lane: entry.lane,
                    position: entry.position,
                    assignedTime: entry.assignedTime,
                    students: entry.students
                } : null
            };
        }

        return { inQueue: false, entry: null };
    }
});

/**
 * Move car to different lane
 */
export const moveCar = mutation({
    args: {
        queueId: v.id("dismissalQueue"),
        newLane: laneValidator
    },
    handler: async (ctx, args) => {
        const entry = await ctx.db.get(args.queueId);
        if (!entry) throw new Error("Queue entry not found");

        if (entry.status !== "waiting") {
            throw new Error("Car is not in waiting status");
        }

        // Validate access
        const { user, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin', 'allocator', 'operator'],
            entry.campusLocation
        );

        // If operator, check permissions
        if (role === 'operator' && !userCanAllocate(role, user.operatorPermissions)) {
            throw new Error("Operator doesn't have allocate permission");
        }

        if (entry.lane === args.newLane) {
            throw new Error("Car is already in that lane");
        }

        const oldLane = entry.lane;
        const oldPosition = entry.position;

        // Get next position in new lane
        const newPosition = await getNextPosition(ctx.db, entry.campusLocation, args.newLane);

        // Update car's lane and position
        await ctx.db.patch(args.queueId, {
            lane: args.newLane,
            position: newPosition
        });

        // Reposition cars in old lane
        await repositionLaneCars(ctx.db, entry.campusLocation, oldLane, oldPosition);

        // Create audit log with correct action name
        await createAuditLogFromContext(ctx, "car_moved_lane", {
            targetType: "queue",
            targetId: args.queueId,
            campus: entry.campusLocation,
            metadata: {
                carNumber: entry.carNumber,
                oldLane,
                newLane: args.newLane,
                oldPosition,
                newPosition
            }
        });

        return args.queueId;
    }
});

/**
 * Get queue metrics for dashboard
 */
export const getQueueMetrics = query({
    args: {
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Current queue
        const currentQueue = await ctx.db
            .query("dismissalQueue")
            .withIndex("by_campus_status", q =>
                q.eq("campusLocation", args.campus).eq("status", "waiting")
            )
            .collect();

        const leftLaneCars = currentQueue.filter(e => e.lane === "left").length;
        const rightLaneCars = currentQueue.filter(e => e.lane === "right").length;

        // Today's completed pickups
        const today = new Date().toISOString().split('T')[0];
        const todayHistory = await ctx.db
            .query("dismissalHistory")
            .withIndex("by_campus_date", q =>
                q.eq("campusLocation", args.campus).eq("date", today)
            )
            .collect();

        const averageWaitTime = todayHistory.length > 0
            ? todayHistory.reduce((sum, h) => sum + h.waitTimeSeconds, 0) / todayHistory.length
            : 0;

        return {
            campus: args.campus,
            currentCars: currentQueue.length,
            leftLaneCars,
            rightLaneCars,
            averageWaitTime: Math.round(averageWaitTime),
            todayTotal: todayHistory.length,
            todayStudents: todayHistory.reduce((sum, h) => sum + h.studentIds.length, 0)
        };
    }
});

/**
 * Get recent queue activity for a campus
 */
export const getRecentActivity = query({
    args: {
        campus: v.string(),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const limit = args.limit || 10;

        // Get recent completed pickups
        const recentHistory = await ctx.db
            .query("dismissalHistory")
            .withIndex("by_campus_completed", q => q.eq("campusLocation", args.campus))
            .order("desc")
            .take(limit);

        return recentHistory.map(h => ({
            id: h._id,
            carNumber: h.carNumber,
            studentNames: h.studentNames,
            completedAt: h.completedAt,
            waitTimeSeconds: h.waitTimeSeconds,
            lane: h.lane
        }));
    }
});
