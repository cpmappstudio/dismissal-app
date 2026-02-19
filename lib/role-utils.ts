// lib/role-utils.ts

export type DismissalRole =
    | 'superadmin'
    | 'principal'
    | 'admin' // Legacy compatibility during migration
    | 'allocator'
    | 'dispatcher'
    | 'viewer'
    | 'operator';

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
    return hasRole(userRole, ['principal', 'admin', 'superadmin']);
}

export function canAccessOperators(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['operator', 'principal', 'admin', 'superadmin']);
}

export function canAllocate(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['allocator', 'operator', 'principal', 'admin', 'superadmin']);
}

export function canDispatch(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['dispatcher', 'operator', 'principal', 'admin', 'superadmin']);
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

export function hasGlobalCampusScope(userRole: DismissalRole | null): boolean {
    return userRole === 'superadmin';
}

export function isManagementRole(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['principal', 'admin', 'superadmin']);
}

export function canCreateCampus(userRole: DismissalRole | null): boolean {
    return canCreateDeleteCampus(userRole);
}

export function canCreateDeleteCampus(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['superadmin']);
}

export function canAccessDashboard(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ['superadmin']);
}

const PRINCIPAL_CRUD_STAFF_ROLES: DismissalRole[] = [
    "operator",
    "allocator",
    "dispatcher",
    "viewer",
];

const SUPERADMIN_CRUD_STAFF_ROLES: DismissalRole[] = [
    "superadmin",
    "principal",
    "admin",
    "operator",
    "allocator",
    "dispatcher",
    "viewer",
];

export function isPrincipalLikeRole(userRole: DismissalRole | null): boolean {
    return hasRole(userRole, ["principal", "admin"]);
}

export function getCrudStaffRoles(userRole: DismissalRole | null): DismissalRole[] {
    if (userRole === "superadmin") return SUPERADMIN_CRUD_STAFF_ROLES;
    if (isPrincipalLikeRole(userRole)) return PRINCIPAL_CRUD_STAFF_ROLES;
    return [];
}

export function canCrudStaffRole(
    userRole: DismissalRole | null,
    targetRole: DismissalRole | null
): boolean {
    if (!targetRole) return false;
    return getCrudStaffRoles(userRole).includes(targetRole);
}
