// ################################################################################
// # File: helpers.ts                                                            # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * ALEF UNIVERSITY: Business Logic Helpers
 * 
 * Following Convex best practices:
 * - Pure TypeScript functions for business logic
 * - Reusable across queries, mutations, and actions
 * - Type-safe with proper context typing
 * - No direct exports of query/mutation/action from this file
 * 
 * Organized by domain:
 * 1. Grade calculations (American system)
 * 2. Enrollment validation
 * 3. Academic progress tracking
 * 4. User data access
 * 5. Period and scheduling
 * 6. Document generation helpers
 */

import { QueryCtx, MutationCtx, DatabaseReader, DatabaseWriter } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import type {
    GradeInfo,
    GradeSummary,
    AcademicProgress,
    PrerequisiteValidation,
    EnrollmentValidation,
    CourseCategory,
    GRADE_SCALE,
    EnrollmentWithDetails,
    PeriodSummary,
    GraduationValidation,
} from "./types";

// Type aliases for cleaner function signatures
type DbReader = QueryCtx["db"] | DatabaseReader;
type DbWriter = MutationCtx["db"] | DatabaseWriter;

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
 * Calculate complete grade info from percentage
 */
export function calculateGradeInfo(percentageGrade: number, credits: number): GradeInfo {
    const letterGrade = calculateLetterGrade(percentageGrade);
    const gradePoints = calculateGradePoints(percentageGrade);
    const qualityPoints = calculateQualityPoints(gradePoints, credits);
    const isPassing = isPassingGrade(percentageGrade);

    return {
        percentageGrade,
        letterGrade,
        gradePoints,
        qualityPoints,
        isPassing,
    };
}

/**
 * Calculate GPA for a set of enrollments
 */
export async function calculateGPA(
    db: DbReader,
    enrollments: Doc<"enrollments">[]
): Promise<GradeSummary> {
    let totalCredits = 0;
    let attemptedCredits = 0;
    let earnedCredits = 0;
    let totalQualityPoints = 0;

    for (const enrollment of enrollments) {
        // Skip enrollments that don't count for GPA
        if (!enrollment.countsForGPA || enrollment.isAuditing) continue;

        const course = await db.get(enrollment.courseId);
        if (!course) continue;

        attemptedCredits += course.credits;

        if (enrollment.percentageGrade !== undefined && enrollment.percentageGrade !== null) {
            totalCredits += course.credits;

            const gradePoints = calculateGradePoints(enrollment.percentageGrade);
            totalQualityPoints += calculateQualityPoints(gradePoints, course.credits);

            if (isPassingGrade(enrollment.percentageGrade)) {
                earnedCredits += course.credits;
            }
        }
    }

    const gpa = totalCredits > 0 ? totalQualityPoints / totalCredits : 0;

    return {
        totalCredits,
        attemptedCredits,
        earnedCredits,
        gradePoints: totalQualityPoints,
        gpa: Math.round(gpa * 100) / 100, // Round to 2 decimal places
    };
}

// ============================================================================
// ENROLLMENT VALIDATION HELPERS
// ============================================================================

/**
 * Check if student has completed prerequisites for a course
 */
export async function validatePrerequisites(
    db: DbReader,
    studentId: Id<"users">,
    courseId: Id<"courses">
): Promise<PrerequisiteValidation> {
    const course = await db.get(courseId);
    if (!course || !course.prerequisites.length) {
        return { isValid: true, missingPrerequisites: [], completedPrerequisites: [] };
    }

    // Get all completed enrollments for the student
    const completedEnrollments = await db
        .query("enrollments")
        .withIndex("by_student_course", q => q.eq("studentId", studentId))
        .filter(q => q.eq(q.field("status"), "completed"))
        .collect();

    // Build set of completed course codes
    const completedCourseCodes = new Set<string>();
    for (const enrollment of completedEnrollments) {
        if (enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
            const completedCourse = await db.get(enrollment.courseId);
            if (completedCourse) {
                completedCourseCodes.add(completedCourse.code);
            }
        }
    }

    const missingPrerequisites = course.prerequisites.filter(
        code => !completedCourseCodes.has(code)
    );

    const completedPrerequisites = course.prerequisites.filter(
        code => completedCourseCodes.has(code)
    );

    return {
        isValid: missingPrerequisites.length === 0,
        missingPrerequisites,
        completedPrerequisites,
    };
}

/**
 * Validate if student can enroll in a section
 */
export async function validateEnrollment(
    db: DbReader,
    studentId: Id<"users">,
    sectionId: Id<"sections">
): Promise<EnrollmentValidation> {
    const reasons: string[] = [];
    const warnings: string[] = [];

    const section = await db.get(sectionId);
    if (!section) {
        return {
            canEnroll: false,
            reasons: ["Section not found"],
            warnings: [],
        };
    }

    // Check if section is open for enrollment
    if (section.status !== "open") {
        reasons.push("Section is not open for enrollment");
    }

    // Check capacity
    if (section.enrolled >= section.capacity) {
        reasons.push("Section is full");
    }

    // Check if already enrolled
    const existingEnrollment = await db
        .query("enrollments")
        .withIndex("by_student_section", q =>
            q.eq("studentId", studentId).eq("sectionId", sectionId)
        )
        .filter(q => q.neq(q.field("status"), "withdrawn"))
        .first();

    if (existingEnrollment) {
        reasons.push("Already enrolled in this section");
    }

    // Check prerequisites
    const prerequisiteCheck = await validatePrerequisites(db, studentId, section.courseId);
    if (!prerequisiteCheck.isValid) {
        reasons.push(`Missing prerequisites: ${prerequisiteCheck.missingPrerequisites.join(", ")}`);
    }

    // Check for time conflicts (warning only)
    const period = await db.get(section.periodId);
    if (period && period.status === "enrollment") {
        const otherEnrollments = await db
            .query("enrollments")
            .withIndex("by_student_period", q =>
                q.eq("studentId", studentId).eq("periodId", section.periodId)
            )
            .filter(q => q.eq(q.field("status"), "enrolled"))
            .collect();

        if (otherEnrollments.length >= 6) {
            warnings.push("You are enrolling in more than 6 courses this period");
        }
    }

    return {
        canEnroll: reasons.length === 0,
        reasons,
        warnings,
    };
}

// ============================================================================
// ACADEMIC PROGRESS HELPERS
// ============================================================================

/**
 * Calculate student's academic progress
 */
export async function calculateAcademicProgress(
    db: DbReader,
    studentId: Id<"users">
): Promise<AcademicProgress | null> {
    const user = await db.get(studentId);
    if (!user || !user.studentProfile) return null;

    const programId = user.studentProfile.programId;
    const program = await db.get(programId);
    if (!program) return null;

    // Get program requirements
    const requirements = await db
        .query("program_requirements")
        .withIndex("by_program_active", q =>
            q.eq("programId", programId).eq("isActive", true)
        )
        .first();

    if (!requirements) return null;

    // Get all enrollments
    const allEnrollments = await db
        .query("enrollments")
        .withIndex("by_student_course", q => q.eq("studentId", studentId))
        .collect();

    // Calculate credits by category
    const creditsByCategory = {
        humanities: { required: requirements.requirements.humanities.required, completed: 0 },
        core: { required: requirements.requirements.core.required, completed: 0 },
        elective: { required: requirements.requirements.elective.required, completed: 0 },
        general: { required: requirements.requirements.general.required, completed: 0 },
    };

    const completedEnrollments: Doc<"enrollments">[] = [];
    const inProgressEnrollments: Doc<"enrollments">[] = [];

    for (const enrollment of allEnrollments) {
        if (enrollment.status === "completed" && enrollment.percentageGrade && enrollment.percentageGrade >= 65) {
            completedEnrollments.push(enrollment);

            const course = await db.get(enrollment.courseId);
            if (course && enrollment.countsForProgress) {
                // Check if there's a category override for this program
                const programCourse = await db
                    .query("program_courses")
                    .withIndex("by_program_course", q =>
                        q.eq("programId", programId).eq("courseId", course._id)
                    )
                    .first();

                const category = programCourse?.categoryOverride || course.category;
                creditsByCategory[category].completed += course.credits;
            }
        } else if (enrollment.status === "enrolled" || enrollment.status === "in_progress") {
            inProgressEnrollments.push(enrollment);
        }
    }

    // Calculate GPA
    const gradeSummary = await calculateGPA(db, completedEnrollments);

    // Calculate total credits completed
    const creditsCompleted = Object.values(creditsByCategory).reduce(
        (sum, cat) => sum + cat.completed,
        0
    );

    // Determine academic standing
    let academicStanding: "good_standing" | "probation" | "suspension" = "good_standing";
    if (gradeSummary.gpa < (requirements.suspensionGPA || 1.0)) {
        academicStanding = "suspension";
    } else if (gradeSummary.gpa < (requirements.probationGPA || 2.0)) {
        academicStanding = "probation";
    }

    const completionPercentage = Math.round((creditsCompleted / program.totalCredits) * 100);

    return {
        programId,
        totalCreditsRequired: program.totalCredits,
        creditsCompleted,
        creditsByCategory,
        gpa: gradeSummary.gpa,
        cgpa: gradeSummary.gpa, // Same as GPA for now
        academicStanding,
        completionPercentage,
        estimatedGraduationDate: undefined, // Could calculate based on current pace
    };
}

/**
 * Check if student meets graduation requirements
 */
export async function validateGraduationRequirements(
    db: DbReader,
    studentId: Id<"users">
): Promise<GraduationValidation | null> {
    const progress = await calculateAcademicProgress(db, studentId);
    if (!progress) return null;

    const user = await db.get(studentId);
    if (!user || !user.studentProfile) return null;

    const requirements = await db
        .query("program_requirements")
        .withIndex("by_program_active", q =>
            q.eq("programId", user.studentProfile!.programId).eq("isActive", true)
        )
        .first();

    if (!requirements) return null;

    const categoryRequirements = Object.entries(progress.creditsByCategory).map(
        ([category, credits]) => ({
            category: category as CourseCategory,
            required: credits.required,
            completed: credits.completed,
            remaining: Math.max(0, credits.required - credits.completed),
        })
    );

    const missingCourses: string[] = [];

    // Check required courses
    const programCourses = await db
        .query("program_courses")
        .withIndex("by_program_required", q =>
            q.eq("programId", user.studentProfile!.programId)
                .eq("isRequired", true)
                .eq("isActive", true)
        )
        .collect();

    for (const pc of programCourses) {
        const course = await db.get(pc.courseId);
        if (!course) continue;

        const completed = await db
            .query("enrollments")
            .withIndex("by_student_course", q =>
                q.eq("studentId", studentId).eq("courseId", course._id)
            )
            .filter(q =>
                q.and(
                    q.eq(q.field("status"), "completed"),
                    q.gte(q.field("percentageGrade"), 65)
                )
            )
            .first();

        if (!completed) {
            missingCourses.push(course.code);
        }
    }

    const isEligible =
        progress.creditsCompleted >= progress.totalCreditsRequired &&
        progress.gpa >= requirements.minGPA &&
        missingCourses.length === 0 &&
        categoryRequirements.every(cat => cat.remaining === 0);

    return {
        isEligible,
        totalCredits: {
            required: progress.totalCreditsRequired,
            completed: progress.creditsCompleted,
        },
        categoryRequirements,
        gpaRequirement: {
            minimum: requirements.minGPA,
            current: progress.gpa,
        },
        missingCourses,
    };
}

// ============================================================================
// USER DATA ACCESS HELPERS
// ============================================================================

/**
 * Get user by clerk ID
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
 * Get active students count
 */
export async function getActiveStudentsCount(db: DbReader): Promise<number> {
    const students = await db
        .query("users")
        .withIndex("by_role_active", q =>
            q.eq("role", "student").eq("isActive", true)
        )
        .collect();
    return students.length;
}

/**
 * Get active professors count
 */
export async function getActiveProfessorsCount(db: DbReader): Promise<number> {
    const professors = await db
        .query("users")
        .withIndex("by_role_active", q =>
            q.eq("role", "professor").eq("isActive", true)
        )
        .collect();
    return professors.length;
}

// ============================================================================
// PERIOD AND SCHEDULING HELPERS
// ============================================================================

/**
 * Get current academic period
 */
export async function getCurrentPeriod(db: DbReader): Promise<Doc<"periods"> | null> {
    return await db
        .query("periods")
        .withIndex("by_current", q => q.eq("isCurrentPeriod", true))
        .first();
}

/**
 * Get periods by year
 */
export async function getPeriodsByYear(
    db: DbReader,
    year: number
): Promise<Doc<"periods">[]> {
    return await db
        .query("periods")
        .withIndex("by_year_bimester", q => q.eq("year", year))
        .collect();
}

/**
 * Check if enrollment is open for a period
 */
export function isEnrollmentOpen(period: Doc<"periods">): boolean {
    const now = Date.now();
    return period.status === "enrollment" ||
        (now >= period.enrollmentStart && now <= period.enrollmentEnd);
}

/**
 * Check if grading is open for a period
 */
export function isGradingOpen(period: Doc<"periods">): boolean {
    const now = Date.now();
    return period.status === "grading" ||
        (period.gradingStart !== undefined &&
            now >= period.gradingStart &&
            now <= period.gradingDeadline);
}

// ============================================================================
// SECTION HELPERS
// ============================================================================

/**
 * Get available seats in a section
 */
export function getAvailableSeats(section: Doc<"sections">): number {
    return Math.max(0, section.capacity - section.enrolled);
}

/**
 * Check if section has available capacity
 */
export function hasAvailableCapacity(section: Doc<"sections">): boolean {
    return section.enrolled < section.capacity;
}

/**
 * Get sections for a professor in a period
 */
export async function getProfessorSections(
    db: DbReader,
    professorId: Id<"users">,
    periodId: Id<"periods">
): Promise<Doc<"sections">[]> {
    return await db
        .query("sections")
        .withIndex("by_professor_period", q =>
            q.eq("professorId", professorId)
                .eq("periodId", periodId)
                .eq("isActive", true)
        )
        .collect();
}

// ============================================================================
// ENROLLMENT DETAIL HELPERS
// ============================================================================

/**
 * Get enrollment with full details
 */
export async function getEnrollmentWithDetails(
    db: DbReader,
    enrollment: Doc<"enrollments">
): Promise<EnrollmentWithDetails | null> {
    const [section, course, professor, period] = await Promise.all([
        db.get(enrollment.sectionId),
        db.get(enrollment.courseId),
        db.get(enrollment.professorId),
        db.get(enrollment.periodId),
    ]);

    if (!section || !course || !professor || !period) return null;

    return {
        enrollment,
        section,
        course,
        professor: {
            _id: professor._id,
            firstName: professor.firstName,
            lastName: professor.lastName,
            email: professor.email,
            role: professor.role,
        },
        period,
    };
}

/**
 * Get student's enrollments for a period
 */
export async function getStudentEnrollmentsByPeriod(
    db: DbReader,
    studentId: Id<"users">,
    periodId: Id<"periods">
): Promise<Doc<"enrollments">[]> {
    return await db
        .query("enrollments")
        .withIndex("by_student_period", q =>
            q.eq("studentId", studentId).eq("periodId", periodId)
        )
        .collect();
}

/**
 * Get academic history organized by periods
 */
export async function getAcademicHistory(
    db: DbReader,
    studentId: Id<"users">
): Promise<PeriodSummary[]> {
    // Get all enrollments
    const allEnrollments = await db
        .query("enrollments")
        .withIndex("by_student_course", q => q.eq("studentId", studentId))
        .collect();

    // Group by period
    const enrollmentsByPeriod = new Map<Id<"periods">, Doc<"enrollments">[]>();
    for (const enrollment of allEnrollments) {
        const periodEnrollments = enrollmentsByPeriod.get(enrollment.periodId) || [];
        periodEnrollments.push(enrollment);
        enrollmentsByPeriod.set(enrollment.periodId, periodEnrollments);
    }

    // Build period summaries
    const summaries: PeriodSummary[] = [];
    for (const [periodId, enrollments] of enrollmentsByPeriod) {
        const period = await db.get(periodId);
        if (!period) continue;

        const enrollmentDetails: EnrollmentWithDetails[] = [];
        for (const enrollment of enrollments) {
            const details = await getEnrollmentWithDetails(db, enrollment);
            if (details) enrollmentDetails.push(details);
        }

        const summary = await calculateGPA(db, enrollments);

        summaries.push({
            period,
            enrollments: enrollmentDetails,
            summary,
        });
    }

    // Sort by period date
    summaries.sort((a, b) => b.period.startDate - a.period.startDate);

    return summaries;
}

// ============================================================================
// COURSE AND PROGRAM HELPERS
// ============================================================================

/**
 * Get courses for a program
 */
export async function getProgramCourses(
    db: DbReader,
    programId: Id<"programs">
): Promise<Array<{ course: Doc<"courses">; isRequired: boolean; category: CourseCategory }>> {
    const programCourses = await db
        .query("program_courses")
        .withIndex("by_program_course", q => q.eq("programId", programId))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();

    const courses = [];
    for (const pc of programCourses) {
        const course = await db.get(pc.courseId);
        if (course && course.isActive) {
            courses.push({
                course,
                isRequired: pc.isRequired,
                category: (pc.categoryOverride || course.category) as CourseCategory,
            });
        }
    }

    return courses;
}

/**
 * Get active programs count
 */
export async function getActiveProgramsCount(db: DbReader): Promise<number> {
    const programs = await db
        .query("programs")
        .withIndex("by_active", q => q.eq("isActive", true))
        .collect();
    return programs.length;
}

/**
 * Get active courses count
 */
export async function getActiveCoursesCount(db: DbReader): Promise<number> {
    const courses = await db
        .query("courses")
        .withIndex("by_active", q => q.eq("isActive", true))
        .collect();
    return courses.length;
}