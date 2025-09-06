// convex/users.ts

import { v } from "convex/values";
import { query } from "./_generated/server";
import { extractRoleFromMetadata } from "../lib/role-utils";

/**
 * Get current user profile from Clerk identity
 * Simple authentication check with role extraction
 */
export const getCurrentProfile = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        // Extract role from Clerk metadata using centralized logic
        const role = extractRoleFromMetadata(identity as any);

        return {
            id: identity.subject,
            email: identity.email || identity.emailAddress || "",
            firstName: identity.firstName || identity.givenName || "",
            lastName: identity.lastName || identity.familyName || "",
            imageUrl: identity.imageUrl || identity.pictureUrl || "",
            username: identity.username || "",
            role
        };
    }
});
