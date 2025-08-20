import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    StudentProgress,
    EnrollmentWithDetails,
    PendingCourses,
    AppError,
    ErrorCodes
} from "./types";

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Get current user from authentication context
 */
export async function getCurrentUserFromAuth(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
}

/**
 * Require authentication - throws if user not found
 */
export async function requireAuth(ctx: QueryCtx) {
    const user = await getCurrentUserFromAuth(ctx);
    if (!user) {
        throw new AppError("Authentication required", ErrorCodes.UNAUTHENTICATED);
    }
    return user;
}

/**
 * Require specific role - throws if user doesn't have role
 */
export async function requireRole(
    ctx: QueryCtx,
    requiredRole: "student" | "professor" | "admin"
) {
    const user = await requireAuth(ctx);
    if (user.role !== requiredRole) {
        throw new AppError(
            `Role ${requiredRole} required`,
            ErrorCodes.UNAUTHORIZED
        );
    }
    return user;
}

/**
 * Require user to be either admin or the specific user
 */
export async function requireAdminOrSelf(
    ctx: QueryCtx,
    targetUserId: Id<"users">
) {
    const user = await requireAuth(ctx);
    if (user.role !== "admin" && user._id !== targetUserId) {
        throw new AppError(
            "Unauthorized: Admin access or own account required",
            ErrorCodes.UNAUTHORIZED
        );
    }
    return user;
}

// ============================================================================
// ACCESS LIST & TEMPLATE HELPERS
// ============================================================================

/**
 * Check if email is authorized in access list
 */
export async function checkEmailAuthorization(
    ctx: QueryCtx,
    email: string
): Promise<Doc<"accessList"> | null> {
    const entry = await ctx.db
        .query("accessList")
        .withIndex("by_email_unused", (q) =>
            q.eq("email", email).eq("isUsed", false)
        )
        .first();

    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        return null;
    }

    return entry;
}

/**
 * Get user template by email
 */
export async function getUserTemplate(
    ctx: QueryCtx,
    email: string
): Promise<Doc<"userTemplates"> | null> {
    return await ctx.db
        .query("userTemplates")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
}

/**
 * Delete user template after successful registration
 */
export async function deleteUserTemplate(
    ctx: MutationCtx,
    email: string
): Promise<void> {
    const template = await ctx.db
        .query("userTemplates")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

    if (template) {
        await ctx.db.delete(template._id);
    }
}

// ============================================================================
// PERIOD HELPERS (renamed from semester)
// ============================================================================

/**
 * Get current active period
 */
export async function getCurrentPeriod(ctx: QueryCtx): Promise<Doc<"periods"> | null> {
    return await ctx.db
        .query("periods")
        .withIndex("by_current", (q) => q.eq("isCurrentPeriod", true))
        .first();
}

/**
 * Get enrollment period
 */
export async function getEnrollmentPeriod(ctx: QueryCtx): Promise<Doc<"periods"> | null> {
    return await ctx.db
        .query("periods")
        .withIndex("by_status", (q) => q.eq("status", "enrollment"))
        .first();
}

// ============================================================================
// PROGRESS CALCULATION HELPERS
// ============================================================================

/**
 * Calculate academic progress for a student (40-60-20 credits)
 */
export async function calculateStudentProgress(
    ctx: QueryCtx,
    studentId: Id<"users">
): Promise<StudentProgress | null> {
    const student = await ctx.db.get(studentId);
    if (!student?.studentProfile) return null;

    const program = await ctx.db.get(student.studentProfile.programId);
    if (!program) return null;

    // Get program requirements
    const requirements = await ctx.db
        .query("program_requirements")
        .withIndex("by_program_active", (q) =>
            q.eq("programId", program._id).eq("isActive", true)
        )
        .first();

    if (!requirements) return null;

    // Get completed enrollments
    const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_period_status", (q) =>
            q.eq("studentId", studentId)
        )
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

    // Calculate credits by category
    let humanitiesCredits = 0;
    let coreCredits = 0;
    let electiveCredits = 0;
    let totalCredits = 0;

    for (const enrollment of enrollments) {
        // Only count if passed (effectiveGrade >= 3.0)
        if (enrollment.effectiveGrade && enrollment.effectiveGrade >= 3.0) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                totalCredits += course.credits;
                switch (course.category) {
                    case "humanities":
                        humanitiesCredits += course.credits;
                        break;
                    case "core":
                        coreCredits += course.credits;
                        break;
                    case "elective":
                        electiveCredits += course.credits;
                        break;
                }
            }
        }
    }

    return {
        // Current credits
        humanitiesCredits,
        coreCredits,
        electiveCredits,
        totalCredits,

        // Required credits
        requiredHumanities: requirements.humanitiesCredits,
        requiredCore: requirements.coreCredits,
        requiredElective: requirements.electiveCredits,
        requiredTotal: requirements.totalCredits,

        // Progress percentages
        humanitiesProgress: (humanitiesCredits / requirements.humanitiesCredits) * 100,
        coreProgress: (coreCredits / requirements.coreCredits) * 100,
        electiveProgress: (electiveCredits / requirements.electiveCredits) * 100,
        overallProgress: (totalCredits / requirements.totalCredits) * 100,

        program,
    };
}

/**
 * Calculate GPA for a student
 */
export async function calculateGPA(
    ctx: QueryCtx,
    studentId: Id<"users">,
    periodId?: Id<"periods">
): Promise<number> {
    let enrollments;

    if (periodId) {
        // Period GPA
        enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_period", (q) =>
                q.eq("studentId", studentId).eq("periodId", periodId)
            )
            .collect();
    } else {
        // Cumulative GPA
        enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_student_course", (q) =>
                q.eq("studentId", studentId)
            )
            .collect();
    }

    let totalPoints = 0;
    let totalCredits = 0;

    for (const enrollment of enrollments) {
        // Only count completed courses
        if (enrollment.status === "completed" && enrollment.effectiveGrade) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                totalPoints += enrollment.effectiveGrade * course.credits;
                totalCredits += course.credits;
            }
        }
    }

    return totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;
}

/**
 * Calculate pending courses for pensum visualization
 */
export async function calculatePendingCourses(
    ctx: QueryCtx,
    studentId: Id<"users">
): Promise<PendingCourses | null> {
    const student = await ctx.db.get(studentId);
    if (!student?.studentProfile) return null;

    // Get all program courses
    const allCourses = await ctx.db
        .query("courses")
        .withIndex("by_program_active", (q) =>
            q.eq("programId", student.studentProfile!.programId).eq("isActive", true)
        )
        .collect();

    // Get completed course codes
    const completedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_course", (q) =>
            q.eq("studentId", studentId)
        )
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

    const completedCourseIds = new Set(
        completedEnrollments.map(e => e.courseId)
    );

    // Categorize pending courses
    const humanitiesPending: Doc<"courses">[] = [];
    const corePending: Doc<"courses">[] = [];
    const electivePending: Doc<"courses">[] = [];
    const availableNow: Doc<"courses">[] = [];
    const blockedCourses: Array<{
        course: Doc<"courses">;
        missingPrerequisites: string[];
    }> = [];

    // Get completed course codes for prerequisite checking
    const completedCourseCodes = new Set<string>();
    for (const courseId of completedCourseIds) {
        const course = await ctx.db.get(courseId);
        if (course) completedCourseCodes.add(course.code);
    }

    // Analyze each course
    for (const course of allCourses) {
        if (!completedCourseIds.has(course._id)) {
            // Add to pending by category
            switch (course.category) {
                case "humanities":
                    humanitiesPending.push(course);
                    break;
                case "core":
                    corePending.push(course);
                    break;
                case "elective":
                    electivePending.push(course);
                    break;
            }

            // Check prerequisites
            const missingPrereqs = course.prerequisites.filter(
                code => !completedCourseCodes.has(code)
            );

            if (missingPrereqs.length === 0) {
                availableNow.push(course);
            } else {
                blockedCourses.push({
                    course,
                    missingPrerequisites: missingPrereqs
                });
            }
        }
    }

    // Get current progress
    const progress = await calculateStudentProgress(ctx, studentId);
    if (!progress) return null;

    return {
        humanitiesPending,
        corePending,
        electivePending,

        humanitiesNeeded: Math.max(0, progress.requiredHumanities - progress.humanitiesCredits),
        coreNeeded: Math.max(0, progress.requiredCore - progress.coreCredits),
        electiveNeeded: Math.max(0, progress.requiredElective - progress.electiveCredits),
        totalNeeded: Math.max(0, progress.requiredTotal - progress.totalCredits),

        availableNow,
        blockedCourses,
    };
}

// ============================================================================
// ENROLLMENT VALIDATION HELPERS
// ============================================================================

/**
 * Check if student is already enrolled in a course for a period
 */
export async function isStudentEnrolledInCourse(
    ctx: QueryCtx,
    studentId: Id<"users">,
    courseId: Id<"courses">,
    periodId: Id<"periods">
): Promise<boolean> {
    const existing = await ctx.db
        .query("enrollments")
        .withIndex("by_student_period", (q) =>
            q.eq("studentId", studentId).eq("periodId", periodId)
        )
        .filter((q) =>
            q.and(
                q.eq(q.field("courseId"), courseId),
                q.neq(q.field("status"), "cancelled"),
                q.neq(q.field("status"), "withdrawn")
            )
        )
        .first();

    return existing !== null;
}

/**
 * Check if section has available capacity
 */
export function hasAvailableCapacity(section: Doc<"sections">): boolean {
    return section.enrolled < section.capacity;
}

/**
 * Check if student has completed prerequisites
 */
export async function hasCompletedPrerequisites(
    ctx: QueryCtx,
    studentId: Id<"users">,
    courseId: Id<"courses">
): Promise<{ hasCompleted: boolean; missing: string[] }> {
    const course = await ctx.db.get(courseId);
    if (!course || !course.prerequisites.length) {
        return { hasCompleted: true, missing: [] };
    }

    const completedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_course", (q) =>
            q.eq("studentId", studentId)
        )
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

    const completedCourseCodes = new Set<string>();
    for (const enrollment of completedEnrollments) {
        const completedCourse = await ctx.db.get(enrollment.courseId);
        if (completedCourse && enrollment.effectiveGrade && enrollment.effectiveGrade >= 3.0) {
            completedCourseCodes.add(completedCourse.code);
        }
    }

    const missing = course.prerequisites.filter(
        code => !completedCourseCodes.has(code)
    );

    return {
        hasCompleted: missing.length === 0,
        missing
    };
}

// ============================================================================
// UNIQUE CODE VALIDATION HELPERS
// ============================================================================

/**
 * Check if a program code already exists
 */
export async function isProgramCodeTaken(
    ctx: QueryCtx,
    code: string,
    excludeId?: Id<"programs">
): Promise<boolean> {
    const existing = await ctx.db
        .query("programs")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();

    return existing !== null && existing._id !== excludeId;
}

/**
 * Check if a course code already exists
 */
export async function isCourseCodeTaken(
    ctx: QueryCtx,
    code: string,
    excludeId?: Id<"courses">
): Promise<boolean> {
    const existing = await ctx.db
        .query("courses")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();

    return existing !== null && existing._id !== excludeId;
}

/**
 * Check if a CRN already exists
 */
export async function isCRNTaken(
    ctx: QueryCtx,
    crn: string,
    excludeId?: Id<"sections">
): Promise<boolean> {
    const existing = await ctx.db
        .query("sections")
        .withIndex("by_crn", (q) => q.eq("crn", crn))
        .first();

    return existing !== null && existing._id !== excludeId;
}

// ============================================================================
// USER VALIDATION HELPERS
// ============================================================================

/**
 * Check if email already exists in users
 */
export async function isEmailRegistered(
    ctx: QueryCtx,
    email: string
): Promise<boolean> {
    const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

    return existing !== null;
}

/**
 * Check if student code already exists
 */
export async function isStudentCodeTaken(
    ctx: QueryCtx,
    studentCode: string,
    excludeUserId?: Id<"users">
): Promise<boolean> {
    const users = await ctx.db
        .query("users")
        .withIndex("by_role_active", (q) =>
            q.eq("role", "student")
        )
        .collect();

    for (const user of users) {
        if (user.studentProfile?.studentCode === studentCode) {
            if (!excludeUserId || user._id !== excludeUserId) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if employee code already exists
 */
export async function isEmployeeCodeTaken(
    ctx: QueryCtx,
    employeeCode: string,
    excludeUserId?: Id<"users">
): Promise<boolean> {
    const users = await ctx.db
        .query("users")
        .withIndex("by_role_active", (q) =>
            q.eq("role", "professor")
        )
        .collect();

    for (const user of users) {
        if (user.professorProfile?.employeeCode === employeeCode) {
            if (!excludeUserId || user._id !== excludeUserId) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// GRADE CALCULATION HELPERS
// ============================================================================

/**
 * Calculate letter grade from numerical grade (0-5 scale)
 */
export function calculateLetterGrade(numericalGrade: number): string {
    if (numericalGrade >= 4.5) return "A";
    if (numericalGrade >= 4.0) return "B";
    if (numericalGrade >= 3.5) return "C";
    if (numericalGrade >= 3.0) return "D";
    return "F";
}

/**
 * Determine if grade is passing (3.0 minimum)
 */
export function isPassingGrade(grade: number): boolean {
    return grade >= 3.0;
}

/**
 * Calculate effective grade (makeup replaces final if better)
 */
export function calculateEffectiveGrade(
    finalGrade: number | undefined,
    makeupGrade: number | undefined
): number | undefined {
    if (!finalGrade && !makeupGrade) return undefined;
    if (!makeupGrade) return finalGrade;
    if (!finalGrade) return makeupGrade;
    // Makeup grade replaces final grade (as specified in requirements)
    return makeupGrade;
}

// ============================================================================
// DATA ENRICHMENT HELPERS
// ============================================================================

/**
 * Enrich enrollments with course, section, period, and professor details
 */
export async function enrichEnrollmentsWithDetails(
    ctx: QueryCtx,
    enrollments: Doc<"enrollments">[]
): Promise<EnrollmentWithDetails[]> {
    const enrichedEnrollments: EnrollmentWithDetails[] = [];

    for (const enrollment of enrollments) {
        const [course, section, period] = await Promise.all([
            ctx.db.get(enrollment.courseId),
            ctx.db.get(enrollment.sectionId),
            ctx.db.get(enrollment.periodId)
        ]);

        let professor = null;
        if (section) {
            professor = await ctx.db.get(section.professorId);
        }

        enrichedEnrollments.push({
            enrollment,
            course,
            section,
            professor,
            period,
        });
    }

    return enrichedEnrollments;
}

/**
 * Get section with course details and enrollment count
 */
export async function getSectionWithDetails(
    ctx: QueryCtx,
    sectionId: Id<"sections">
) {
    const section = await ctx.db.get(sectionId);
    if (!section) return null;

    const [course, professor] = await Promise.all([
        ctx.db.get(section.courseId),
        ctx.db.get(section.professorId)
    ]);

    return {
        section,
        course,
        professor,
        enrolledCount: section.enrolled,
        availableSlots: section.capacity - section.enrolled,
    };
}

// ============================================================================
// RANKING HELPERS (calculated dynamically for 250 students)
// ============================================================================

/**
 * Calculate student ranking for a period
 */
export async function calculatePeriodRanking(
    ctx: QueryCtx,
    periodId: Id<"periods">,
    studentId: Id<"users">
): Promise<{ rank: number; total: number; gpa: number }> {
    // Get all enrollments for the period
    const allEnrollments = await ctx.db
        .query("enrollments")
        .filter((q) => q.eq(q.field("periodId"), periodId))
        .collect();

    // Group by student
    const studentGPAs = new Map<string, number>();

    for (const enrollment of allEnrollments) {
        if (enrollment.status === "completed" && enrollment.effectiveGrade) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                const currentTotal = studentGPAs.get(enrollment.studentId) || 0;
                studentGPAs.set(
                    enrollment.studentId,
                    currentTotal + (enrollment.effectiveGrade * course.credits)
                );
            }
        }
    }

    // Calculate GPAs
    const gpas: Array<{ studentId: string; gpa: number }> = [];
    for (const [sid, totalPoints] of studentGPAs) {
        const studentEnrollments = allEnrollments.filter(e => e.studentId === sid);
        let totalCredits = 0;

        for (const enrollment of studentEnrollments) {
            if (enrollment.status === "completed") {
                const course = await ctx.db.get(enrollment.courseId);
                if (course) totalCredits += course.credits;
            }
        }

        if (totalCredits > 0) {
            gpas.push({
                studentId: sid,
                gpa: totalPoints / totalCredits
            });
        }
    }

    // Sort by GPA (descending)
    gpas.sort((a, b) => b.gpa - a.gpa);

    // Find student's rank
    const studentIndex = gpas.findIndex(g => g.studentId === studentId);

    return {
        rank: studentIndex >= 0 ? studentIndex + 1 : 0,
        total: gpas.length,
        gpa: gpas[studentIndex]?.gpa || 0
    };
}