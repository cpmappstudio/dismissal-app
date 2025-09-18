// lib/rbac.ts

import { auth } from "@clerk/nextjs/server";
import { createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import {
    DismissalRole,
    extractRoleFromMetadata,
    extractOperatorPermissions,
    // hasRole,
    // canAccessAdmin,
    // canAccessOperators,
    // canAllocate,
    // canDispatch,
    // isViewerOnly,
    // isOperator,
    // isSuperAdmin
} from './role-utils';

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
