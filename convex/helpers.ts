// convex/helpers.ts

import { QueryCtx, MutationCtx, DatabaseReader, DatabaseWriter } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import type {
    UserProfile,
    StudentWithCar,
    QueueEntry,
    QueueState,
    CarData,
    StudentSummary,
    Lane,
    QueueMetrics,
    DailyDismissalSummary,
    CarPickupHistory,
} from "./types";
import {
    DismissalRole,
    OperatorPermissions,
    extractRoleFromMetadata,
    extractOperatorPermissions,
    canAccessAdmin,
    canAllocate,
    canDispatch
} from "../lib/role-utils";
import { CAR_COLORS } from "./types";

// Type aliases for cleaner function signatures
type DbReader = QueryCtx["db"] | DatabaseReader;
type DbWriter = MutationCtx["db"] | DatabaseWriter;

// ============================================================================
// USER AUTHENTICATION & ACCESS HELPERS
// ============================================================================

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(
    db: DbReader,
    clerkId: string
): Promise<Doc<"users"> | null> {
    return await db
        .query("users")
        .withIndex("by_clerk_id", q => q.eq("clerkId", clerkId))
        .first();
}

/**
 * Get user by email
 */
export async function getUserByEmail(
    db: DbReader,
    email: string
): Promise<Doc<"users"> | null> {
    return await db
        .query("users")
        .withIndex("by_email", q => q.eq("email", email))
        .first();
}

/**
 * Validate user access from Clerk identity
 * Helper completo para validar autenticación y acceso
 * @param campus - Campus name (will be resolved to ID internally)
 */
export async function validateUserAccess(
    ctx: QueryCtx | MutationCtx,
    requiredRoles?: DismissalRole[],
    campus?: string
): Promise<{
    user: Doc<"users">;
    role: DismissalRole;
    identity: any;
}> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Use centralized role extraction from shared utilities
    const role = extractRoleFromMetadata(identity as any);

    if (requiredRoles && !requiredRoles.includes(role)) {
        throw new Error(`Requires role: ${requiredRoles.join(' or ')}`);
    }

    const user = await getUserByClerkId(ctx.db, identity.subject);
    if (!user || !user.isActive) throw new Error("User not active in system");

    // Check campus access by resolving name to ID
    if (campus && role !== 'superadmin') {
        const campusDoc = await ctx.db
            .query("campusSettings")
            .withIndex("by_name", (q) => q.eq("campusName", campus))
            .unique();

        if (!campusDoc || !user.assignedCampuses.includes(campusDoc._id)) {
            throw new Error(`No access to campus: ${campus}`);
        }
    }

    return { user, role, identity };
}

/**
 * Check if user has access to a specific campus
 * @param campus - Campus name (will be compared against assigned campus IDs)
 * @param db - Database reader for campus lookup
 */
export async function userHasAccessToCampusAsync(
    db: DbReader,
    user: Doc<"users">,
    campus: string,
    role: DismissalRole
): Promise<boolean> {
    if (role === "admin" || role === "superadmin") {
        return true;
    }

    // Find campus by name to get its ID
    const campusDoc = await db
        .query("campusSettings")
        .withIndex("by_name", (q) => q.eq("campusName", campus))
        .unique();

    if (!campusDoc) {
        return false; // Campus not found
    }

    return user.assignedCampuses.includes(campusDoc._id);
}

/**
 * Check if user has access to a specific campus by ID (synchronous)
 * Use this when you already have the campus ID
 */
export function userHasAccessToCampusById(
    user: Doc<"users">,
    campusId: Id<"campusSettings">,
    role: DismissalRole
): boolean {
    if (role === "admin" || role === "superadmin") {
        return true;
    }
    return user.assignedCampuses.includes(campusId);
}

/**
 * Check if user can perform allocator actions
 * Now uses centralized logic from role-utils
 */
export function userCanAllocate(
    role: DismissalRole,
    operatorPermissions?: OperatorPermissions | null
): boolean {
    if (canAllocate(role)) return true;
    return role === "operator" && operatorPermissions?.canAllocate === true;
}

/**
 * Check if user can perform dispatcher actions
 * Now uses centralized logic from role-utils
 */
export function userCanDispatch(
    role: DismissalRole,
    operatorPermissions?: OperatorPermissions | null
): boolean {
    if (canDispatch(role)) return true;
    return role === "operator" && operatorPermissions?.canDispatch === true;
}

// ============================================================================
// STUDENT MANAGEMENT HELPERS
// ============================================================================

/**
 * Get students by car number - searches across ALL campuses
 * Car numbers are unique across all campuses, so we search globally
 * First tries the current campus, then searches all campuses if needed
 */
export async function getStudentsByCarNumber(
    db: DbReader,
    carNumber: number,
    campusId: Id<"campusSettings">
): Promise<Doc<"students">[]> {
    if (carNumber === 0) return [];

    // Query by car number and filter by campus
    const allStudentsWithCar = await db
        .query("students")
        .withIndex("by_car_number", q => q.eq("carNumber", carNumber))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();

    // First, try to find in the current campus
    const studentsInCampus = allStudentsWithCar.filter(s =>
        s.campuses.includes(campusId)
    );

    // If found in current campus, return immediately
    if (studentsInCampus.length > 0) {
        return studentsInCampus;
    }

    // If not found in current campus, return all students with this car number
    // This allows calling cars from any campus to any campus
    return allStudentsWithCar;
}

/**
 * Get unique grades for a campus
 */
export async function getCampusGrades(
    db: DbReader,
    campusId: Id<"campusSettings">
): Promise<string[]> {
    const students = await db
        .query("students")
        .withIndex("by_active", q => q.eq("isActive", true))
        .collect();

    // Filter students by campus
    const campusStudents = students.filter(s => s.campuses.includes(campusId));

    const grades = new Set(campusStudents.map(s => s.grade));
    return Array.from(grades).sort();
}

/**
 * Get student with car and sibling information
 */
export async function getStudentWithCarInfo(
    db: DbReader,
    studentId: Id<"students">
): Promise<StudentWithCar | null> {
    const student = await db.get(studentId);
    if (!student) return null;

    const studentCampusId = student.campuses[0];
    const siblings = student.carNumber > 0 && studentCampusId
        ? await getStudentsByCarNumber(db, student.carNumber, studentCampusId)
            .then(students => students.filter(s => s._id !== studentId))
        : [];

    return {
        student,
        carNumber: student.carNumber,
        hasCarAssigned: student.carNumber > 0,
        siblings
    };
}

/**
 * Convert student to summary format for queue display
 */
export function studentToSummary(student: Doc<"students">): StudentSummary {
    return {
        studentId: student._id,
        name: student.fullName,
        grade: student.grade,
        avatarUrl: student.avatarUrl
    };
}

// ============================================================================
// DISMISSAL QUEUE HELPERS
// ============================================================================

/**
 * Get current queue state for a campus
 */
export async function getQueueState(
    db: DbReader,
    campus: string
): Promise<QueueState> {
    const entries = await db
        .query("dismissalQueue")
        .withIndex("by_campus_status", q =>
            q.eq("campusLocation", campus).eq("status", "waiting")
        )
        .collect();

    const leftLane = entries
        .filter(e => e.lane === "left")
        .sort((a, b) => a.position - b.position);

    const rightLane = entries
        .filter(e => e.lane === "right")
        .sort((a, b) => a.position - b.position);

    // Calculate average wait time from completed entries today
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = await db
        .query("dismissalHistory")
        .withIndex("by_campus_date", q =>
            q.eq("campusLocation", campus).eq("date", today)
        )
        .collect();

    const avgWaitTime = todayHistory.length > 0
        ? todayHistory.reduce((sum, h) => sum + h.waitTimeSeconds, 0) / todayHistory.length
        : undefined;

    return {
        campus,
        leftLane,
        rightLane,
        totalCars: entries.length,
        averageWaitTime: avgWaitTime
    };
}

/**
 * Get next available position in a lane
 */
export async function getNextPosition(
    db: DbReader,
    campus: string,
    lane: Lane
): Promise<number> {
    const entries = await db
        .query("dismissalQueue")
        .withIndex("by_campus_lane_position", q =>
            q.eq("campusLocation", campus).eq("lane", lane)
        )
        .collect();

    if (entries.length === 0) return 1;

    const maxPosition = Math.max(...entries.map(e => e.position));
    return maxPosition + 1;
}

/**
 * Check if car is already in queue across ALL campuses
 * Prevents the same car from being in multiple campus queues simultaneously
 */
export async function isCarInQueue(
    db: DbReader,
    carNumber: number,
    campus: string
): Promise<boolean> {
    // Check across ALL campuses, not just the current one
    const existing = await db
        .query("dismissalQueue")
        .filter(q =>
            q.and(
                q.eq(q.field("carNumber"), carNumber),
                q.eq(q.field("status"), "waiting")
            )
        )
        .first();

    return existing !== null;
}

/**
 * Reposition cars in lane after removal
 */
export async function repositionLaneCars(
    db: DbWriter,
    campus: string,
    lane: Lane,
    removedPosition: number
): Promise<void> {
    const entries = await db
        .query("dismissalQueue")
        .withIndex("by_campus_lane_position", q =>
            q.eq("campusLocation", campus).eq("lane", lane)
        )
        .filter(q => q.gt(q.field("position"), removedPosition))
        .collect();

    for (const entry of entries) {
        await db.patch(entry._id, { position: entry.position - 1 });
    }
}

/**
 * Convert queue entry to CarData for frontend
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
            imageUrl: s.avatarUrl
        })),
        campus: entry.campusLocation,
        imageColor: entry.carColor
    };
}

/**
 * Generate car color based on car number
 */
export function generateCarColor(carNumber: number): string {
    const colors: readonly string[] = CAR_COLORS;
    return colors[carNumber % colors.length];
}

// ============================================================================
// QUEUE METRICS & ANALYTICS HELPERS
// ============================================================================

/**
 * Get queue metrics for a campus
 */
export async function getQueueMetrics(
    db: DbReader,
    campus: string
): Promise<QueueMetrics> {
    const queueState = await getQueueState(db, campus);

    const today = new Date().toISOString().split('T')[0];
    const todayHistory = await db
        .query("dismissalHistory")
        .withIndex("by_campus_date", q =>
            q.eq("campusLocation", campus).eq("date", today)
        )
        .collect();

    return {
        campus,
        currentCars: queueState.totalCars,
        leftLaneCars: queueState.leftLane.length,
        rightLaneCars: queueState.rightLane.length,
        averageWaitTime: queueState.averageWaitTime || 0,
        todayTotal: todayHistory.length
    };
}

/**
 * Get daily dismissal summary
 */
export async function getDailyDismissalSummary(
    db: DbReader,
    campus: string,
    date: string
): Promise<DailyDismissalSummary | null> {
    const history = await db
        .query("dismissalHistory")
        .withIndex("by_campus_date", q =>
            q.eq("campusLocation", campus).eq("date", date)
        )
        .collect();

    if (history.length === 0) return null;

    const totalStudents = history.reduce(
        (sum, h) => sum + h.studentIds.length, 0
    );

    const avgWaitTime = history.reduce(
        (sum, h) => sum + h.waitTimeSeconds, 0
    ) / history.length;

    const laneDistribution = {
        left: history.filter(h => h.lane === "left").length,
        right: history.filter(h => h.lane === "right").length
    };

    // Find peak hour (most pickups)
    const hourCounts = new Map<number, number>();
    history.forEach(h => {
        const hour = new Date(h.completedAt).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const peakHour = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

    return {
        date,
        campus,
        totalCars: history.length,
        totalStudents,
        averageWaitTime: avgWaitTime,
        peakHour: `${peakHour}:00`,
        laneDistribution
    };
}

/**
 * Get car pickup history
 */
export async function getCarPickupHistory(
    db: DbReader,
    carNumber: number,
    campus: string,
    daysBack: number = 30
): Promise<CarPickupHistory> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    const history = await db
        .query("dismissalHistory")
        .withIndex("by_car_date", q =>
            q.eq("carNumber", carNumber).gte("date", startDateStr)
        )
        .filter(q => q.eq(q.field("campusLocation"), campus))
        .collect();

    const pickupTimes = history.map(h => ({
        date: h.date,
        time: h.completedAt,
        students: h.studentNames,
        waitTime: h.waitTimeSeconds
    }));

    const avgWaitTime = history.length > 0
        ? history.reduce((sum, h) => sum + h.waitTimeSeconds, 0) / history.length
        : 0;

    // Determine preferred lane (most used)
    const laneCounts = { left: 0, right: 0 };
    history.forEach(h => laneCounts[h.lane]++);
    const preferredLane = laneCounts.left > laneCounts.right ? "left" :
        laneCounts.right > laneCounts.left ? "right" : undefined;

    return {
        carNumber,
        pickupTimes,
        averageWaitTime: avgWaitTime,
        preferredLane
    };
}

// ============================================================================
// CAMPUS SETTINGS HELPERS
// ============================================================================

/**
 * Get active campus settings
 */
export async function getActiveCampuses(db: DbReader): Promise<Doc<"campusSettings">[]> {
    return await db
        .query("campusSettings")
        .withIndex("by_active", q => q.eq("isActive", true))
        .collect();
}

/**
 * Get campus settings by name
 */
export async function getCampusSettings(
    db: DbReader,
    campusName: string
): Promise<Doc<"campusSettings"> | null> {
    return await db
        .query("campusSettings")
        .withIndex("by_name", q => q.eq("campusName", campusName))
        .first();
}

/**
 * Check if dismissal is currently active
 */
export function isDismissalTimeActive(
    settings: Doc<"campusSettings">
): boolean {
    if (!settings.dismissalStartTime || !settings.dismissalEndTime) {
        return true; // Always active if no times set
    }

    const now = new Date();
    const [startHour, startMin] = settings.dismissalStartTime.split(':').map(Number);
    const [endHour, endMin] = settings.dismissalEndTime.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// ============================================================================
// AUDIT LOG HELPERS
// ============================================================================

/**
 * Create audit log entry with Clerk identity
 */
export async function createAuditLog(
    db: DbWriter,
    userId: Id<"users">,
    userEmail: string,
    userRole: DismissalRole,
    action: string,
    details: any
): Promise<void> {
    await db.insert("auditLogs", {
        userId,
        username: userEmail, // Using email instead of username
        userRole: userRole,
        action: action as any,
        targetType: details.targetType,
        targetId: details.targetId,
        campusLocation: details.campus,
        details: {
            before: details.before,
            after: details.after,
            metadata: details.metadata
        },
        timestamp: Date.now()
    });
}

/**
 * Create audit log from context (helper for mutations)
 */
export async function createAuditLogFromContext(
    ctx: MutationCtx,
    action: string,
    details: any
): Promise<void> {
    const { user, role, identity } = await validateUserAccess(ctx);

    await createAuditLog(
        ctx.db,
        user._id,
        identity.email || user.email,
        role,
        action,
        details
    );
}

/**
 * Get recent audit logs for a campus
 */
export async function getRecentAuditLogs(
    db: DbReader,
    campus: string,
    limit: number = 50
): Promise<Doc<"auditLogs">[]> {
    return await db
        .query("auditLogs")
        .withIndex("by_campus_time", q => q.eq("campusLocation", campus))
        .order("desc")
        .take(limit);
}