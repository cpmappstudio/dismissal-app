// convex/campus.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    validateUserAccess,
    getActiveCampuses,
    getCampusSettings,
    getCampusGrades
} from "./helpers";

/**
 * List all active campuses
 */
export const listActive = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';
        const campuses = await getActiveCampuses(ctx.db);

        // If not admin/superadmin, filter by assigned campuses
        if (!['admin', 'superadmin'].includes(role)) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
                .first();

            if (!user) throw new Error("User not found");

            return campuses.filter(campus =>
                user.assignedCampuses.includes(campus.campusName)
            );
        }

        return campuses;
    }
});

/**
 * Get campus settings by name
 */
export const get = query({
    args: { campusName: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const settings = await getCampusSettings(ctx.db, args.campusName);
        if (!settings) return null;

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';

        // Check access
        if (!['admin', 'superadmin'].includes(role)) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
                .first();

            if (!user || !user.assignedCampuses.includes(args.campusName)) {
                throw new Error("No access to this campus");
            }
        }

        return settings;
    }
});

/**
 * Get available grades for a campus
 */
export const getAvailableGrades = query({
    args: { campus: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';

        // Check access
        if (!['admin', 'superadmin'].includes(role)) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
                .first();

            if (!user || !user.assignedCampuses.includes(args.campus)) {
                throw new Error("No access to this campus");
            }
        }

        return await getCampusGrades(ctx.db, args.campus);
    }
});

/**
 * Create new campus (superadmin only)
 */
export const create = mutation({
    args: {
        campusName: v.string(),
        displayName: v.string(),
        timezone: v.string(),
        dismissalStartTime: v.optional(v.string()),
        dismissalEndTime: v.optional(v.string()),
        allowMultipleStudentsPerCar: v.optional(v.boolean()),
        requireCarNumber: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        const { user, role } = await validateUserAccess(
            ctx,
            ['superadmin']
        );

        // Validate required fields
        if (!args.campusName.trim()) {
            throw new Error("Campus name is required");
        }
        if (!args.displayName.trim()) {
            throw new Error("Display name is required");
        }
        if (!args.timezone.trim()) {
            throw new Error("Timezone is required");
        }

        // Check if campus already exists
        const existing = await getCampusSettings(ctx.db, args.campusName.trim());
        if (existing) {
            throw new Error("Campus already exists");
        }

        // Validate timezone
        try {
            Intl.DateTimeFormat(undefined, { timeZone: args.timezone });
        } catch {
            throw new Error("Invalid timezone");
        }

        // Create campus
        const campusId = await ctx.db.insert("campusSettings", {
            campusName: args.campusName.trim(),
            displayName: args.displayName.trim(),
            timezone: args.timezone,
            dismissalStartTime: args.dismissalStartTime,
            dismissalEndTime: args.dismissalEndTime,
            allowMultipleStudentsPerCar: args.allowMultipleStudentsPerCar ?? true,
            requireCarNumber: args.requireCarNumber ?? true,
            isActive: true,
            createdAt: Date.now()
        });

        return campusId;
    }
});

/**
 * Update campus settings (superadmin only)
 */
export const update = mutation({
    args: {
        campusName: v.string(),
        displayName: v.optional(v.string()),
        timezone: v.optional(v.string()),
        dismissalStartTime: v.optional(v.string()),
        dismissalEndTime: v.optional(v.string()),
        allowMultipleStudentsPerCar: v.optional(v.boolean()),
        requireCarNumber: v.optional(v.boolean()),
        isActive: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        const { user, role } = await validateUserAccess(
            ctx,
            ['superadmin']
        );

        const campus = await getCampusSettings(ctx.db, args.campusName);
        if (!campus) {
            throw new Error("Campus not found");
        }

        // Build updates - remove updatedAt as it doesn't exist in schema
        const updates: any = {};

        if (args.displayName !== undefined) updates.displayName = args.displayName.trim();
        if (args.timezone !== undefined) {
            // Validate timezone
            try {
                Intl.DateTimeFormat(undefined, { timeZone: args.timezone });
                updates.timezone = args.timezone;
            } catch {
                throw new Error("Invalid timezone");
            }
        }
        if (args.dismissalStartTime !== undefined) updates.dismissalStartTime = args.dismissalStartTime;
        if (args.dismissalEndTime !== undefined) updates.dismissalEndTime = args.dismissalEndTime;
        if (args.allowMultipleStudentsPerCar !== undefined) updates.allowMultipleStudentsPerCar = args.allowMultipleStudentsPerCar;
        if (args.requireCarNumber !== undefined) updates.requireCarNumber = args.requireCarNumber;
        if (args.isActive !== undefined) updates.isActive = args.isActive;

        await ctx.db.patch(campus._id, updates);

        return campus._id;
    }
});

/**
 * Get campus statistics
 */
export const getStats = query({
    args: { campus: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';

        // Check access
        if (!['admin', 'superadmin'].includes(role)) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
                .first();

            if (!user || !user.assignedCampuses.includes(args.campus)) {
                throw new Error("No access to this campus");
            }
        }

        // Get active students count
        const activeStudents = await ctx.db
            .query("students")
            .withIndex("by_campus_active", q =>
                q.eq("campusLocation", args.campus).eq("isActive", true)
            )
            .collect();

        // Get current queue count
        const currentQueue = await ctx.db
            .query("dismissalQueue")
            .withIndex("by_campus_status", q =>
                q.eq("campusLocation", args.campus).eq("status", "waiting")
            )
            .collect();

        // Get today's completed pickups
        const today = new Date().toISOString().split('T')[0];
        const todayPickups = await ctx.db
            .query("dismissalHistory")
            .withIndex("by_campus_date", q =>
                q.eq("campusLocation", args.campus).eq("date", today)
            )
            .collect();

        // Students with assigned cars
        const studentsWithCars = activeStudents.filter(s => s.carNumber > 0);

        // Unique car numbers
        const uniqueCarNumbers = new Set(studentsWithCars.map(s => s.carNumber));

        // Grade distribution
        const gradeDistribution = activeStudents.reduce((acc, student) => {
            acc[student.grade] = (acc[student.grade] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            campus: args.campus,
            totalStudents: activeStudents.length,
            studentsWithCars: studentsWithCars.length,
            uniqueCarCount: uniqueCarNumbers.size,
            currentQueueSize: currentQueue.length,
            todayPickups: todayPickups.length,
            todayStudentsPickedUp: todayPickups.reduce((sum, p) => sum + p.studentIds.length, 0),
            gradeDistribution,
            averageStudentsPerCar: uniqueCarNumbers.size > 0 ?
                Math.round((studentsWithCars.length / uniqueCarNumbers.size) * 10) / 10 : 0
        };
    }
});

/**
 * Get campus options for dropdowns
 */
export const getOptions = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';
        const campuses = await getActiveCampuses(ctx.db);

        // Filter by user access
        let accessibleCampuses = campuses;
        if (!['admin', 'superadmin'].includes(role)) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
                .first();

            if (user) {
                accessibleCampuses = campuses.filter(campus =>
                    user.assignedCampuses.includes(campus.campusName)
                );
            }
        }

        return accessibleCampuses.map(campus => ({
            value: campus.campusName,
            label: campus.displayName,
            isActive: campus.isActive
        }));
    }
});
