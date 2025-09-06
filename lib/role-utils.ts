// lib/role-utils.ts

export type DismissalRole = 'superadmin' | 'admin' | 'allocator' | 'dispatcher' | 'viewer' | 'operator';

export interface OperatorPermissions {
    canAllocate: boolean;
    canDispatch: boolean;
    canView: boolean;
}

/**
 * Extract role from any Clerk metadata object
 * Works for both server-side sessionClaims and Convex identity
 */
export function extractRoleFromMetadata(metadata: {
    publicMetadata?: { dismissalRole?: string; role?: string };
    privateMetadata?: { dismissalRole?: string; role?: string };
    metadata?: { dismissalRole?: string; role?: string };
    dismissalRole?: string;
    role?: string;
}): DismissalRole {
    const publicMeta = metadata.publicMetadata || metadata;
    const privateMeta = metadata.privateMetadata;
    const meta = metadata.metadata;

    // Priority order for role extraction
    const role = publicMeta?.dismissalRole ||
        publicMeta?.role ||
        privateMeta?.dismissalRole ||
        privateMeta?.role ||
        meta?.dismissalRole ||
        meta?.role;

    return (role as DismissalRole) || 'viewer';
}

/**
 * Extract operator permissions from metadata
 */
export function extractOperatorPermissions(
    metadata: {
        publicMetadata?: { operatorPermissions?: OperatorPermissions };
        operatorPermissions?: OperatorPermissions;
    },
    role: DismissalRole
): OperatorPermissions | null {
    if (role !== 'operator') return null;

    const publicMeta = metadata.publicMetadata || metadata;
    return publicMeta?.operatorPermissions || {
        canAllocate: false,
        canDispatch: false,
        canView: true
    };
}

/**
 * Permission check functions (pure functions, no external dependencies)
 */
export function hasRole(userRole: DismissalRole | null, requiredRoles: DismissalRole[]): boolean {
    return userRole ? requiredRoles.includes(userRole) : false;
}

export function canAccessAdmin(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['admin', 'superadmin']);
}

export function canAccessOperators(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['operator', 'admin', 'superadmin']);
}

export function canAllocate(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['allocator', 'operator', 'admin', 'superadmin']);
}

export function canDispatch(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['dispatcher', 'operator', 'admin', 'superadmin']);
}

export function isViewerOnly(userRole: DismissalRole | null): boolean {
    return userRole === 'viewer';
}

export function isOperator(userRole: DismissalRole | null): boolean {
    return userRole === 'operator';
}

export function isSuperAdmin(userRole: DismissalRole | null): boolean {
    return userRole === 'superadmin';
}
