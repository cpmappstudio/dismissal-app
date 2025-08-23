import { v, Infer } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// REUSABLE VALIDATORS
// ============================================================================

export const programTypeValidator = v.union(
    v.literal("diploma"),
    v.literal("bachelor"),
    v.literal("master"),
    v.literal("doctorate")
);

export const userRoleValidator = v.union(
    v.literal("student"),
    v.literal("professor"),
    v.literal("admin"),
    v.literal("superadmin")
);

export const studentStatusValidator = v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("graduated")
);

export const enrollmentStatusValidator = v.union(
    v.literal("enrolled"),
    v.literal("cancelled"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("withdrawn")
);

export const courseCategoryValidator = v.union(
    v.literal("humanities"),
    v.literal("core"),      // Troncales
    v.literal("elective"),
    v.literal("general")
);

export const periodTypeValidator = v.union(
    v.literal("regular"),
    v.literal("intensive"),
    v.literal("special")
);

export const periodStatusValidator = v.union(
    v.literal("planning"),
    v.literal("enrollment"),
    v.literal("active"),
    v.literal("grading"),
    v.literal("closed")
);

export const sectionStatusValidator = v.union(
    v.literal("open"),
    v.literal("active"),
    v.literal("grading"),
    v.literal("closed")
);

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type ProgramType = Infer<typeof programTypeValidator>;
export type UserRole = Infer<typeof userRoleValidator>;
export type StudentStatus = Infer<typeof studentStatusValidator>;
export type EnrollmentStatus = Infer<typeof enrollmentStatusValidator>;
export type CourseCategory = Infer<typeof courseCategoryValidator>;
export type PeriodType = Infer<typeof periodTypeValidator>;
export type PeriodStatus = Infer<typeof periodStatusValidator>;
export type SectionStatus = Infer<typeof sectionStatusValidator>;

// ============================================================================
// ACADEMIC PROGRESS TYPES
// ============================================================================

/**
 * Student progress tracking for the 40-60-20 credit requirement
 */
export interface StudentProgress {
    // Current credits by category
    humanitiesCredits: number;      // Current / 40 required
    coreCredits: number;            // Current / 60 required  
    electiveCredits: number;        // Current / 20 required
    totalCredits: number;           // Current / 120 total

    // Required credits from program_requirements
    requiredHumanities: number;     // 40
    requiredCore: number;           // 60
    requiredElective: number;       // 20
    requiredTotal: number;          // 120

    // Progress percentages
    humanitiesProgress: number;     // percentage
    coreProgress: number;           // percentage
    electiveProgress: number;       // percentage
    overallProgress: number;        // percentage

    program: Doc<"programs"> | null;
}

/**
 * Enrollment with full details for transcript generation
 */
export interface EnrollmentWithDetails {
    enrollment: Doc<"enrollments">;
    course: Doc<"courses"> | null;
    section: Doc<"sections"> | null;
    professor: Doc<"users"> | null;
    period: Doc<"periods"> | null;
}

/**
 * Section with course and professor details
 */
export interface SectionWithDetails {
    section: Doc<"sections">;
    course: Doc<"courses"> | null;
    professor: Doc<"users"> | null;
    enrolledCount: number;
    availableSlots: number;
}

/**
 * Course with prerequisites for validation
 */
export interface CourseWithPrerequisites {
    course: Doc<"courses">;
    prerequisites: Doc<"courses">[];
    canEnroll: boolean;
    missingPrerequisites?: string[];
}

/**
 * Period summary for student view
 */
export interface PeriodSummary {
    period: Doc<"periods">;
    enrollments: EnrollmentWithDetails[];

    // Period metrics
    creditsEnrolled: number;
    creditsApproved: number;
    creditPercentage: number;
    periodGPA: number;

    // Cumulative metrics (up to this period)
    cumulativeCredits: number;
    cumulativeGPA: number;

    // Ranking (calculated dynamically)
    classRank?: number;
    totalStudents?: number;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface StudentProfileInput {
    studentCode: string;
    programId: Id<"programs">;
    enrollmentDate: number;
    status: StudentStatus;
}

export interface ProfessorProfileInput {
    employeeCode: string;
    title?: string;
}

export interface UserWithProgram {
    user: Doc<"users">;
    program: Doc<"programs"> | null;
}

export interface StudentWithDetails {
    user: Doc<"users">;
    program: Doc<"programs"> | null;
    progress: StudentProgress;
    currentPeriod: Doc<"periods"> | null;
    cumulativeGPA: number;
    totalCredits: number;
}

// ============================================================================
// GRADE TYPES (Simplified - no activities)
// ============================================================================

/**
 * Grade summary for a course
 */
export interface CourseGradeSummary {
    courseCode: string;
    courseName: string;
    groupNumber: string;           // GRUPO
    category: CourseCategory;       // FUN
    credits: number;               // CRD
    finalGrade: number | null;     // CAL
    makeupGrade: number | null;    // HAB
    effectiveGrade: number | null; // Grade that counts
    letterGrade: string | null;
    status: EnrollmentStatus;

    // Cancellation info
    cancellationDate?: number;
    reactivationDate?: number;
}

/**
 * Transcript data for a period
 */
export interface TranscriptPeriod {
    period: Doc<"periods">;
    courses: CourseGradeSummary[];

    // Summary for period
    creditsAttempted: number;
    creditsEarned: number;
    periodGPA: number;

    // Ranking
    classRank?: number;
    totalStudents?: number;
}

/**
 * Complete transcript for student
 */
export interface StudentTranscript {
    student: Doc<"users">;
    program: Doc<"programs">;

    // Academic record by period
    periods: TranscriptPeriod[];

    // Overall summary
    totalCreditsAttempted: number;
    totalCreditsEarned: number;
    cumulativeGPA: number;

    // Progress by category
    humanitiesCredits: number;
    coreCredits: number;
    electiveCredits: number;

    // Status
    academicStatus: StudentStatus;
    generatedAt: number;
}

// ============================================================================
// ENROLLMENT TYPES
// ============================================================================

export interface EnrollmentRequest {
    studentId: Id<"users">;
    sectionId: Id<"sections">;
}

export interface EnrollmentValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface SectionAvailability {
    section: Doc<"sections">;
    course: Doc<"courses">;
    professor: Doc<"users">;
    available: boolean;
    capacity: number;
    enrolled: number;
    scheduleNote?: string;
}

// ============================================================================
// PENDING COURSES (Pensum faltante)
// ============================================================================

/**
 * Courses pending to complete program
 */
export interface PendingCourses {
    // By category
    humanitiesPending: Doc<"courses">[];
    corePending: Doc<"courses">[];
    electivePending: Doc<"courses">[];

    // Credits needed
    humanitiesNeeded: number;
    coreNeeded: number;
    electiveNeeded: number;
    totalNeeded: number;

    // Can take now (prerequisites met)
    availableNow: Doc<"courses">[];

    // Blocked by prerequisites
    blockedCourses: Array<{
        course: Doc<"courses">;
        missingPrerequisites: string[];
    }>;
}

// ============================================================================
// ACCESS CONTROL TYPES
// ============================================================================

export interface AccessListEntry {
    _id: Id<"accessList">;
    email: string;
    role: UserRole;
    createdBy: Id<"users">;
    createdAt: number;
    expiresAt?: number;
    isUsed: boolean;
    usedAt?: number;
    usedBy?: Id<"users">;
}

export interface UserTemplate {
    _id: Id<"userTemplates">;
    email: string;
    name: string;

    // Student-specific
    programId?: Id<"programs">;
    studentCode?: string;

    // Professor-specific
    employeeCode?: string;

    createdBy: Id<"users">;
    createdAt: number;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

export interface CourseSearchFilters {
    programId?: Id<"programs">;
    category?: CourseCategory;
    periodId?: Id<"periods">;
    searchTerm?: string;
    includeCompleted?: boolean;
}

export interface StudentSearchFilters {
    programId?: Id<"programs">;
    status?: StudentStatus;
    searchTerm?: string;
}

export interface SectionSearchFilters {
    periodId: Id<"periods">;
    courseCategory?: CourseCategory;
    professorId?: Id<"users">;
    onlyAvailable?: boolean;
}

// ============================================================================
// PROFESSOR VIEW TYPES
// ============================================================================

/**
 * Professor's class for grade submission
 */
export interface ProfessorClass {
    section: Doc<"sections">;
    course: Doc<"courses">;
    period: Doc<"periods">;
    students: Array<{
        student: Doc<"users">;
        enrollment: Doc<"enrollments">;
        currentGrade: number | null;
        makeupGrade: number | null;
        status: EnrollmentStatus;
    }>;
    scheduleNote?: string;
    gradesSubmitted: boolean;
}

/**
 * Professor's period overview
 */
export interface ProfessorPeriodView {
    period: Doc<"periods">;
    classes: ProfessorClass[];
    totalStudents: number;
    pendingGrades: number;
}

// ============================================================================
// STATISTICS TYPES (Simplified)
// ============================================================================

export interface ProgramStatistics {
    totalStudents: number;
    activeStudents: number;
    graduatedStudents: number;
    averageGPA: number;
    averageCredits: number;
}

export interface PeriodStatistics {
    period: Doc<"periods">;
    totalEnrollments: number;
    averageGPA: number;
    completionRate: number;
    dropRate: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 400
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export const ErrorCodes = {
    // Authentication
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    UNAUTHORIZED: 'UNAUTHORIZED',

    // Validation
    INVALID_INPUT: 'INVALID_INPUT',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

    // Enrollment
    ALREADY_ENROLLED: 'ALREADY_ENROLLED',
    SECTION_FULL: 'SECTION_FULL',
    PREREQUISITES_NOT_MET: 'PREREQUISITES_NOT_MET',

    // Not found
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
    SECTION_NOT_FOUND: 'SECTION_NOT_FOUND',
    PERIOD_NOT_FOUND: 'PERIOD_NOT_FOUND',
    PROGRAM_NOT_FOUND: 'PROGRAM_NOT_FOUND',

    // Business logic
    ENROLLMENT_CLOSED: 'ENROLLMENT_CLOSED',
    PERIOD_NOT_ACTIVE: 'PERIOD_NOT_ACTIVE',
    GRADES_ALREADY_SUBMITTED: 'GRADES_ALREADY_SUBMITTED',
} as const;

// ============================================================================
// UTILITY TYPE HELPERS
// ============================================================================

export type WithoutSystemFields<T> = Omit<T, "_id" | "_creationTime">;

export type CreateInput<T> = WithoutSystemFields<T>;

export type UpdateInput<T> = Partial<WithoutSystemFields<T>>;

export type RequireAtLeastOne<T> = {
    [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

// ============================================================================
// CLERK RBAC INTEGRATION
// ============================================================================

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: UserRole;
        }
    }
}