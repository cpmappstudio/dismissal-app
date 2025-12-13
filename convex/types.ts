// convex/types.ts

import { v, Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";

// Import centralized role utilities to avoid duplication
import type { DismissalRole } from "../lib/role-utils";

// ============================================================================
// COMMON VALIDATORS (Reusable across schema and functions)
// ============================================================================

export const roleValidator = v.union(
    v.literal("superadmin"),
    v.literal("admin"),
    v.literal("allocator"),
    v.literal("dispatcher"),
    v.literal("viewer"),
    v.literal("operator")
);

// Use DismissalRole from role-utils for consistency
export type UserRole = DismissalRole; // Keep UserRole as alias for backward compatibility

/**
 * Lane validator
 */
export const laneValidator = v.union(
    v.literal("left"),
    v.literal("right")
);
export type Lane = Infer<typeof laneValidator>;

/**
 * Queue status validator
 */
export const queueStatusValidator = v.union(
    v.literal("waiting"),
    v.literal("completed")
);
export type QueueStatus = Infer<typeof queueStatusValidator>;

/**
 * Audit action validator
 */
export const auditActionValidator = v.union(
    v.literal("student_created"),
    v.literal("student_updated"),
    v.literal("student_deleted"),
    v.literal("car_assigned"),
    v.literal("car_removed"),
    v.literal("car_added_to_queue"),
    v.literal("car_removed_from_queue"),
    v.literal("car_moved_lane"),
    v.literal("user_campus_updated"),
    v.literal("user_permissions_updated"),
    v.literal("user_status_updated"),
    v.literal("login"),
    v.literal("logout")
);
export type AuditAction = Infer<typeof auditActionValidator>;

/**
 * Grade validator - American K-12 system
 */
export const gradeValidator = v.union(
    v.literal("PreK"),
    v.literal("K"),
    v.literal("1st"),
    v.literal("2nd"),
    v.literal("3rd"),
    v.literal("4th"),
    v.literal("5th"),
    v.literal("6th"),
    v.literal("7th"),
    v.literal("8th"),
    v.literal("9th"),
    v.literal("10th"),
    v.literal("11th"),
    v.literal("12th")
);
export type Grade = Infer<typeof gradeValidator>;

// NOTE: Campus locations are now dynamic and stored in the campusSettings table.
// Use the api.campus.getOptions query to get available campuses.
// CampusLocation type has been replaced with string for flexibility.

/**
 * Academic grades supported by the system (for forms and UI)
 */
export const GRADES = [
    "PreK",
    "K",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th"
] as const;

/**
 * Operator permissions validator
 */
export const operatorPermissionsValidator = v.object({
    canAllocate: v.boolean(),
    canDispatch: v.boolean(),
    canView: v.boolean(),
});
export type OperatorPermissions = Infer<typeof operatorPermissionsValidator>;

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

/**
 * User profile from database (sin rol)
 */
export type UserProfile = Doc<"users">;

/**
 * User profile con rol desde Clerk
 */
export interface UserWithRole extends UserProfile {
    role: UserRole;
}

/**
 * Public user information (safe to share)
 */
export type PublicUserInfo = Pick<Doc<"users">,
    "_id" | "email" | "firstName" | "lastName" | "imageUrl"
>;

/**
 * User with campus access info and role
 */
export interface UserWithAccess {
    user: UserProfile;
    role: UserRole;
    assignedCampuses: string[];
    permissions: OperatorPermissions | null;
}

// ============================================================================
// STUDENT TYPES
// ============================================================================

/**
 * Student document type
 */
export type Student = Doc<"students">;

/**
 * Student with car assignment info
 */
export interface StudentWithCar {
    student: Student;
    carNumber: number;
    hasCarAssigned: boolean;
    siblings: Student[]; // Other students with same car number
}

/**
 * Student summary for queue display
 */
export interface StudentSummary {
    studentId: Id<"students">;
    name: string;
    grade: string;
    avatarUrl?: string;
    avatarStorageId?: Id<"_storage">;
}

// ============================================================================
// DISMISSAL QUEUE TYPES
// ============================================================================

/**
 * Queue entry type
 */
export type QueueEntry = Doc<"dismissalQueue">;

/**
 * Car data for display (matches frontend CarData type)
 */
export interface CarData {
    id: string;
    carNumber: number;
    lane: Lane;
    position: number;
    assignedTime: Date;
    students: StudentData[];
    campus: string;
    imageColor: string;
}

/**
 * Student data for car display
 */
export interface StudentData {
    id: string;
    name: string;
    grade?: string;
    birthday?: string;
    imageUrl?: string;
    avatarStorageId?: Id<"_storage">;
}

/**
 * Queue state for a campus
 */
export interface QueueState {
    campus: string;
    leftLane: QueueEntry[];
    rightLane: QueueEntry[];
    totalCars: number;
    averageWaitTime?: number;
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
    campus: string;
    currentCars: number;
    leftLaneCars: number;
    rightLaneCars: number;
    averageWaitTime: number;
    todayTotal: number;
}

// ============================================================================
// CAMPUS TYPES
// ============================================================================

/**
 * Campus settings type
 */
export type CampusSettings = Doc<"campusSettings">;

/**
 * Campus with current state
 */
export interface CampusState {
    settings: CampusSettings;
    activeStudents: number;
    currentQueue: QueueState;
    availableGrades: string[];
}

/**
 * Campus list item for dropdowns
 */
export interface CampusOption {
    id: Doc<"campusSettings">["_id"];
    value: string;
    label: string;
    isActive: boolean;
}

// ============================================================================
// HISTORY AND ANALYTICS TYPES
// ============================================================================

/**
 * Dismissal history entry
 */
export type DismissalHistoryEntry = Doc<"dismissalHistory">;

/**
 * Daily dismissal summary
 */
export interface DailyDismissalSummary {
    date: string;
    campus: string;
    totalCars: number;
    totalStudents: number;
    averageWaitTime: number;
    peakHour: string;
    laneDistribution: {
        left: number;
        right: number;
    };
}

/**
 * Car pickup history
 */
export interface CarPickupHistory {
    carNumber: number;
    pickupTimes: Array<{
        date: string;
        time: number;
        students: string[];
        waitTime: number;
    }>;
    averageWaitTime: number;
    preferredLane?: Lane;
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

/**
 * Student creation/update form
 */
export interface StudentFormData {
    firstName: string;
    lastName: string;
    birthday: string;
    grade: Grade | string; // Allow custom grades
    campusLocation: string;
    carNumber: number;
    avatarUrl?: string;
    avatarStorageId?: Id<"_storage">;
}

/**
 * User creation form (para sincronización con Clerk)
 */
export interface UserFormData {
    clerkId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    assignedCampuses: string[];
    operatorPermissions?: OperatorPermissions;
}

/**
 * Grade definition for campus
 */
export interface GradeDefinition {
    name: string; // "1st", "2nd", "3rd", etc.
    code: string; // "1", "2", "3", etc.
    order: number; // For sorting
    isActive: boolean;
}

/**
 * Campus address
 */
export interface CampusAddress {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
}

/**
 * Campus metrics
 */
export interface CampusMetrics {
    totalStudents: number;
    totalStaff: number;
    activeStudents: number;
    activeStaff: number;
    lastUpdated: number;
}

/**
 * Campus creation form
 */
export interface CampusFormData {
    campusName: string;
    displayName: string;
    description?: string;
    code?: string;
    timezone: string;
    dismissalStartTime?: string;
    dismissalEndTime?: string;
    logoStorageId?: Id<"_storage">;
    address?: CampusAddress;
    availableGrades?: GradeDefinition[];
    allowMultipleStudentsPerCar: boolean;
    requireCarNumber: boolean;
    createdBy: Id<"users">;
}

/**
 * Queue entry input
 */
export interface QueueEntryInput {
    carNumber: number;
    campus: string;
    lane: Lane;
}

// ============================================================================
// VIEW-SPECIFIC TYPES (for different user roles)
// ============================================================================

/**
 * Admin dashboard view
 */
export interface AdminDashboard {
    totalStudents: number;
    totalCampuses: number;
    activeUsers: number;
    campusStates: CampusState[];
    recentActivity: AuditLogEntry[];
}

/**
 * Allocator view
 */
export interface AllocatorView {
    campus: string;
    queueState: QueueState;
    recentCars: number[]; // Recently added car numbers
    availableStudents: StudentWithCar[]; // Students not in queue
}

/**
 * Dispatcher view
 */
export interface DispatcherView {
    campus: string;
    queueState: QueueState;
    nextCars: QueueEntry[]; // Next 5 cars to be picked up
    recentlyCompleted: DismissalHistoryEntry[];
}

/**
 * Viewer display
 */
export interface ViewerDisplay {
    campus: string;
    leftLane: CarData[];
    rightLane: CarData[];
    isFullscreen: boolean;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

/**
 * Student search filters
 */
export interface StudentSearchFilters {
    searchTerm?: string;
    campus?: string;
    grade?: string;
    carNumber?: number;
    hasCarAssigned?: boolean;
    isActive?: boolean;
}

/**
 * Queue search filters
 */
export interface QueueFilters {
    campus: string;
    lane?: Lane;
    status?: QueueStatus;
    carNumber?: number;
}

/**
 * History search filters
 */
export interface HistoryFilters {
    campus?: string;
    dateFrom?: string;
    dateTo?: string;
    carNumber?: number;
    minWaitTime?: number;
    maxWaitTime?: number;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

/**
 * Audit log entry
 */
export type AuditLogEntry = Doc<"auditLogs">;

/**
 * Audit log with user info
 */
export interface AuditLogWithUser {
    log: AuditLogEntry;
    user: PublicUserInfo;
    targetDetails?: any;
}

// ============================================================================
// REAL-TIME UPDATE TYPES
// ============================================================================

/**
 * Queue update event
 */
export interface QueueUpdateEvent {
    type: "car_added" | "car_removed" | "position_changed";
    campus: string;
    lane: Lane;
    carNumber: number;
    position?: number;
    timestamp: number;
}

/**
 * System notification
 */
export interface SystemNotification {
    id: string;
    type: "info" | "warning" | "error" | "success";
    message: string;
    campus?: string;
    timestamp: number;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS AND TYPE GUARDS
// ============================================================================

/**
 * Check if user has access to a campus by campus ID
 * Campus-specific logic that belongs in types rather than role-utils
 * @param user - The user profile
 * @param campusId - The campus ID (from campusSettings table)
 * @param role - The user's role
 */
export function hasAccessToCampus(user: UserProfile, campusId: string, role: UserRole): boolean {
    if (role === "admin" || role === "superadmin") {
        return true; // Admins have access to all campuses
    }
    // Compare against campus IDs in assignedCampuses
    return user.assignedCampuses.some((id) => id === campusId);
}

/**
 * Convert queue entry to car data for frontend
 * Frontend-specific conversion that belongs in types
 */
export function queueEntryToCarData(entry: QueueEntry): CarData {
    return {
        id: entry._id,
        carNumber: entry.carNumber,
        lane: entry.lane,
        position: entry.position,
        assignedTime: new Date(entry.assignedTime),
        students: entry.students.map(s => ({
            id: s.studentId,
            name: s.name,
            grade: s.grade,
            imageUrl: s.avatarUrl,
            avatarStorageId: s.avatarStorageId
        })),
        campus: entry.campusLocation,
        imageColor: entry.carColor
    };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available car colors
 */
export const CAR_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#ef4444', // red
    '#8b5cf6', // purple
    '#f97316', // orange
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f59e0b'  // amber
] as const;

/**
 * Default campus settings
 */
export const DEFAULT_CAMPUS_SETTINGS = {
    allowMultipleStudentsPerCar: true,
    requireCarNumber: true,
    dismissalStartTime: "14:30",
    dismissalEndTime: "15:30",
    timezone: "America/New_York"
} as const;

// ============================================================================
// EXPORT UTILITY TYPES
// ============================================================================

export type { Doc, Id } from "./_generated/dataModel";
export type { WithoutSystemFields } from "convex/server";

/**
 * Helper type to extract document type without system fields
 */
export type CreateInput<TableName extends keyof typeof import("./schema")["default"]["tables"]> =
    WithoutSystemFields<Doc<TableName>>;

/**
 * Helper type for partial updates
 */
export type UpdateInput<TableName extends keyof typeof import("./schema")["default"]["tables"]> =
    Partial<CreateInput<TableName>>;