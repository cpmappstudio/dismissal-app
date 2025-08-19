// ################################################################################
// # File: programs.ts                                                            #
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/18/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Academic program management functions for SIS
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    programTypeValidator,
    ErrorCodes,
    AppError,
} from "./types";
import {
    requireAuth,
    requireRole,
    isProgramCodeTaken,
} from "./helpers";

// ============================================================================
// PROGRAM QUERIES
// ============================================================================

/**
 * Get all active programs
 */
export const getPrograms = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("programs")
            .withIndex("by_active", (q) => q.eq("isActive", true))
            .collect();
    },
});

/**
 * Get program by ID with requirements (40-60-20 credits)
 */
export const getProgramById = query({
    args: {
        programId: v.id("programs")
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.PROGRAM_NOT_FOUND
            );
        }

        // Get program requirements (40-60-20 credits)
        const requirements = await ctx.db
            .query("program_requirements")
            .withIndex("by_program_active", (q) =>
                q.eq("programId", args.programId).eq("isActive", true)
            )
            .first();

        return {
            ...program,
            requirements: requirements || {
                humanitiesCredits: 40,
                coreCredits: 60,
                electiveCredits: 20,
                totalCredits: 120,
                minGPA: 3.0,
            }
        };
    },
});

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/**
 * Create new program (Admin only)
 */
export const createProgram = mutation({
    args: {
        code: v.string(),
        name: v.string(),
        type: programTypeValidator,
        totalCredits: v.number(),
        durationSemesters: v.number(),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        // Validate input
        if (args.totalCredits <= 0) {
            throw new AppError(
                "Total credits must be greater than 0",
                ErrorCodes.INVALID_INPUT
            );
        }

        // Check if code already exists
        if (await isProgramCodeTaken(ctx, args.code)) {
            throw new AppError(
                `Program code '${args.code}' already exists`,
                ErrorCodes.DUPLICATE_ENTRY
            );
        }

        const programId = await ctx.db.insert("programs", {
            code: args.code,
            name: args.name,
            type: args.type,
            totalCredits: args.totalCredits,
            durationSemesters: args.durationSemesters,
            isActive: true,
        });

        return {
            programId,
            message: `Program '${args.name}' created successfully`
        };
    },
});

/**
 * Create program requirements (Admin only)
 * Defines the 40-60-20 credit distribution
 */
export const createProgramRequirements = mutation({
    args: {
        programId: v.id("programs"),
        humanitiesCredits: v.number(),
        coreCredits: v.number(),
        electiveCredits: v.number(),
        minGPA: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireRole(ctx, "admin");

        const program = await ctx.db.get(args.programId);
        if (!program) {
            throw new AppError(
                "Program not found",
                ErrorCodes.PROGRAM_NOT_FOUND
            );
        }

        // Validate credits add up
        const totalCredits = args.humanitiesCredits + args.coreCredits + args.electiveCredits;
        if (totalCredits !== program.totalCredits) {
            throw new AppError(
                `Credits must add up to program total (${program.totalCredits})`,
                ErrorCodes.INVALID_INPUT
            );
        }

        // Deactivate any existing requirements
        const existingRequirements = await ctx.db
            .query("program_requirements")
            .withIndex("by_program_active", (q) =>
                q.eq("programId", args.programId).eq("isActive", true)
            )
            .collect();

        for (const req of existingRequirements) {
            await ctx.db.patch(req._id, { isActive: false });
        }

        // Create new requirements
        const requirementsId = await ctx.db.insert("program_requirements", {
            programId: args.programId,
            humanitiesCredits: args.humanitiesCredits,
            coreCredits: args.coreCredits,
            electiveCredits: args.electiveCredits,
            totalCredits,
            minGPA: args.minGPA || 3.0,
            effectiveDate: Date.now(),
            isActive: true,
        });

        return {
            requirementsId,
            message: `Requirements created: ${args.humanitiesCredits} humanities, ${args.coreCredits} core, ${args.electiveCredits} electives`
        };
    },
});