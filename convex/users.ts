// convex/users.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    validateUserAccess,
    getUserByClerkId,
    createAuditLogFromContext
} from "./helpers";
import { operatorPermissionsValidator } from "./types";

/**
 * List users in the system (admin/superadmin only)
 */
export const list = query({
    args: {
        campus: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        limit: v.optional(v.number()),
        offset: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const { user, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin']
        );

        let users: any[];

        // Apply filters
        if (args.isActive !== undefined) {
            users = await ctx.db
                .query("users")
                .withIndex("by_active", q => q.eq("isActive", args.isActive!))
                .collect();
        } else {
            users = await ctx.db
                .query("users")
                .collect();
        }

        // Filter by campus if specified and user is not superadmin
        if (args.campus && role !== 'superadmin') {
            users = users.filter(u => u.assignedCampuses.includes(args.campus!));
        } else if (args.campus) {
            users = users.filter(u => u.assignedCampuses.includes(args.campus!));
        }

        // If admin (not superadmin), only show users from their assigned campuses
        if (role === 'admin') {
            users = users.filter(u =>
                u.assignedCampuses.some((campus: string) => user.assignedCampuses.includes(campus))
            );
        }

        // Sort by email
        users.sort((a, b) => a.email.localeCompare(b.email));

        // Pagination
        const offset = args.offset || 0;
        const limit = args.limit || 50;
        const paginatedUsers = users.slice(offset, offset + limit);

        return {
            users: paginatedUsers.map(u => ({
                _id: u._id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                imageUrl: u.imageUrl,
                assignedCampuses: u.assignedCampuses,
                operatorPermissions: u.operatorPermissions,
                isActive: u.isActive,
                createdAt: u.createdAt,
                lastLoginAt: u.lastLoginAt
            })),
            total: users.length,
            hasMore: offset + limit < users.length
        };
    }
});

/**
 * Get user by ID (admin/superadmin only)
 */
export const get = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const { user: currentUser, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin']
        );

        const user = await ctx.db.get(args.userId);
        if (!user) return null;

        // If admin (not superadmin), check if they have access to this user
        if (role === 'admin') {
            const hasCommonCampus = user.assignedCampuses.some((campus: string) =>
                currentUser.assignedCampuses.includes(campus)
            );
            if (!hasCommonCampus) {
                throw new Error("No access to this user");
            }
        }

        return {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            assignedCampuses: user.assignedCampuses,
            operatorPermissions: user.operatorPermissions,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        };
    }
});

/**
 * Update campus access for a user (admin/superadmin only)
 */
export const updateCampusAccess = mutation({
    args: {
        userId: v.id("users"),
        assignedCampuses: v.array(v.string())
    },
    handler: async (ctx, args) => {
        const { user: currentUser, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin']
        );

        const targetUser = await ctx.db.get(args.userId);
        if (!targetUser) {
            throw new Error("User not found");
        }

        // If admin (not superadmin), validate they can only assign campuses they have access to
        if (role === 'admin') {
            const invalidCampuses = args.assignedCampuses.filter((campus: string) =>
                !currentUser.assignedCampuses.includes(campus)
            );
            if (invalidCampuses.length > 0) {
                throw new Error(`No access to assign campuses: ${invalidCampuses.join(', ')}`);
            }
        }

        const oldCampuses = targetUser.assignedCampuses;

        // Update campus assignments
        await ctx.db.patch(args.userId, {
            assignedCampuses: args.assignedCampuses
        });

        // Create audit log
        await createAuditLogFromContext(ctx, "user_campus_updated", {
            targetType: "user",
            targetId: args.userId,
            metadata: {
                targetEmail: targetUser.email,
                oldCampuses,
                newCampuses: args.assignedCampuses
            }
        });

        return args.userId;
    }
});

/**
 * Update operator permissions (admin/superadmin only)
 */
export const updateOperatorPermissions = mutation({
    args: {
        userId: v.id("users"),
        permissions: v.optional(operatorPermissionsValidator)
    },
    handler: async (ctx, args) => {
        const { user: currentUser, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin']
        );

        const targetUser = await ctx.db.get(args.userId);
        if (!targetUser) {
            throw new Error("User not found");
        }

        // If admin (not superadmin), check if they have access to this user
        if (role === 'admin') {
            const hasCommonCampus = targetUser.assignedCampuses.some((campus: string) =>
                currentUser.assignedCampuses.includes(campus)
            );
            if (!hasCommonCampus) {
                throw new Error("No access to this user");
            }
        }

        const oldPermissions = targetUser.operatorPermissions;

        // Update operator permissions
        await ctx.db.patch(args.userId, {
            operatorPermissions: args.permissions
        });

        // Create audit log
        await createAuditLogFromContext(ctx, "user_permissions_updated", {
            targetType: "user",
            targetId: args.userId,
            metadata: {
                targetEmail: targetUser.email,
                oldPermissions,
                newPermissions: args.permissions
            }
        });

        return args.userId;
    }
});

/**
 * Activate/deactivate user (superadmin only)
 */
export const updateActiveStatus = mutation({
    args: {
        userId: v.id("users"),
        isActive: v.boolean()
    },
    handler: async (ctx, args) => {
        const { user: currentUser, role } = await validateUserAccess(
            ctx,
            ['superadmin']
        );

        const targetUser = await ctx.db.get(args.userId);
        if (!targetUser) {
            throw new Error("User not found");
        }

        // Don't allow deactivating yourself
        if (args.userId === currentUser._id && !args.isActive) {
            throw new Error("Cannot deactivate yourself");
        }

        const oldStatus = targetUser.isActive;

        // Update active status
        await ctx.db.patch(args.userId, {
            isActive: args.isActive
        });

        // Create audit log
        await createAuditLogFromContext(ctx, "user_status_updated", {
            targetType: "user",
            targetId: args.userId,
            metadata: {
                targetEmail: targetUser.email,
                oldStatus,
                newStatus: args.isActive
            }
        });

        return args.userId;
    }
});

/**
 * Get user profile for current authenticated user
 */
export const getCurrentProfile = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) return null;

        const role = (identity.publicMetadata as any)?.dismissalRole || 'viewer';

        return {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            assignedCampuses: user.assignedCampuses,
            operatorPermissions: user.operatorPermissions,
            isActive: user.isActive,
            role,
            lastLoginAt: user.lastLoginAt
        };
    }
});

/**
 * Search users by email or name
 */
export const search = query({
    args: {
        query: v.string(),
        campus: v.optional(v.string()),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const { user: currentUser, role } = await validateUserAccess(
            ctx,
            ['admin', 'superadmin']
        );

        const searchQuery = args.query.toLowerCase();
        const limit = args.limit || 20;

        let users = await ctx.db
            .query("users")
            .withIndex("by_active", q => q.eq("isActive", true))
            .collect();

        // Filter by search term
        users = users.filter(user =>
            user.email.toLowerCase().includes(searchQuery) ||
            (user.firstName && user.firstName.toLowerCase().includes(searchQuery)) ||
            (user.lastName && user.lastName.toLowerCase().includes(searchQuery))
        );

        // Filter by campus if specified
        if (args.campus) {
            users = users.filter(user => user.assignedCampuses.includes(args.campus!));
        }

        // If admin (not superadmin), only show users from their assigned campuses
        if (role === 'admin') {
            users = users.filter(user =>
                user.assignedCampuses.some((campus: string) => currentUser.assignedCampuses.includes(campus))
            );
        }

        // Sort by relevance (exact email match first, then alphabetical)
        users.sort((a, b) => {
            const aEmailMatch = a.email.toLowerCase() === searchQuery;
            const bEmailMatch = b.email.toLowerCase() === searchQuery;

            if (aEmailMatch && !bEmailMatch) return -1;
            if (!aEmailMatch && bEmailMatch) return 1;

            return a.email.localeCompare(b.email);
        });

        return users.slice(0, limit).map(user => ({
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            assignedCampuses: user.assignedCampuses
        }));
    }
});
