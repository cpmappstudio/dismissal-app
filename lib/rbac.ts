import { auth } from "@clerk/nextjs/server";
import { createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import type { UserRole } from "@/convex/types";

// Rutas específicas por rol
const roleMatchers = {
    student: createRouteMatcher(['/:locale/academic(.*)', '/academic(.*)']),
    professor: createRouteMatcher(['/:locale/teaching(.*)', '/teaching(.*)']),
    admin: createRouteMatcher(['/:locale/admin(.*)', '/admin(.*)']),
} as const;

// Constantes inmutables con type safety completo
const ROLE_PERMISSIONS = {
    student: ['student'] as const,
    professor: ['professor', 'admin', 'superadmin'] as const,
    admin: ['admin', 'superadmin'] as const,
} satisfies Record<keyof typeof roleMatchers, readonly UserRole[]>;

/**
 * Get current user role from Clerk session claims
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
    try {
        const { sessionClaims } = await auth();

        if (!sessionClaims) return null;

        // Clerk stores custom claims in publicMetadata or privateMetadata
        // Use type assertion for metadata access since Clerk types are dynamic
        const publicMeta = (sessionClaims as any).publicMetadata;
        const privateMeta = (sessionClaims as any).privateMetadata;
        const metadata = (sessionClaims as any).metadata;

        const role = publicMeta?.role || privateMeta?.role || metadata?.role;

        return (role as UserRole) || null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
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

/**
 * Verifica acceso por rol en el contexto del middleware
 * @returns 'allowed' | 'denied' | 'unknown'
 */
export function checkRoleAccess(
    req: NextRequest,
    userRole: UserRole
): 'allowed' | 'denied' | 'unknown' {
    // Verificar cada matcher de rol
    for (const [route, matcher] of Object.entries(roleMatchers)) {
        if (matcher(req)) {
            const allowed = ROLE_PERMISSIONS[route as keyof typeof roleMatchers] as readonly UserRole[];
            return allowed.includes(userRole) ? 'allowed' : 'denied';
        }
    }

    // ⚠️ CRÍTICO: Si no coincide con ningún matcher, es ruta desconocida
    return 'unknown';
}
