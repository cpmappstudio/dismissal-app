import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireRole } from "./helpers";
import { AppError, ErrorCodes } from "./types";

/**
 * Get all periods
 */
export const getPeriods = query({
    args: {
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const periods = await ctx.db
            .query("periods")
            .collect();

        // Sort by year and sequence
        return periods
            .filter(p => args.includeInactive || p.status !== "closed")
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.sequence - a.sequence;
            });
    },
});

/**
 * Get current period
 */
export const getCurrentPeriod = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("periods")
            .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
            .first();
    },
});

/**
 * Create new period (Admin only)
 */
export const createPeriod = mutation({
    args: {
        code: v.string(),              // "2025-1"
        name: v.string(),              // "FEBRERO/2025 - JUNIO/2025"
        type: v.union(
            v.literal("regular"),
            v.literal("intensive"),
            v.literal("special")
        ),
        year: v.number(),
        sequence: v.number(),
        startDate: v.number(),
        endDate: v.number(),
        enrollmentStart: v.number(),
        enrollmentEnd: v.number(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Check if code already exists
        const existing = await ctx.db
            .query("periods")
            .filter(q => q.eq(q.field("code"), args.code))
            .first();

        if (existing) {
            throw new AppError(
                `Period ${args.code} already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        // Validate dates
        if (args.startDate >= args.endDate) {
            throw new AppError(
                "Start date must be before end date",
                ErrorCodes.INVALID_INPUT
            );
        }

        if (args.enrollmentStart >= args.enrollmentEnd) {
            throw new AppError(
                "Enrollment start must be before enrollment end",
                ErrorCodes.INVALID_INPUT
            );
        }

        const periodId = await ctx.db.insert("periods", {
            code: args.code,
            name: args.name,
            type: args.type,
            year: args.year,
            sequence: args.sequence,
            startDate: args.startDate,
            endDate: args.endDate,
            enrollmentStart: args.enrollmentStart,
            enrollmentEnd: args.enrollmentEnd,
            gradingStart: args.endDate,  // Grading starts when period ends
            gradingDeadline: args.endDate + (7 * 24 * 60 * 60 * 1000), // 7 days after
            status: "planning" as const,
            isCurrentPeriod: false,
        });

        return {
            periodId,
            success: true,
            message: `Period ${args.name} created successfully`,
        };
    },
});

/**
 * Update period status (Admin only)
 */
export const updatePeriodStatus = mutation({
    args: {
        periodId: v.id("periods"),
        status: v.union(
            v.literal("planning"),
            v.literal("enrollment"),
            v.literal("active"),
            v.literal("grading"),
            v.literal("closed")
        ),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const period = await ctx.db.get(args.periodId);
        if (!period) {
            throw new AppError("Period not found", ErrorCodes.PERIOD_NOT_FOUND);
        }

        // If setting as active, unset other active periods
        if (args.status === "active") {
            const currentActive = await ctx.db
                .query("periods")
                .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
                .first();

            if (currentActive) {
                await ctx.db.patch(currentActive._id, {
                    isCurrentPeriod: false,
                });
            }

            await ctx.db.patch(args.periodId, {
                status: args.status,
                isCurrentPeriod: true,
            });
        } else {
            await ctx.db.patch(args.periodId, {
                status: args.status,
                isCurrentPeriod: false,
            });
        }

        return {
            success: true,
            message: `Period status updated to ${args.status}`,
        };
    },
});

/**
 * Set current period (Admin only)
 */
export const setCurrentPeriod = mutation({
    args: {
        periodId: v.id("periods"),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Unset all current periods
        const currentPeriods = await ctx.db
            .query("periods")
            .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
            .collect();

        for (const period of currentPeriods) {
            await ctx.db.patch(period._id, {
                isCurrentPeriod: false,
            });
        }

        // Set new current period
        await ctx.db.patch(args.periodId, {
            isCurrentPeriod: true,
            status: "active" as const,
        });

        const period = await ctx.db.get(args.periodId);

        return {
            success: true,
            message: `${period?.name} set as current period`,
        };
    },
});