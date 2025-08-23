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
// PERIOD HELPERS
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
// GRADE CALCULATION HELPERS (American System)
// ============================================================================

/**
 * Convert percentage grade to letter grade
 */
export function calculateLetterGrade(percentageGrade: number): string {
    if (percentageGrade >= 97) return "A+";
    if (percentageGrade >= 93) return "A";
    if (percentageGrade >= 90) return "A-";
    if (percentageGrade >= 87) return "B+";
    if (percentageGrade >= 83) return "B";
    if (percentageGrade >= 80) return "B-";
    if (percentageGrade >= 77) return "C+";
    if (percentageGrade >= 73) return "C";
    if (percentageGrade >= 70) return "C-";
    if (percentageGrade >= 67) return "D+";
    if (percentageGrade >= 65) return "D";
    return "F";
}

/**
 * Convert percentage grade to GPA points (4.0 scale)
 */
export function calculateGradePoints(percentageGrade: number): number {
    if (percentageGrade >= 97) return 4.0;  // A+
    if (percentageGrade >= 93) return 4.0;  // A
    if (percentageGrade >= 90) return 3.7;  // A-
    if (percentageGrade >= 87) return 3.3;  // B+
    if (percentageGrade >= 83) return 3.0;  // B
    if (percentageGrade >= 80) return 2.7;  // B-
    if (percentageGrade >= 77) return 2.3;  // C+
    if (percentageGrade >= 73) return 2.0;  // C
    if (percentageGrade >= 70) return 1.7;  // C-
    if (percentageGrade >= 67) return 1.3;  // D+
    if (percentageGrade >= 65) return 1.0;  // D
    return 0.0;  // F
}

/**
 * Calculate quality points (GPA points * credits)
 */
export function calculateQualityPoints(gradePoints: number, credits: number): number {
    return gradePoints * credits;
}

/**
 * Determine if grade is passing (D or better, >= 65%)
 */
export function isPassingGrade(percentageGrade: number): boolean {
    return percentageGrade >= 65;
}

/**
 * Get effective grade from enrollment (just return percentage grade)
 */
export function getEffectiveGrade(enrollment: Doc<"enrollments">): number | undefined {
    return enrollment.percentageGrade || undefined;
}

// ============================================================================
// PROGRESS CALCULATION HELPERS
// ============================================================================

/**
 * Calculate academic progress for a student (40-60-20-X credits)
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
    let generalCredits = 0;
    let totalCredits = 0;

    for (const enrollment of enrollments) {
        // Only count if passed (65% or better)
        if (enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
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
                    case "general":
                        generalCredits += course.credits;
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
        generalCredits,
        totalCredits,

        // Required credits
        requiredHumanities: requirements.humanitiesCredits,
        requiredCore: requirements.coreCredits,
        requiredElective: requirements.electiveCredits,
        requiredGeneral: requirements.generalCredits,
        requiredTotal: requirements.totalCredits,

        // Progress percentages
        humanitiesProgress: (humanitiesCredits / requirements.humanitiesCredits) * 100,
        coreProgress: (coreCredits / requirements.coreCredits) * 100,
        electiveProgress: (electiveCredits / requirements.electiveCredits) * 100,
        generalProgress: (generalCredits / requirements.generalCredits) * 100,
        overallProgress: (totalCredits / requirements.totalCredits) * 100,

        program,
    };
}

/**
 * Calculate GPA for a student using American 4.0 scale
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

    let totalQualityPoints = 0;
    let totalCredits = 0;

    for (const enrollment of enrollments) {
        // Only count completed courses
        if (enrollment.status === "completed" && enrollment.percentageGrade !== null && enrollment.percentageGrade !== undefined) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                const gradePoints = calculateGradePoints(enrollment.percentageGrade);
                const qualityPoints = calculateQualityPoints(gradePoints, course.credits);

                totalQualityPoints += qualityPoints;
                totalCredits += course.credits;
            }
        }
    }

    return totalCredits > 0 ? Number((totalQualityPoints / totalCredits).toFixed(2)) : 0;
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
                q.neq(q.field("status"), "cancelled")
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
        if (completedCourse && enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
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
// VALIDATION HELPERS
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

// ============================================================================
// PENDING COURSES CALCULATION HELPERS
// ============================================================================

/**
 * Calculate pending courses for a student (courses needed to complete program)
 */
export async function calculatePendingCourses(
    ctx: QueryCtx,
    studentId: Id<"users">
): Promise<PendingCourses | null> {
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

    // Get all program courses
    const allProgramCourses = await ctx.db
        .query("courses")
        .filter((q) => q.eq(q.field("programId"), program._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

    // Get completed courses (passed with ≥65%)
    const completedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_course", (q) => q.eq("studentId", studentId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

    const completedCourseIds = new Set<Id<"courses">>();
    const completedCourseCodes = new Set<string>();

    for (const enrollment of completedEnrollments) {
        if (enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
            completedCourseIds.add(enrollment.courseId);
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                completedCourseCodes.add(course.code);
            }
        }
    }

    // Separate courses by category
    const pendingByCategory = {
        humanities: [] as Doc<"courses">[],
        core: [] as Doc<"courses">[],
        elective: [] as Doc<"courses">[],
        general: [] as Doc<"courses">[]
    };

    const availableNow: Doc<"courses">[] = [];
    const blockedCourses: Array<{
        course: Doc<"courses">;
        missingPrerequisites: string[];
    }> = [];

    // Calculate completed credits by category
    let completedCredits = {
        humanities: 0,
        core: 0,
        elective: 0,
        general: 0
    };

    for (const enrollment of completedEnrollments) {
        if (enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
            const course = await ctx.db.get(enrollment.courseId);
            if (course) {
                switch (course.category) {
                    case "humanities":
                        completedCredits.humanities += course.credits;
                        break;
                    case "core":
                        completedCredits.core += course.credits;
                        break;
                    case "elective":
                        completedCredits.elective += course.credits;
                        break;
                    case "general":
                        completedCredits.general += course.credits;
                        break;
                }
            }
        }
    }

    // Process all program courses
    for (const course of allProgramCourses) {
        // Skip if already completed
        if (completedCourseIds.has(course._id)) continue;

        // Add to pending by category
        pendingByCategory[course.category].push(course);

        // Check prerequisites
        const missingPrereqs = course.prerequisites.filter(
            prereqCode => !completedCourseCodes.has(prereqCode)
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

    // Calculate needed credits by category
    const creditsNeeded = {
        humanities: Math.max(0, requirements.humanitiesCredits - completedCredits.humanities),
        core: Math.max(0, requirements.coreCredits - completedCredits.core),
        elective: Math.max(0, requirements.electiveCredits - completedCredits.elective),
        general: Math.max(0, requirements.generalCredits - completedCredits.general)
    };

    const totalNeeded = creditsNeeded.humanities + creditsNeeded.core +
        creditsNeeded.elective + creditsNeeded.general;

    return {
        // By category
        humanitiesPending: pendingByCategory.humanities,
        corePending: pendingByCategory.core,
        electivePending: pendingByCategory.elective,
        generalPending: pendingByCategory.general,

        // Credits needed
        humanitiesNeeded: creditsNeeded.humanities,
        coreNeeded: creditsNeeded.core,
        electiveNeeded: creditsNeeded.elective,
        generalNeeded: creditsNeeded.general,
        totalNeeded,

        // Can take now (prerequisites met)
        availableNow,

        // Blocked by prerequisites
        blockedCourses
    };
}

/**
 * Get student dashboard data - complete overview for homepage
 */
export async function getStudentDashboardData(
    ctx: QueryCtx,
    studentId: Id<"users">
) {
    const student = await ctx.db.get(studentId);
    if (!student?.studentProfile) return null;

    const program = await ctx.db.get(student.studentProfile.programId);
    if (!program) return null;

    // Get current period
    const currentPeriod = await getCurrentPeriod(ctx);

    // Calculate progress
    const progress = await calculateStudentProgress(ctx, studentId);

    // Calculate pending courses
    const pendingCourses = await calculatePendingCourses(ctx, studentId);

    // Get current enrollments
    const currentEnrollments = currentPeriod ? await ctx.db
        .query("enrollments")
        .withIndex("by_student_period", (q) =>
            q.eq("studentId", studentId).eq("periodId", currentPeriod._id)
        )
        .collect() : [];

    // Get current courses with details
    const currentCoursesWithDetails = [];
    for (const enrollment of currentEnrollments) {
        const course = await ctx.db.get(enrollment.courseId);
        const section = await ctx.db.get(enrollment.sectionId);
        const professor = section ? await ctx.db.get(section.professorId) : null;

        currentCoursesWithDetails.push({
            enrollment,
            course,
            section,
            professor,
            period: currentPeriod
        });
    }

    // Calculate cumulative GPA
    const cumulativeGPA = await calculateGPA(ctx, studentId);

    return {
        student,
        program,
        currentPeriod,
        progress,
        pendingCourses,
        currentEnrollments: currentCoursesWithDetails,
        cumulativeGPA
    };
}

/**
 * Get professor dashboard data - complete overview for homepage
 */
export async function getProfessorDashboardData(
    ctx: QueryCtx,
    professorId: Id<"users">
) {
    const professor = await ctx.db.get(professorId);
    if (!professor?.professorProfile) return null;

    // Get current period
    const currentPeriod = await getCurrentPeriod(ctx);
    if (!currentPeriod) return null;

    // Get current sections
    const currentSections = await ctx.db
        .query("sections")
        .withIndex("by_professor_period", (q) =>
            q.eq("professorId", professorId).eq("periodId", currentPeriod._id)
        )
        .collect();

    // Get sections with details
    const sectionsWithDetails = [];
    let totalStudents = 0;
    let pendingGrades = 0;

    for (const section of currentSections) {
        const course = await ctx.db.get(section.courseId);
        const enrollments = await ctx.db
            .query("enrollments")
            .withIndex("by_section", (q) => q.eq("sectionId", section._id))
            .collect();

        const students = [];
        for (const enrollment of enrollments) {
            const student = await ctx.db.get(enrollment.studentId);
            if (student) {
                students.push({
                    student,
                    enrollment,
                    currentGrade: enrollment.percentageGrade,
                    status: enrollment.status
                });

                if (enrollment.percentageGrade === null || enrollment.percentageGrade === undefined) {
                    pendingGrades++;
                }
            }
        }

        totalStudents += students.length;

        sectionsWithDetails.push({
            section,
            course,
            period: currentPeriod,
            students,
            enrolledCount: students.length,
            availableSlots: section.capacity - section.enrolled,
            gradesSubmitted: section.gradesSubmitted
        });
    }

    return {
        professor,
        currentPeriod,
        classes: sectionsWithDetails,
        totalStudents,
        pendingGrades
    };
}

/**
 * Get admin dashboard data - complete overview for homepage
 */
export async function getAdminDashboardData(ctx: QueryCtx) {
    // Get current period
    const currentPeriod = await getCurrentPeriod(ctx);

    // Count active professors
    const activeProfessors = await ctx.db
        .query("users")
        .filter((q) =>
            q.and(
                q.eq(q.field("role"), "professor"),
                q.eq(q.field("isActive"), true)
            )
        )
        .collect();

    // Count active students
    const activeStudents = await ctx.db
        .query("users")
        .filter((q) =>
            q.and(
                q.eq(q.field("role"), "student"),
                q.eq(q.field("isActive"), true)
            )
        )
        .collect();

    // Count active programs
    const activePrograms = await ctx.db
        .query("programs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

    // Count active courses in current period
    const activeCourses = currentPeriod ? await ctx.db
        .query("sections")
        .withIndex("by_period_status", (q) =>
            q.eq("periodId", currentPeriod._id).eq("status", "active")
        )
        .collect() : [];

    return {
        currentPeriod,
        activeProfessorsCount: activeProfessors.length,
        activeStudentsCount: activeStudents.length,
        activeProgramsCount: activePrograms.length,
        activeCoursesCount: activeCourses.length,

        // Recent activities could be added here
        recentEnrollments: [], // TODO: implement if needed
        upcomingDeadlines: []  // TODO: implement if needed
    };
}
