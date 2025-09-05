// convex/auth.ts

import { mutation, query } from "./_generated/server";

/**
 * Get current user from Clerk identity
 * Simple authentication check without role management
 */
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        return {
            id: identity.subject,
            email: identity.email || identity.emailAddress || "",
            firstName: identity.firstName || identity.givenName || "",
            lastName: identity.lastName || identity.familyName || "",
            imageUrl: identity.imageUrl || identity.pictureUrl || "",
            username: identity.username || ""
        };
    }
});

/**
 * Check if current user is authenticated
 */
export const isAuthenticated = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity !== null;
    }
});
