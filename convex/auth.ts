// ################################################################################
// # File: auth.ts                                                                # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/23/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * Authentication and user management functions
 * Handles Clerk integration, user creation, profile updates
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getUserByClerkId } from "./helpers";
import { roleValidator, addressValidator } from "./types";

/**
 * Create or update user from Clerk authentication
 * Called automatically when user signs up or signs in
 */
export const createOrUpdateUser = mutation({
    args: {
        clerkId: v.string(),
        email: v.string(),
        firstName: v.string(),
        lastName: v.string(),
        secondLastName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if user already exists
        const existingUser = await getUserByClerkId(ctx.db, args.clerkId);

        if (existingUser) {
            // Update existing user's login time
            await ctx.db.patch(existingUser._id, {
                lastLoginAt: Date.now(),
                updatedAt: Date.now(),
            });
            return existingUser._id;
        }

        // Create new user with basic info
        const userId = await ctx.db.insert("users", {
            clerkId: args.clerkId,
            email: args.email,
            firstName: args.firstName,
            lastName: args.lastName,
            secondLastName: args.secondLastName,

            // Default role - will be updated by admin
            role: "student",
            isActive: false, // Inactive until admin activation

            createdAt: Date.now(),
            lastLoginAt: Date.now(),
        });

        return userId;
    },
});

/**
 * Get current authenticated user with full profile
 */
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) {
            throw new ConvexError("User not found in database");
        }

        // Get additional profile data based on role
        let profileData = null;

        if (user.role === "student" && user.studentProfile) {
            // Get program information
            const program = await ctx.db.get(user.studentProfile.programId);
            profileData = {
                ...user.studentProfile,
                program: program,
            };
        } else if (user.role === "professor" && user.professorProfile) {
            profileData = user.professorProfile;
        }

        return {
            ...user,
            profileData,
        };
    },
});

/**
 * Update user personal information
 * Users can only update their own profile
 */
export const updateUserProfile = mutation({
    args: {
        phone: v.optional(v.string()),
        country: v.optional(v.string()),
        address: v.optional(addressValidator),
        dateOfBirth: v.optional(v.number()),
        nationality: v.optional(v.string()),
        documentType: v.optional(v.union(
            v.literal("passport"),
            v.literal("national_id"),
            v.literal("driver_license"),
            v.literal("other")
        )),
        documentNumber: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) {
            throw new ConvexError("User not found");
        }

        // Update user profile
        await ctx.db.patch(user._id, {
            ...args,
            updatedAt: Date.now(),
        });

        return user._id;
    },
});

/**
 * Update user role and activate account (Admin only)
 */
export const updateUserRole = mutation({
    args: {
        userId: v.id("users"),
        role: roleValidator,
        isActive: v.boolean(),
        studentProfile: v.optional(v.object({
            studentCode: v.string(),
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
            academicStanding: v.optional(v.union(
                v.literal("good_standing"),
                v.literal("probation"),
                v.literal("suspension")
            )),
        })),
        professorProfile: v.optional(v.object({
            employeeCode: v.string(),
            title: v.optional(v.string()),
            department: v.optional(v.string()),
            hireDate: v.optional(v.number()),
        })),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser) {
            throw new ConvexError("User not found");
        }

        // Only admin or superadmin can update roles
        if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
            throw new ConvexError("Only administrators can update user roles");
        }

        // Update user role and profile
        await ctx.db.patch(args.userId, {
            role: args.role,
            isActive: args.isActive,
            studentProfile: args.studentProfile,
            professorProfile: args.professorProfile,
            updatedAt: Date.now(),
        });

        return args.userId;
    },
});

/**
 * Get user by ID (Admin only, or own profile)
 */
export const getUserById = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser) {
            throw new ConvexError("User not found");
        }

        // Check permissions - can view own profile or admin can view any
        if (currentUser._id !== args.userId &&
            currentUser.role !== "admin" &&
            currentUser.role !== "superadmin") {
            throw new ConvexError("Permission denied");
        }

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new ConvexError("User not found");
        }

        return user;
    },
});

/**
 * List users with filters (Admin only)
 */
export const listUsers = query({
    args: {
        role: v.optional(roleValidator),
        isActive: v.optional(v.boolean()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser) {
            throw new ConvexError("User not found");
        }

        // Only admin can list users
        if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
            throw new ConvexError("Only administrators can list users");
        }

        let query;

        // Apply filters
        if (args.role !== undefined && args.isActive !== undefined) {
            query = ctx.db.query("users")
                .withIndex("by_role_active", q => q.eq("role", args.role!).eq("isActive", args.isActive!));
        } else {
            query = ctx.db.query("users");
            if (args.role !== undefined) {
                query = query.filter(q => q.eq(q.field("role"), args.role));
            }
            if (args.isActive !== undefined) {
                query = query.filter(q => q.eq(q.field("isActive"), args.isActive));
            }
        }

        // Apply limit and collect
        const results = await query.collect();
        if (args.limit) {
            return results.slice(0, args.limit);
        }

        return results;
    },
});

/**
 * Deactivate user (Admin only)
 */
export const deactivateUser = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Not authenticated");
        }

        const currentUser = await getUserByClerkId(ctx.db, identity.subject);
        if (!currentUser) {
            throw new ConvexError("User not found");
        }

        // Only admin can deactivate users
        if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
            throw new ConvexError("Only administrators can deactivate users");
        }

        // Cannot deactivate self
        if (currentUser._id === args.userId) {
            throw new ConvexError("Cannot deactivate your own account");
        }

        await ctx.db.patch(args.userId, {
            isActive: false,
            updatedAt: Date.now(),
        });

        return args.userId;
    },
});
