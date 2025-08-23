import { auth } from "@clerk/nextjs/server";
import type { UserRole } from "@/convex/types";

/**
 * Get current user role from Clerk session claims
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
    const { sessionClaims } = await auth();
    return (sessionClaims?.metadata?.role as UserRole) || null;
}

/**
 * Check if user has any of the required roles
 */
export function hasRole(userRole: UserRole | null, requiredRoles: UserRole[]): boolean {
    return userRole ? requiredRoles.includes(userRole) : false;
}

/**
 * Check if user can access admin features
 */
export function canAccessAdmin(userRole: UserRole | null): boolean {
    return hasRole(userRole, ['admin', 'superadmin']);
}

/**
 * Check if user can access professor features  
 */
export function canAccessProfessor(userRole: UserRole | null): boolean {
    return hasRole(userRole, ['professor', 'admin', 'superadmin']);
}

/**
 * Check if user is a student
 */
export function isStudent(userRole: UserRole | null): boolean {
    return userRole === 'student';
}
