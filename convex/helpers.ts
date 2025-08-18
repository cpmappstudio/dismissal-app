import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
    StudentProgress,
    EnrollmentWithDetails,
    GradeWeights,
    // UserTemplate,
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
 * Get user template with enriched data
 */
export async function getUserTemplateWithDetails(
    ctx: QueryCtx,
    email: string
) {
    const template = await getUserTemplate(ctx, email);
    if (!template) return null;

    const [program, creator] = await Promise.all([
        template.programId ? ctx.db.get(template.programId) : null,
        ctx.db.get(template.createdBy)
    ]);

    return {
        template,
        program,
        creator
    };
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
// DATA ENRICHMENT HELPERS
// ============================================================================

/**
 * Enrich enrollments with course and section details
 */
export async function enrichEnrollmentsWithDetails(
    ctx: QueryCtx,
    enrollments: Doc<"enrollments">[]
): Promise<EnrollmentWithDetails[]> {
    const enrichedEnrollments: EnrollmentWithDetails[] = [];

    for (const enrollment of enrollments) {
        const [course, section] = await Promise.all([
            ctx.db.get(enrollment.courseId),
            ctx.db.get(enrollment.sectionId)
        ]);

        // Only include if both course and section exist
        if (course && section) {
            enrichedEnrollments.push({
                enrollment,
                course,
                section,
            });
        } else {
            console.warn(`Missing data for enrollment ${enrollment._id}`);
        }
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

    const [course, enrollments] = await Promise.all([
        ctx.db.get(section.courseId),
        ctx.db
            .query("enrollments")
            .withIndex("by_section_status", (q) =>
                q.eq("sectionId", sectionId).eq("status", "enrolled")
            )
            .collect()
    ]);

    return {
        section,
        course,
        enrollments,
        enrolledCount: enrollments.length,
    };
}

// ============================================================================
// SEMESTER HELPERS
// ============================================================================

/**
 * Get current active semester
 */
export async function getCurrentSemester(ctx: QueryCtx): Promise<Doc<"semesters"> | null> {
    return await ctx.db
        .query("semesters")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .first();
}

/**
 * Get enrollment period semester
 */
export async function getEnrollmentSemester(ctx: QueryCtx): Promise<Doc<"semesters"> | null> {
    return await ctx.db
        .query("semesters")
        .withIndex("by_status", (q) => q.eq("status", "enrollment"))
        .first();
}

// ============================================================================
// PROGRESS CALCULATION HELPERS
// ============================================================================

/**
 * Calculate academic progress for a student
 */
export async function calculateStudentProgress(
    ctx: QueryCtx,
    studentId: Id<"users">
): Promise<StudentProgress | null> {
    const student = await ctx.db.get(studentId);
    if (!student?.studentProfile) return null;

    const program = await ctx.db.get(student.studentProfile.programId);
    if (!program) return null;

    const completedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_status", (q) =>
            q.eq("studentId", studentId).eq("status", "completed")
        )
        .collect();

    let coreCredits = 0;
    let electiveCredits = 0;
    let generalCredits = 0;
    let totalCredits = 0;

    for (const enrollment of completedEnrollments) {
        if (enrollment.creditsEarned) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                totalCredits += enrollment.creditsEarned;
                switch (course.area) {
                    case "core":
                        coreCredits += enrollment.creditsEarned;
                        break;
                    case "elective":
                        electiveCredits += enrollment.creditsEarned;
                        break;
                    case "general":
                        generalCredits += enrollment.creditsEarned;
                        break;
                }
            }
        }
    }

    return {
        totalCredits,
        coreCredits,
        electiveCredits,
        generalCredits,
        requiredCredits: program.totalCredits,
        completionPercentage: Math.min(100, (totalCredits / program.totalCredits) * 100),
        program,
    };
}

/**
 * Calculate GPA for a student
 */
export async function calculateGPA(
    ctx: QueryCtx,
    studentId: Id<"users">
): Promise<number> {
    const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_status", (q) =>
            q.eq("studentId", studentId).eq("status", "completed")
        )
        .collect();

    if (enrollments.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const enrollment of enrollments) {
        if (enrollment.finalGrade && enrollment.creditsEarned) {
            totalPoints += enrollment.finalGrade * enrollment.creditsEarned;
            totalCredits += enrollment.creditsEarned;
        }
    }

    return totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;
}

// ============================================================================
// ENROLLMENT VALIDATION HELPERS
// ============================================================================

/**
 * Check if student is already enrolled in a course for a semester
 */
export async function isStudentEnrolledInCourse(
    ctx: QueryCtx,
    studentId: Id<"users">,
    courseId: Id<"courses">,
    semesterId: Id<"semesters">
): Promise<boolean> {
    const existing = await ctx.db
        .query("enrollments")
        .withIndex("by_student_semester", (q) =>
            q.eq("studentId", studentId).eq("semesterId", semesterId)
        )
        .filter((q) =>
            q.and(
                q.eq(q.field("courseId"), courseId),
                q.neq(q.field("status"), "dropped")
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
 * Check if student meets minimum semester requirement for course
 */
export async function meetsMinimumSemester(
    ctx: QueryCtx,
    studentId: Id<"users">,
    courseId: Id<"courses">
): Promise<boolean> {
    const [student, course] = await Promise.all([
        ctx.db.get(studentId),
        ctx.db.get(courseId)
    ]);

    if (!student?.studentProfile || !course) return false;

    const currentYear = new Date().getFullYear();
    const yearsEnrolled = currentYear - student.studentProfile.enrollmentYear;
    const currentSemester = yearsEnrolled * 2 + 1; // Approximation

    return currentSemester >= course.minSemester;
}

// ============================================================================
// PREREQUISITE HELPERS
// ============================================================================

/**
 * Check if student has completed all prerequisites for a course
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
        .withIndex("by_student_status", (q) =>
            q.eq("studentId", studentId).eq("status", "completed")
        )
        .collect();

    const completedCourseCodes = new Set<string>();
    for (const enrollment of completedEnrollments) {
        const completedCourse = await ctx.db.get(enrollment.courseId);
        if (completedCourse) {
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
        .filter((q) => q.eq(q.field("role"), "student"))
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
        .filter((q) => q.eq(q.field("role"), "professor"))
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
 * Calculate letter grade from numerical grade (Colombian scale)
 */
export function calculateLetterGrade(numericalGrade: number): string {
    if (numericalGrade >= 4.5) return "A";
    if (numericalGrade >= 4.0) return "A-";
    if (numericalGrade >= 3.5) return "B+";
    if (numericalGrade >= 3.0) return "B";
    if (numericalGrade >= 2.5) return "C";
    return "F";
}

/**
 * Determine if grade is passing (Colombian scale: 3.0 minimum)
 */
export function isPassingGrade(grade: number): boolean {
    return grade >= 3.0;
}

/**
 * Parse grade weights from JSON string
 */
export function parseGradeWeights(gradeWeightsJson: string): GradeWeights | null {
    try {
        const weights = JSON.parse(gradeWeightsJson) as GradeWeights;
        if (validateGradeWeights(weights)) {
            return weights;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Validate that grade weights sum to 100
 */
export function validateGradeWeights(weights: GradeWeights): boolean {
    const total = weights.exams + weights.assignments + weights.final + weights.other;
    return Math.abs(total - 100) < 0.01; // Tolerance for floating point
}

/**
 * Calculate current grade for an enrollment
 */
export async function calculateCurrentGrade(
    ctx: QueryCtx,
    enrollmentId: Id<"enrollments">
): Promise<number> {
    const enrollment = await ctx.db.get(enrollmentId);
    if (!enrollment) return 0;

    const section = await ctx.db.get(enrollment.sectionId);
    if (!section) return 0;

    const weights = parseGradeWeights(section.gradeWeights);
    if (!weights) return 0;

    const grades = await ctx.db
        .query("grades")
        .withIndex("by_enrollment", (q) => q.eq("enrollmentId", enrollmentId))
        .collect();

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const grade of grades) {
        if (grade.score !== undefined) {
            const activity = await ctx.db.get(grade.activityId);
            if (activity && activity.gradesReleased) {
                const normalizedScore = (grade.score / activity.maxPoints) * 5; // Convert to 0-5 scale
                totalWeightedScore += normalizedScore * activity.weight;
                totalWeight += activity.weight;
            }
        }
    }

    return totalWeight > 0 ? Number((totalWeightedScore / totalWeight).toFixed(2)) : 0;
}

// ============================================================================
// PRIVACY HELPERS
// ============================================================================

/**
 * Check if user can view another user's profile
 */
export async function canViewProfile(
    ctx: QueryCtx,
    viewerId: Id<"users">,
    targetId: Id<"users">
): Promise<boolean> {
    // Same user can always view own profile
    if (viewerId === targetId) return true;

    const [viewer, target] = await Promise.all([
        ctx.db.get(viewerId),
        ctx.db.get(targetId)
    ]);

    if (!viewer || !target) return false;

    // Admins and professors can view all profiles
    if (viewer.role === "admin" || viewer.role === "professor") return true;

    // Check student privacy settings
    if (target.role === "student" && target.studentProfile) {
        return target.studentProfile.showProfile;
    }

    return false;
}

/**
 * Check if user can view another user's grades
 */
export async function canViewGrades(
    ctx: QueryCtx,
    viewerId: Id<"users">,
    targetId: Id<"users">
): Promise<boolean> {
    // Same user can always view own grades
    if (viewerId === targetId) return true;

    const [viewer, target] = await Promise.all([
        ctx.db.get(viewerId),
        ctx.db.get(targetId)
    ]);

    if (!viewer || !target) return false;

    // Admins and professors can view all grades
    if (viewer.role === "admin" || viewer.role === "professor") return true;

    // Check student privacy settings
    if (target.role === "student" && target.studentProfile) {
        return target.studentProfile.showGrades;
    }

    return false;
}