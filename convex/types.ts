import { v, Infer } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// REUSABLE VALIDATORS
// ============================================================================

export const programTypeValidator = v.union(
    v.literal("diploma program"),
    v.literal("bachelor's degree"),
    v.literal("master's degree"),
    v.literal("doctorate")
);

export const userRoleValidator = v.union(
    v.literal("student"),
    v.literal("professor"),
    v.literal("admin")
);

export const studentStatusValidator = v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("graduated")
);

export const enrollmentStatusValidator = v.union(
    v.literal("enrolled"),
    v.literal("dropped"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("incomplete")
);

export const courseAreaValidator = v.union(
    v.literal("core"),
    v.literal("elective"),
    v.literal("general")
);

export const semesterPeriodValidator = v.union(
    v.literal("I"),
    v.literal("II"),
    v.literal("summer")
);

export const semesterStatusValidator = v.union(
    v.literal("planning"),
    v.literal("enrollment"),
    v.literal("active"),
    v.literal("finished")
);

export const sectionStatusValidator = v.union(
    v.literal("draft"),
    v.literal("open"),
    v.literal("closed"),
    v.literal("active"),
    v.literal("finished")
);

export const activityCategoryValidator = v.union(
    v.literal("exam"),
    v.literal("quiz"),
    v.literal("lab"),
    v.literal("assignment"),
    v.literal("project")
);

// ============================================================================
// SCHEDULE VALIDATORS
// ============================================================================

export const scheduleSlotValidator = v.object({
    day: v.number(), // 0-6 (Sunday to Saturday)
    startTime: v.string(), // "14:00"
    endTime: v.string(), // "16:00"
    room: v.string(), // "A-101", "Virtual", "Lab-203"
});

export const gradeWeightsValidator = v.object({
    exams: v.number(),
    assignments: v.number(),
    final: v.number(),
    other: v.number(),
});

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type ProgramType = Infer<typeof programTypeValidator>;
export type UserRole = Infer<typeof userRoleValidator>;
export type StudentStatus = Infer<typeof studentStatusValidator>;
export type EnrollmentStatus = Infer<typeof enrollmentStatusValidator>;
export type CourseArea = Infer<typeof courseAreaValidator>;
export type SemesterPeriod = Infer<typeof semesterPeriodValidator>;
export type SemesterStatus = Infer<typeof semesterStatusValidator>;
export type SectionStatus = Infer<typeof sectionStatusValidator>;
export type ActivityCategory = Infer<typeof activityCategoryValidator>;
export type ScheduleSlot = Infer<typeof scheduleSlotValidator>;
export type GradeWeights = Infer<typeof gradeWeightsValidator>;

// ============================================================================
// COMPLEX TYPES - ACADEMIC PROGRESS
// ============================================================================

export interface StudentProgress {
    totalCredits: number;
    coreCredits: number;
    electiveCredits: number;
    generalCredits: number;
    requiredCredits: number;
    completionPercentage: number;
    program: Doc<"programs"> | null;
}

export interface EnrollmentWithDetails {
    enrollment: Doc<"enrollments">;
    course: Doc<"courses"> | null;
    section: Doc<"sections"> | null;
}

export interface SectionWithDetails {
    section: Doc<"sections">;
    course: Doc<"courses"> | null;
    enrollments: Doc<"enrollments">[];
    enrolledCount: number;
}

export interface CourseWithPrerequisites {
    course: Doc<"courses">;
    prerequisites: Doc<"courses">[];
    missingPrerequisites?: string[];
}

export interface SemesterSummary {
    semester: Doc<"semesters">;
    enrollments: EnrollmentWithDetails[];
    creditsEnrolled: number;
    averageGrade: number;
    status: "in-progress" | "completed";
}

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

export interface StudentProfileInput {
    studentCode: string;
    programId: Id<"programs">;
    enrollmentYear: number;
    status: StudentStatus;
    showProfile: boolean;
    showCourses: boolean;
    showGrades: boolean;
}

export interface ProfessorProfileInput {
    employeeCode: string;
    department: string;
    title?: string;
}

export interface UserWithProgram {
    user: Doc<"users">;
    program: Doc<"programs"> | null;
}

export interface StudentWithDetails {
    user: Doc<"users">;
    program: Doc<"programs"> | null;
    progress: StudentProgress | null;
    currentSemester: Doc<"semesters"> | null;
    gpa: number;
}

// ============================================================================
// GRADE CALCULATION TYPES
// ============================================================================

export interface ActivityGrade {
    activity: Doc<"activities">;
    grade: Doc<"grades"> | null;
    score: number | null;
    maxPoints: number;
    weight: number;
    category: ActivityCategory;
}

export interface GradeBreakdown {
    activities: ActivityGrade[];
    currentGrade: number;
    projectedGrade: number; // Based on completed work
    gradeWeights: GradeWeights;
}

export interface CourseGradeSummary {
    courseCode: string;
    courseName: string;
    currentGrade: number;
    finalGrade: number | null;
    letterGrade: string | null;
    credits: number;
    status: EnrollmentStatus;
}

// ============================================================================
// ENROLLMENT TYPES
// ============================================================================

export interface EnrollmentRequest {
    studentId: Id<"users">;
    sectionId: Id<"sections">;
    semesterId: Id<"semesters">;
    courseId: Id<"courses">;
}

export interface EnrollmentValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface SectionAvailability {
    section: Doc<"sections">;
    available: boolean;
    capacity: number;
    enrolled: number;
    waitlistAvailable: boolean;
}

// ============================================================================
// ANNOUNCEMENT TYPES
// ============================================================================

export interface AnnouncementWithAuthor {
    announcement: Doc<"announcements">;
    author: Doc<"users"> | null;
    section: Doc<"sections"> | null;
    course: Doc<"courses"> | null;
}

// ============================================================================
// ACCESS CONTROL TYPES (UPDATED FOR NEW SCHEMA)
// ============================================================================

/**
 * Simplified access list entry (whitelist only)
 */
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

/**
 * Enriched access list entry with creator info
 */
export interface AccessListEntryWithCreator {
    entry: Doc<"accessList">;
    creator: Doc<"users"> | null;
    isExpired: boolean;
}

/**
 * User template with complete pre-registration data
 */
export interface UserTemplate {
    _id: Id<"userTemplates">;
    email: string;
    name: string;
    phone?: string;
    country?: string;
    city?: string;

    // Student-specific
    programId?: Id<"programs">;
    studentCode?: string;
    enrollmentYear?: number;

    // Professor-specific
    department?: string;
    employeeCode?: string;
    title?: string;

    createdBy: Id<"users">;
    createdAt: number;
}

/**
 * Enriched user template with program info
 */
export interface UserTemplateWithProgram {
    template: Doc<"userTemplates">;
    program: Doc<"programs"> | null;
    creator: Doc<"users"> | null;
}

/**
 * Pre-registration input for students
 */
export interface PreRegisterStudentInput {
    email: string;
    name: string;
    studentCode: string;
    programId: Id<"programs">;
    enrollmentYear: number;
    phone?: string;
    country?: string;
    city?: string;
    expiresInDays?: number;
}

/**
 * Pre-registration input for professors
 */
export interface PreRegisterProfessorInput {
    email: string;
    name: string;
    employeeCode: string;
    department: string;
    title?: string;
    phone?: string;
    country?: string;
    city?: string;
    expiresInDays?: number;
}

/**
 * Registration result
 */
export interface RegistrationResult {
    userId: Id<"users">;
    isNewUser: boolean;
    role: UserRole;
}

// ============================================================================
// AUTHENTICATED USER TYPES
// ============================================================================

export interface AuthenticatedUser {
    user: Doc<"users">;
    isAdmin: boolean;
    isProfessor: boolean;
    isStudent: boolean;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

export interface CourseSearchFilters {
    programId?: Id<"programs">;
    area?: CourseArea;
    semesterId?: Id<"semesters">;
    professorId?: Id<"users">;
    searchTerm?: string;
    onlyAvailable?: boolean;
}

export interface StudentSearchFilters {
    programId?: Id<"programs">;
    status?: StudentStatus;
    enrollmentYear?: number;
    searchTerm?: string;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface CourseStatistics {
    totalEnrolled: number;
    averageGrade: number;
    passRate: number;
    dropRate: number;
    gradeDistribution: {
        A: number;
        B: number;
        C: number;
        D: number;
        F: number;
    };
}

export interface ProgramStatistics {
    totalStudents: number;
    activeStudents: number;
    graduatedStudents: number;
    averageGPA: number;
    averageCompletionTime: number; // in semesters
    completionRate: number;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
    cursor: string | null;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount?: number;
}

// ============================================================================
// BULK OPERATION TYPES
// ============================================================================

/**
 * Result of bulk pre-registration
 */
export interface BulkPreRegistrationResult {
    successful: string[];
    failed: {
        email: string;
        reason: string;
    }[];
    totalProcessed: number;
    successCount: number;
    failCount: number;
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
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',

    // Business logic
    INVALID_GRADE_WEIGHTS: 'INVALID_GRADE_WEIGHTS',
    ENROLLMENT_CLOSED: 'ENROLLMENT_CLOSED',
    SEMESTER_NOT_ACTIVE: 'SEMESTER_NOT_ACTIVE',
    REGISTRATION_EXPIRED: 'REGISTRATION_EXPIRED',
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