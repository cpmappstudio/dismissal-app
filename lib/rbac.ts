// lib/rbac.ts

import { auth } from "@clerk/nextjs/server";
import {
    DismissalRole,
    extractRoleFromMetadata,
    extractOperatorPermissions,
} from './role-utils';

/**
 * Get current user role from Clerk session claims
 */
export async function getCurrentUserRole(): Promise<DismissalRole | null> {
    try {
        const { sessionClaims } = await auth();
        if (!sessionClaims) return null;

        // Use centralized role extraction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return extractRoleFromMetadata(sessionClaims as any);
    } catch {
        return null;
    }
}

/**
 * Get current user ID from Clerk
 */
export async function getCurrentUserId(): Promise<string | null> {
    try {
        const { userId } = await auth();
        return userId;
    } catch {
        return null;
    }
}

/**
 * Get operator permissions from session claims
 * Solo relevante si el rol es 'operator'
 */
export async function getOperatorPermissions() {
    try {
        const { sessionClaims } = await auth();
        if (!sessionClaims) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const role = extractRoleFromMetadata(sessionClaims as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return extractOperatorPermissions(sessionClaims as any, role);
    } catch {
        return null;
    }
}
