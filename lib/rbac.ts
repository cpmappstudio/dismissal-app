// lib/rbac.ts

import { auth } from "@clerk/nextjs/server";
import { createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

// Tipos de roles para el sistema dismissal
export type DismissalRole = 'superadmin' | 'admin' | 'allocator' | 'dispatcher' | 'viewer' | 'operator';

// Rutas específicas por rol/función
const roleMatchers = {
    admin: createRouteMatcher(['/:locale/admin(.*)', '/admin(.*)']),
    operators: createRouteMatcher(['/:locale/operators(.*)', '/operators(.*)']), // Ruta general de operators
    allocator: createRouteMatcher(['/:locale/operators/allocator(.*)', '/operators/allocator(.*)']),
    dispatcher: createRouteMatcher(['/:locale/operators/dispatcher(.*)', '/operators/dispatcher(.*)']),
    viewer: createRouteMatcher(['/:locale/operators/viewer(.*)', '/operators/viewer(.*)']),
} as const;

// Permisos por ruta - quién puede acceder a qué
const ROLE_PERMISSIONS = {
    admin: ['admin', 'superadmin'] as const,
    operators: ['operator', 'admin', 'superadmin'] as const, // Operator puede ver todo en /operators
    allocator: ['allocator', 'operator', 'admin', 'superadmin'] as const,
    dispatcher: ['dispatcher', 'operator', 'admin', 'superadmin'] as const,
    viewer: ['viewer', 'operator', 'allocator', 'dispatcher', 'admin', 'superadmin'] as const, // Todos pueden ver
} satisfies Record<keyof typeof roleMatchers, readonly DismissalRole[]>;

/**
 * Get current user role from Clerk session claims
 */
export async function getCurrentUserRole(): Promise<DismissalRole | null> {
    try {
        const { sessionClaims } = await auth();

        if (!sessionClaims) return null;

        // Clerk stores custom claims in publicMetadata
        const publicMeta = (sessionClaims as any).publicMetadata;
        const privateMeta = (sessionClaims as any).privateMetadata;
        const metadata = (sessionClaims as any).metadata;

        // Buscar dismissalRole primero, luego role genérico
        const role = publicMeta?.dismissalRole ||
            publicMeta?.role ||
            privateMeta?.dismissalRole ||
            privateMeta?.role ||
            metadata?.dismissalRole ||
            metadata?.role;

        return (role as DismissalRole) || null;
    } catch (error) {
        console.error('Error getting user role:', error);
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
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

/**
 * Check if user has any of the required roles
 */
export function hasRole(userRole: DismissalRole | null, requiredRoles: DismissalRole[]): boolean {
    return userRole ? requiredRoles.includes(userRole) : false;
}

/**
 * Check if user can access admin features
 */
export function canAccessAdmin(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['admin', 'superadmin']);
}

/**
 * Check if user can access operators section
 */
export function canAccessOperators(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['operator', 'admin', 'superadmin']);
}

/**
 * Check if user can allocate cars (add to queue)
 */
export function canAllocate(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['allocator', 'operator', 'admin', 'superadmin']);
}

/**
 * Check if user can dispatch cars (remove from queue)
 */
export function canDispatch(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['dispatcher', 'operator', 'admin', 'superadmin']);
}

/**
 * Check if user can only view (no modifications)
 */
export function isViewerOnly(userRole: DismissalRole | null): boolean {
    return userRole === 'viewer';
}

/**
 * Check if user is operator (needs additional permission checks)
 */
export function isOperator(userRole: DismissalRole | null): boolean {
    return userRole === 'operator';
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(userRole: DismissalRole | null): boolean {
    return userRole === 'superadmin';
}

/**
 * Verifica acceso por rol en el contexto del middleware
 * @returns 'allowed' | 'denied' | 'unknown'
 */
export function checkRoleAccess(
    req: NextRequest,
    userRole: DismissalRole
): 'allowed' | 'denied' | 'unknown' {
    // Verificar cada matcher de rol - orden importa (más específico primero)
    const matchers = [
        'allocator',
        'dispatcher',
        'viewer',
        'operators', // Debe ir después de los específicos
        'admin'
    ] as const;

    for (const route of matchers) {
        const matcher = roleMatchers[route];
        if (matcher(req)) {
            const allowed = ROLE_PERMISSIONS[route] as readonly DismissalRole[];
            return allowed.includes(userRole) ? 'allowed' : 'denied';
        }
    }

    // Si no coincide con ningún matcher, es ruta desconocida (pública o no protegida)
    return 'unknown';
}

/**
 * Get operator permissions from session claims
 * Solo relevante si el rol es 'operator'
 */
export async function getOperatorPermissions(): Promise<{
    canAllocate: boolean;
    canDispatch: boolean;
    canView: boolean;
} | null> {
    try {
        const { sessionClaims } = await auth();
        if (!sessionClaims) return null;

        const publicMeta = (sessionClaims as any).publicMetadata;
        const role = publicMeta?.dismissalRole || publicMeta?.role;

        // Solo devolver permisos si es operator
        if (role !== 'operator') return null;

        return publicMeta?.operatorPermissions || {
            canAllocate: false,
            canDispatch: false,
            canView: true // Por defecto pueden ver
        };
    } catch (error) {
        console.error('Error getting operator permissions:', error);
        return null;
    }
}