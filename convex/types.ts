// ################################################################################
// # File: types.ts                                                              # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * ALEF UNIVERSITY: Shared Types and Validators
 * 
 * This file contains:
 * 1. Reusable validators for common patterns
 * 2. Type utilities for frontend and backend
 * 3. View-specific types for different user roles
 * 4. Form types for data input
 * 5. Response types for API calls
 * 
 * Following Convex best practices:
 * - Use Infer<> to derive types from validators
 * - Export types for frontend consumption
 * - Leverage Doc<> and Id<> from generated types
 * - Use WithoutSystemFields<> for creation types
 */

import { v, Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";

// ============================================================================
// COMMON VALIDATORS (Reusable across schema and functions)
// ============================================================================

/**
 * User role validator
 */
export const roleValidator = v.union(
    v.literal("student"),
    v.literal("professor"),
    v.literal("admin"),
    v.literal("superadmin")
);
export type UserRole = Infer<typeof roleValidator>;

/**
 * Academic program type validator
 */
export const programTypeValidator = v.union(
    v.literal("diploma"),
    v.literal("bachelor"),
    v.literal("master"),
    v.literal("doctorate")
);
export type ProgramType = Infer<typeof programTypeValidator>;

/**
 * Language validator
 */
export const languageValidator = v.union(
    v.literal("es"),
    v.literal("en"),
    v.literal("both")
);
export type Language = Infer<typeof languageValidator>;

/**
 * Course category validator
 */
export const courseCategoryValidator = v.union(
    v.literal("humanities"),
    v.literal("core"),
    v.literal("elective"),
    v.literal("general")
);
export type CourseCategory = Infer<typeof courseCategoryValidator>;

/**
 * Enrollment status validator
 */
export const enrollmentStatusValidator = v.union(
    v.literal("enrolled"),
    v.literal("withdrawn"),
    v.literal("dropped"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("incomplete"),
    v.literal("in_progress")
);
export type EnrollmentStatus = Infer<typeof enrollmentStatusValidator>;

/**
 * Period status validator
 */
export const periodStatusValidator = v.union(
    v.literal("planning"),
    v.literal("enrollment"),
    v.literal("active"),
    v.literal("grading"),
    v.literal("closed")
);
export type PeriodStatus = Infer<typeof periodStatusValidator>;

/**
 * Section status validator
 */
export const sectionStatusValidator = v.union(
    v.literal("draft"),
    v.literal("open"),
    v.literal("closed"),
    v.literal("active"),
    v.literal("grading"),
    v.literal("completed")
);
export type SectionStatus = Infer<typeof sectionStatusValidator>;

/**
 * Student academic standing validator
 */
export const academicStandingValidator = v.union(
    v.literal("good_standing"),
    v.literal("probation"),
    v.literal("suspension")
);
export type AcademicStanding = Infer<typeof academicStandingValidator>;

/**
 * Document type validator
 */
export const documentTypeValidator = v.union(
    v.literal("transcript"),
    v.literal("enrollment_certificate"),
    v.literal("grade_report"),
    v.literal("completion_certificate"),
    v.literal("degree"),
    v.literal("schedule"),
    v.literal("other")
);
export type DocumentType = Infer<typeof documentTypeValidator>;

/**
 * Delivery method validator
 */
export const deliveryMethodValidator = v.union(
    v.literal("online_sync"),
    v.literal("online_async"),
    v.literal("hybrid"),
    v.literal("in_person")
);
export type DeliveryMethod = Infer<typeof deliveryMethodValidator>;

/**
 * Address validator (for reuse in user profile)
 */
export const addressValidator = v.object({
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    country: v.optional(v.string()),
});
export type Address = Infer<typeof addressValidator>;

/**
 * Schedule session validator
 */
export const scheduleSessionValidator = v.object({
    day: v.union(
        v.literal("monday"),
        v.literal("tuesday"),
        v.literal("wednesday"),
        v.literal("thursday"),
        v.literal("friday"),
        v.literal("saturday"),
        v.literal("sunday")
    ),
    startTime: v.string(),
    endTime: v.string(),
    roomUrl: v.optional(v.string()),
});
export type ScheduleSession = Infer<typeof scheduleSessionValidator>;

// ============================================================================
// GRADE TYPES AND INTERFACES
// ============================================================================

/**
 * Grade information with all calculated fields
 */
export interface GradeInfo {
    percentageGrade: number;
    letterGrade: string;
    gradePoints: number;
    qualityPoints: number;
    isPassing: boolean;
}

/**
 * Grade summary for a period or overall
 */
export interface GradeSummary {
    totalCredits: number;
    attemptedCredits: number;
    earnedCredits: number;
    gradePoints: number;
    gpa: number;
    cgpa?: number; // Cumulative GPA
}

/**
 * Letter grade scale configuration
 */
export const GRADE_SCALE = {
    "A+": { min: 97, max: 100, points: 4.0 },
    "A": { min: 93, max: 96.99, points: 4.0 },
    "A-": { min: 90, max: 92.99, points: 3.7 },
    "B+": { min: 87, max: 89.99, points: 3.3 },
    "B": { min: 83, max: 86.99, points: 3.0 },
    "B-": { min: 80, max: 82.99, points: 2.7 },
    "C+": { min: 77, max: 79.99, points: 2.3 },
    "C": { min: 73, max: 76.99, points: 2.0 },
    "C-": { min: 70, max: 72.99, points: 1.7 },
    "D+": { min: 67, max: 69.99, points: 1.3 },
    "D": { min: 65, max: 66.99, points: 1.0 },
    "F": { min: 0, max: 64.99, points: 0.0 },
} as const;

export type LetterGrade = keyof typeof GRADE_SCALE;

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

/**
 * Complete user profile with role-specific data
 */
export type UserProfile = Doc<"users">;

/**
 * Public user information (safe to share)
 */
export type PublicUserInfo = Pick<Doc<"users">,
    "_id" | "firstName" | "lastName" | "email" | "role"
>;

/**
 * Student-specific view with enrollment data
 */
export interface StudentView {
    user: UserProfile;
    program: Doc<"programs">;
    currentEnrollments: Array<EnrollmentWithDetails>;
    academicProgress: AcademicProgress;
    currentPeriod: Doc<"periods"> | null;
}

/**
 * Professor-specific view with teaching data
 */
export interface ProfessorView {
    user: UserProfile;
    currentSections: Array<SectionWithCourse>;
    totalStudents: number;
    gradingDeadlines: Array<{
        section: Doc<"sections">;
        deadline: number;
    }>;
    currentPeriod: Doc<"periods"> | null;
}

/**
 * Admin dashboard view
 */
export interface AdminDashboard {
    activeStudents: number;
    activeProfessors: number;
    activePrograms: number;
    activeCourses: number;
    currentPeriod: Doc<"periods"> | null;
    upcomingDeadlines: Array<{
        type: string;
        description: string;
        date: number;
    }>;
}

// ============================================================================
// ENROLLMENT AND SECTION TYPES
// ============================================================================

/**
 * Enrollment with full details for display
 */
export interface EnrollmentWithDetails {
    enrollment: Doc<"enrollments">;
    section: Doc<"sections">;
    course: Doc<"courses">;
    professor: PublicUserInfo;
    period: Doc<"periods">;
}

/**
 * Section with course details
 */
export interface SectionWithCourse {
    section: Doc<"sections">;
    course: Doc<"courses">;
    enrollmentCount: number;
    availableSeats: number;
}

/**
 * Section with full enrollment list (for professors)
 */
export interface SectionWithEnrollments {
    section: Doc<"sections">;
    course: Doc<"courses">;
    enrollments: Array<{
        enrollment: Doc<"enrollments">;
        student: PublicUserInfo;
    }>;
}

// ============================================================================
// ACADEMIC PROGRESS TYPES
// ============================================================================

/**
 * Student's academic progress
 */
export interface AcademicProgress {
    programId: Id<"programs">;
    totalCreditsRequired: number;
    creditsCompleted: number;
    creditsByCategory: {
        humanities: { required: number; completed: number };
        core: { required: number; completed: number };
        elective: { required: number; completed: number };
        general: { required: number; completed: number };
    };
    gpa: number;
    cgpa: number;
    academicStanding: AcademicStanding;
    completionPercentage: number;
    estimatedGraduationDate?: number;
}

/**
 * Period academic summary (for transcripts)
 */
export interface PeriodSummary {
    period: Doc<"periods">;
    enrollments: Array<EnrollmentWithDetails>;
    summary: GradeSummary;
}

// ============================================================================
// FORM INPUT TYPES (for frontend forms)
// ============================================================================

/**
 * User creation form
 */
export type UserCreateInput = WithoutSystemFields<Doc<"users">>;

/**
 * User update form (partial update)
 */
export type UserUpdateInput = Partial<Omit<UserCreateInput, "clerkId" | "email" | "role">>;

/**
 * Section creation form
 */
export interface SectionCreateInput {
    courseId: Id<"courses">;
    periodId: Id<"periods">;
    groupNumber: string;
    professorId: Id<"users">;
    capacity: number;
    deliveryMethod: DeliveryMethod;
    schedule?: {
        sessions: ScheduleSession[];
        timezone: string;
        notes?: string;
    };
}

/**
 * Grade submission form (for professors)
 */
export interface GradeSubmissionInput {
    enrollmentId: Id<"enrollments">;
    percentageGrade: number;
    gradeNotes?: string;
}

/**
 * Bulk grade submission
 */
export interface BulkGradeSubmission {
    sectionId: Id<"sections">;
    grades: GradeSubmissionInput[];
}

/**
 * Enrollment creation form
 */
export interface EnrollmentCreateInput {
    studentId: Id<"users">;
    sectionId: Id<"sections">;
    isRetake?: boolean;
    isAuditing?: boolean;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

/**
 * Course search filters
 */
export interface CourseSearchFilters {
    programId?: Id<"programs">;
    category?: CourseCategory;
    language?: Language;
    level?: string;
    credits?: number;
    searchTerm?: string;
    includeInactive?: boolean;
}

/**
 * Section search filters
 */
export interface SectionSearchFilters {
    periodId?: Id<"periods">;
    courseId?: Id<"courses">;
    professorId?: Id<"users">;
    status?: SectionStatus;
    hasAvailableSeats?: boolean;
    deliveryMethod?: DeliveryMethod;
}

/**
 * User search filters
 */
export interface UserSearchFilters {
    role?: UserRole;
    isActive?: boolean;
    searchTerm?: string; // Searches name, email, code
    programId?: Id<"programs">; // For students
}

/**
 * Enrollment search filters
 */
export interface EnrollmentSearchFilters {
    studentId?: Id<"users">;
    periodId?: Id<"periods">;
    courseId?: Id<"courses">;
    sectionId?: Id<"sections">;
    status?: EnrollmentStatus;
    includeRetakes?: boolean;
}

// ============================================================================
// REPORT AND ANALYTICS TYPES
// ============================================================================

/**
 * Grade distribution for analytics
 */
export interface GradeDistribution {
    letterGrade: LetterGrade;
    count: number;
    percentage: number;
}

/**
 * Course statistics
 */
export interface CourseStatistics {
    courseId: Id<"courses">;
    courseName: string;
    totalEnrollments: number;
    averageGrade: number;
    passRate: number;
    gradeDistribution: GradeDistribution[];
    withdrawalRate: number;
}

/**
 * Program statistics
 */
export interface ProgramStatistics {
    programId: Id<"programs">;
    programName: string;
    activeStudents: number;
    totalGraduates: number;
    averageGPA: number;
    averageTimeToGraduation: number; // In bimesters
    retentionRate: number;
}

/**
 * Professor performance metrics
 */
export interface ProfessorMetrics {
    professorId: Id<"users">;
    totalSections: number;
    totalStudents: number;
    averageClassSize: number;
    averageGrade: number;
    gradeSubmissionTimeliness: number; // Percentage on time
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Prerequisites validation result
 */
export interface PrerequisiteValidation {
    isValid: boolean;
    missingPrerequisites: string[]; // Course codes
    completedPrerequisites: string[];
}

/**
 * Enrollment validation result
 */
export interface EnrollmentValidation {
    canEnroll: boolean;
    reasons: string[]; // Human-readable reasons if cannot enroll
    warnings: string[]; // Non-blocking warnings
}

/**
 * Graduation requirements validation
 */
export interface GraduationValidation {
    isEligible: boolean;
    totalCredits: { required: number; completed: number };
    categoryRequirements: Array<{
        category: CourseCategory;
        required: number;
        completed: number;
        remaining: number;
    }>;
    gpaRequirement: { minimum: number; current: number };
    missingCourses: string[]; // Required course codes not completed
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Pagination request parameters
 */
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

/**
 * Paginated response wrapper
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
// NOTIFICATION TYPES
// ============================================================================

/**
 * Announcement creation input
 */
export interface AnnouncementInput {
    sectionId: Id<"sections">;
    title: string;
    content: string;
    type: "general" | "assignment" | "exam" | "schedule" | "urgent";
    expiresAt?: number;
}

/**
 * System notification (for future implementation)
 */
export interface SystemNotification {
    id: string;
    userId: Id<"users">;
    type: "grade_posted" | "enrollment_confirmed" | "deadline_reminder" | "announcement";
    title: string;
    message: string;
    relatedId?: string; // ID of related entity
    createdAt: number;
    readAt?: number;
}

// ============================================================================
// EXPORT UTILITY TYPES FOR FRONTEND
// ============================================================================

// Re-export commonly used types for frontend convenience
export type { Doc, Id } from "./_generated/dataModel";
export type { WithoutSystemFields } from "convex/server";

/**
 * Helper type to extract document type without system fields
 * Usage: CreateInput<"users"> gives you user creation type
 */
export type CreateInput<TableName extends keyof typeof import("./schema")["default"]["tables"]> =
    WithoutSystemFields<Doc<TableName>>;

/**
 * Helper type for partial updates
 * Usage: UpdateInput<"users"> gives you user update type
 */
export type UpdateInput<TableName extends keyof typeof import("./schema")["default"]["tables"]> =
    Partial<CreateInput<TableName>>;

/**
 * Type guard to check if user is a student
 */
export function isStudent(user: UserProfile): boolean {
    return user.role === "student" && user.studentProfile !== undefined;
}

/**
 * Type guard to check if user is a professor
 */
export function isProfessor(user: UserProfile): boolean {
    return user.role === "professor" && user.professorProfile !== undefined;
}

/**
 * Type guard to check if user is admin
 */
export function isAdmin(user: UserProfile): boolean {
    return user.role === "admin" || user.role === "superadmin";
}