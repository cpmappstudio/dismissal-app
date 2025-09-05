// convex/auth.ts

import { mutation, query } from "./_generated/server";
import { getUserByClerkId } from "./helpers";
import { extractRoleFromMetadata, extractOperatorPermissions } from "../lib/role-utils";

/**
 * Synchronize user data from Clerk on first login
 * Creates new user if doesn't exist, updates existing user's info
 */
export const syncUser = mutation({
    args: {}, // No arguments needed as we get data from Clerk identity
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        let user = await getUserByClerkId(ctx.db, identity.subject);

        if (!user) {
            // First time - create user
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                email: identity.email || "",
                firstName: identity.givenName,
                lastName: identity.familyName,
                imageUrl: identity.pictureUrl,
                assignedCampuses: [],
                isActive: true,
                createdAt: Date.now()
            });
            return userId;
        }

        // Update info from Clerk
        await ctx.db.patch(user._id, {
            email: identity.email || user.email,
            firstName: identity.givenName || user.firstName,
            lastName: identity.familyName || user.lastName,
            imageUrl: identity.pictureUrl || user.imageUrl,
            lastLoginAt: Date.now()
        });

        return user._id;
    }
});

/**
 * Get current user with role from Clerk metadata
 * Now uses centralized role extraction logic
 */
export const getCurrentUser = query({
    args: {}, // No arguments needed
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const user = await getUserByClerkId(ctx.db, identity.subject);
        if (!user) return null;

        // Use centralized role extraction from shared utilities
        const role = extractRoleFromMetadata(identity);
        const operatorPermissions = extractOperatorPermissions(identity, role);

        return {
            ...user,
            role,
            // Include operator permissions if applicable
            ...(operatorPermissions && { operatorPermissions })
        };
    }
});

/**
 * Check if current user is authenticated
 */
export const isAuthenticated = query({
    args: {}, // No arguments needed
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity !== null;
    }
});
