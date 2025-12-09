// convex/campus.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getActiveCampuses,
    getCampusSettings,
    getCampusGrades
} from "./helpers";

/**
 * Generate upload URL for campus logo
 */
export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

/**
 * Get URL for a stored campus logo
 */
export const getLogoUrl = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/**
 * Get all campuses
 */
export const getAll = query({
    args: {
        isActive: v.optional(v.boolean()),
        status: v.optional(
            v.union(
                v.literal("active"),
                v.literal("inactive"),
                v.literal("maintenance"),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        // Filter by status if provided
        if (args.status !== undefined) {
            return await ctx.db
                .query("campusSettings")
                .withIndex("by_status", (q) => q.eq("status", args.status!))
                .collect();
        }

        // Filter by isActive if provided
        if (args.isActive !== undefined) {
            return await ctx.db
                .query("campusSettings")
                .withIndex("by_active", (q) => q.eq("isActive", args.isActive!))
                .collect();
        }

        // Return all campuses
        return await ctx.db.query("campusSettings").collect();
    },
});

/**
 * List all active campuses
 */
export const listActive = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        return await getActiveCampuses(ctx.db);
    }
});

/**
 * Get campus settings by name
 */
export const get = query({
    args: { campusName: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return null when not authenticated (graceful degradation)
            return null;
        }

        return await getCampusSettings(ctx.db, args.campusName);
    }
});

/**
 * Get campus by ID
 */
export const getById = query({
    args: { campusId: v.id("campusSettings") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return null when not authenticated (graceful degradation)
            return null;
        }

        return await ctx.db.get(args.campusId);
    }
});

/**
 * Get available grades for a campus
 */
export const getAvailableGrades = query({
    args: { campusId: v.id("campusSettings") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        return await getCampusGrades(ctx.db, args.campusId);
    }
});

/**
 * Create new campus
 */
export const create = mutation({
    args: {
        campusName: v.string(),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        logoStorageId: v.optional(v.id("_storage")),
        directorId: v.optional(v.id("users")),
        directorName: v.optional(v.string()),
        directorEmail: v.optional(v.string()),
        directorPhone: v.optional(v.string()),
        address: v.optional(
            v.object({
                street: v.optional(v.string()),
                city: v.optional(v.string()),
                state: v.optional(v.string()),
                zipCode: v.optional(v.string()),
                country: v.optional(v.string()),
            }),
        ),
        availableGrades: v.optional(
            v.array(
                v.object({
                    name: v.string(),
                    code: v.string(),
                    order: v.number(),
                    isActive: v.boolean(),
                }),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get user from database
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) throw new Error("User not found");
        const userId = user._id;

        // Validate required fields
        if (!args.campusName.trim()) {
            throw new Error("Campus name is required");
        }

        // Check if campus already exists
        const existing = await getCampusSettings(
            ctx.db,
            args.campusName.trim(),
        );
        if (existing) {
            throw new Error("Campus already exists");
        }

        // Create campus
        const campusId = await ctx.db.insert("campusSettings", {
            campusName: args.campusName.trim(),
            description: args.description,
            code: args.code,
            timezone: "America/New_York", // Default timezone
            dismissalStartTime: undefined,
            dismissalEndTime: undefined,
            logoStorageId: args.logoStorageId,
            directorId: args.directorId,
            directorName: args.directorName,
            directorEmail: args.directorEmail,
            directorPhone: args.directorPhone,
            address: args.address,
            availableGrades: args.availableGrades,
            allowMultipleStudentsPerCar: true, // Always true
            requireCarNumber: true, // Always true
            isActive: true,
            status: "active",
            createdAt: Date.now(),
            createdBy: userId,
            metrics: {
                totalStudents: 0,
                totalStaff: 0,
                activeStudents: 0,
                activeStaff: 0,
                lastUpdated: Date.now(),
            },
        });

        return campusId;
    },
});

/**
 * Update campus settings (superadmin only)
 */
export const update = mutation({
    args: {
        campusId: v.id("campusSettings"),
        updates: v.object({
            campusName: v.optional(v.string()),
            description: v.optional(v.string()),
            code: v.optional(v.string()),
            logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
            directorId: v.optional(v.union(v.id("users"), v.null())),
            directorName: v.optional(v.string()),
            directorEmail: v.optional(v.string()),
            directorPhone: v.optional(v.string()),
            address: v.optional(
                v.object({
                    street: v.optional(v.string()),
                    city: v.optional(v.string()),
                    state: v.optional(v.string()),
                    zipCode: v.optional(v.string()),
                    country: v.optional(v.string()),
                }),
            ),
            availableGrades: v.optional(
                v.array(
                    v.object({
                        name: v.string(),
                        code: v.string(),
                        order: v.number(),
                        isActive: v.boolean(),
                    }),
                ),
            ),
            status: v.optional(
                v.union(
                    v.literal("active"),
                    v.literal("inactive"),
                    v.literal("maintenance"),
                ),
            ),
        }),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get user from database
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) throw new Error("User not found");
        const userId = user._id;

        const campus = await ctx.db.get(args.campusId);
        if (!campus) {
            throw new Error("Campus not found");
        }

        const updates: any = { ...args.updates };

        // Trim string fields
        if (updates.campusName !== undefined) {
            updates.campusName = updates.campusName.trim();
        }

        // Convert null to undefined for optional fields
        if (updates.logoStorageId === null) {
            updates.logoStorageId = undefined;
        }
        if (updates.directorId === null) {
            updates.directorId = undefined;
        }

        // Handle empty arrays - convert to undefined to clear the field
        if (
            updates.availableGrades !== undefined &&
            updates.availableGrades.length === 0
        ) {
            updates.availableGrades = undefined;
        }

        await ctx.db.patch(args.campusId, {
            ...updates,
            updatedAt: Date.now(),
            updatedBy: userId,
        });

        return args.campusId;
    },
});

/**
 * Delete campus (superadmin only)
 * Also deletes associated logo from storage if it exists
 */
export const deleteCampus = mutation({
    args: { campusId: v.id("campusSettings") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get the campus to verify it exists and check for logo
        const campus = await ctx.db.get(args.campusId);

        if (!campus) {
            throw new Error("Campus not found");
        }

        // Delete logo from storage if exists
        if (campus.logoStorageId) {
            await ctx.storage.delete(campus.logoStorageId);
        }

        // Delete the campus
        await ctx.db.delete(args.campusId);
    },
});

/**
 * Save campus logo
 */
export const saveCampusLogo = mutation({
    args: {
        campusId: v.id("campusSettings"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get user from database
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) throw new Error("User not found");
        const userId = user._id;

        await ctx.db.patch(args.campusId, {
            logoStorageId: args.storageId,
            updatedAt: Date.now(),
            updatedBy: userId,
        });
    },
});

/**
 * Delete campus logo
 */
export const deleteCampusLogo = mutation({
    args: {
        campusId: v.id("campusSettings"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get user from database
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();

        if (!user) throw new Error("User not found");
        const userId = user._id;

        const campus = await ctx.db.get(args.campusId);

        if (!campus) {
            throw new Error("Campus not found");
        }

        if (campus.logoStorageId) {
            await ctx.storage.delete(campus.logoStorageId);
        }

        await ctx.db.patch(args.campusId, {
            logoStorageId: undefined,
            updatedAt: Date.now(),
            updatedBy: userId,
        });
    },
});

/**
 * Get campus statistics
 */
export const getStats = query({
    args: { campusId: v.id("campusSettings") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return null when not authenticated (graceful degradation)
            return null;
        }

        // Get campus to find name for queue queries
        const campus = await ctx.db.get(args.campusId);
        if (!campus) return null;

        // Get active students count (filter by campuses array)
        const allActiveStudents = await ctx.db
            .query("students")
            .withIndex("by_active", q => q.eq("isActive", true))
            .collect();

        const activeStudents = allActiveStudents.filter(s => s.campuses.includes(args.campusId));

        // Get current queue count (uses campusName as string)
        const currentQueue = await ctx.db
            .query("dismissalQueue")
            .withIndex("by_campus_status", q =>
                q.eq("campusLocation", campus.campusName).eq("status", "waiting")
            )
            .collect();

        // Get today's completed pickups (uses campusName as string)
        const today = new Date().toISOString().split('T')[0];
        const todayPickups = await ctx.db
            .query("dismissalHistory")
            .withIndex("by_campus_date", q =>
                q.eq("campusLocation", campus.campusName).eq("date", today)
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
            campus: campus.campusName,
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
 * Returns both ID and name for proper mapping between UI and database
 */
export const getOptions = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        const campuses = await getActiveCampuses(ctx.db);

        return campuses.map(campus => ({
            id: campus._id, // Campus ID for database operations
            value: campus.campusName, // For backward compatibility
            label: campus.campusName,
            isActive: campus.isActive
        }));
    }
});

/**
 * Get students by campus (for metrics)
 */
export const getStudentsByCampus = query({
    args: {
        campusId: v.id("campusSettings"),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        const isActiveFilter = args.isActive ?? true;
        const allStudents = await ctx.db
            .query("students")
            .withIndex("by_active", (q) => q.eq("isActive", isActiveFilter))
            .collect();

        // Filter by campus
        const students = allStudents.filter(s => s.campuses.includes(args.campusId));

        return students;
    },
});

/**
 * Get staff by campus (for metrics)
 */
export const getStaffByCampus = query({
    args: {
        campusId: v.id("campusSettings"),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        // Get all users assigned to this campus (by ID)
        const allUsers = await ctx.db.query("users").collect();

        const campusUsers = allUsers.filter((user) =>
            user.assignedCampuses.includes(args.campusId),
        );

        if (args.isActive !== undefined) {
            return campusUsers.filter(
                (user) => user.isActive === args.isActive,
            );
        }

        return campusUsers;
    },
});

/**
 * Get all superadmin users (for director selection)
 */
export const getSuperadmins = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated (graceful degradation)
            return [];
        }

        const superadmins = await ctx.db
            .query("users")
            .withIndex("by_role", (q) => q.eq("role", "superadmin"))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        return superadmins.map((user) => ({
            id: user._id,
            name: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Unknown",
            email: user.email,
            phone: user.phone,
        }));
    },
});
