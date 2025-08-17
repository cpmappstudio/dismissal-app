import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  programTypeValidator,
  userRoleValidator,
  studentStatusValidator,
  courseAreaValidator,
  semesterPeriodValidator,
  scheduleSlotValidator,
} from "./types";
import {
  getCurrentUserFromAuth,
  requireAuth,
  requireRole,
  enrichEnrollmentsWithDetails,
  calculateStudentProgress,
  isStudentEnrolledInCourse,
  isProgramCodeTaken,
  isCourseCodeTaken,
  calculateLetterGrade,
  isPassingGrade
} from "./helpers";

// ============================================================================
// USER FUNCTIONS
// ============================================================================

/**
 * Get current user from Clerk authentication
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserFromAuth(ctx);
  },
});

/**
 * Create user after registration
 */
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: userRoleValidator,
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) return existing._id;

    const userId = await ctx.db.insert("users", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Update user profile with proper typing
 */
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    studentProfile: v.optional(v.object({
      studentCode: v.string(),
      programId: v.id("programs"),
      enrollmentYear: v.number(),
      status: studentStatusValidator,
      showProfile: v.boolean(),
      showCourses: v.boolean(),
      showGrades: v.boolean(),
    })),
    professorProfile: v.optional(v.object({
      employeeCode: v.string(),
      department: v.string(),
      title: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const { userId, ...updates } = args;
    await ctx.db.patch(userId, updates);
    return userId;
  },
});

// ============================================================================
// PROGRAM FUNCTIONS
// ============================================================================

/**
 * Get all active programs
 */
export const getPrograms = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("programs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Create new program with validation
 */
export const createProgram = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    type: programTypeValidator,
    department: v.string(),
    totalCredits: v.number(),
    durationSemesters: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    // Check if code already exists
    if (await isProgramCodeTaken(ctx, args.code)) {
      throw new Error(`Program code '${args.code}' already exists`);
    }

    return await ctx.db.insert("programs", {
      code: args.code,
      name: args.name,
      type: args.type as any,
      department: args.department,
      totalCredits: args.totalCredits,
      durationSemesters: args.durationSemesters,
      isActive: true,
    });
  },
});

// ============================================================================
// COURSE FUNCTIONS
// ============================================================================

/**
 * Get courses by program
 */
export const getCoursesByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courses")
      .withIndex("by_program_active", (q) =>
        q.eq("programId", args.programId).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Create new course with validation
 */
export const createCourse = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.string(),
    credits: v.number(),
    programId: v.id("programs"),
    area: courseAreaValidator,
    prerequisites: v.array(v.string()),
    minSemester: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    // Check if course code already exists
    if (await isCourseCodeTaken(ctx, args.code)) {
      throw new Error(`Course code '${args.code}' already exists`);
    }

    return await ctx.db.insert("courses", {
      ...args,
      isActive: true,
    });
  },
});

// ============================================================================
// ENROLLMENT FUNCTIONS
// ============================================================================

/**
 * Get student enrollments with course details
 */
export const getStudentEnrollments = query({
  args: {
    studentId: v.id("users"),
    semesterId: v.optional(v.id("semesters")),
  },
  handler: async (ctx, args) => {
    let enrollments;

    if (args.semesterId) {
      enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student_semester", (q) =>
          q.eq("studentId", args.studentId).eq("semesterId", args.semesterId!)
        )
        .collect();
    } else {
      enrollments = await ctx.db
        .query("enrollments")
        .filter((q) => q.eq(q.field("studentId"), args.studentId))
        .collect();
    }

    return await enrichEnrollmentsWithDetails(ctx, enrollments);
  },
});

/**
 * Enroll student in section with validation
 */
export const enrollStudent = mutation({
  args: {
    studentId: v.id("users"),
    sectionId: v.id("sections"),
    semesterId: v.id("semesters"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Check if already enrolled
    if (await isStudentEnrolledInCourse(ctx, args.studentId, args.courseId, args.semesterId)) {
      throw new Error("Student already enrolled in this course");
    }

    return await ctx.db.insert("enrollments", {
      ...args,
      enrolledAt: Date.now(),
      status: "enrolled",
      isRetake: false,
    });
  },
});

/**
 * Update final grade with automatic letter grade calculation
 */
export const updateFinalGrade = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    finalGrade: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "professor");

    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Get course to determine credit value
    const course = await ctx.db.get(enrollment.courseId);
    const creditsEarned = isPassingGrade(args.finalGrade) ? course?.credits || 0 : 0;

    await ctx.db.patch(args.enrollmentId, {
      finalGrade: args.finalGrade,
      letterGrade: calculateLetterGrade(args.finalGrade),
      creditsEarned,
      status: isPassingGrade(args.finalGrade) ? "completed" : "failed",
    });

    return args.enrollmentId;
  },
});

// ============================================================================
// SECTION FUNCTIONS
// ============================================================================

/**
 * Get professor's sections for a semester with enriched data
 */
export const getProfessorSections = query({
  args: {
    professorId: v.id("users"),
    semesterId: v.id("semesters"),
  },
  handler: async (ctx, args) => {
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_professor_semester", (q) =>
        q.eq("professorId", args.professorId).eq("semesterId", args.semesterId)
      )
      .collect();

    // Enrich with course details and enrollment count
    const enrichedSections = await Promise.all(
      sections.map(async (section) => {
        const course = await ctx.db.get(section.courseId);
        const enrollments = await ctx.db
          .query("enrollments")
          .withIndex("by_section_status", (q) =>
            q.eq("sectionId", section._id).eq("status", "enrolled")
          )
          .collect();

        return {
          ...section,
          course,
          enrollments,
          enrolledCount: enrollments.length,
        };
      })
    );

    return enrichedSections;
  },
});

/**
 * Create new section with proper validation
 */
export const createSection = mutation({
  args: {
    courseId: v.id("courses"),
    semesterId: v.id("semesters"),
    sectionNumber: v.string(),
    crn: v.string(),
    professorId: v.id("users"),
    schedule: v.array(scheduleSlotValidator),
    capacity: v.number(),
    gradeWeights: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    // Validate CRN is unique
    const existingCRN = await ctx.db
      .query("sections")
      .withIndex("by_crn", (q) => q.eq("crn", args.crn))
      .first();

    if (existingCRN) {
      throw new Error(`CRN '${args.crn}' already exists`);
    }

    return await ctx.db.insert("sections", {
      ...args,
      enrolled: 0,
      status: "draft",
    });
  },
});

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Calculate student academic progress using helper
 */
export const getStudentProgress = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, args) => {
    return await calculateStudentProgress(ctx, args.studentId);
  },
});

// ============================================================================
// CURRENT SEMESTER
// ============================================================================

/**
 * Get current active semester
 */
export const getCurrentSemester = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("semesters")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
  },
});

/**
 * Create new semester with validation
 */
export const createSemester = mutation({
  args: {
    code: v.string(),
    year: v.number(),
    period: semesterPeriodValidator,
    startDate: v.number(),
    endDate: v.number(),
    enrollmentStart: v.number(),
    enrollmentEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    return await ctx.db.insert("semesters", {
      ...args,
      status: "planning",
    });
  },
});
