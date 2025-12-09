// convex/students.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { gradeValidator } from "./types";
import { Id } from "./_generated/dataModel";

// ============================================================================
// AVATAR STORAGE FUNCTIONS (Following official Convex pattern)
// ============================================================================

/**
 * Generate upload URL for avatar image (Step 1 of 3)
 */
export const generateAvatarUploadUrl = mutation({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Save avatar storage ID to student record (Step 3 of 3)
 */
export const saveAvatarStorageId = mutation({
    args: {
        studentId: v.id("students"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        // Delete old avatar if exists
        if (student.avatarStorageId) {
            await ctx.storage.delete(student.avatarStorageId);
        }

        // Update student with new avatar storage ID
        await ctx.db.patch(args.studentId, {
            avatarStorageId: args.storageId,
            updatedAt: Date.now(),
        });

        return args.studentId;
    },
});

/**
 * Delete avatar storage file (for cleaning up unused uploads)
 */
export const deleteAvatarStorage = mutation({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        try {
            await ctx.storage.delete(args.storageId);
        } catch {
            // Don't throw - storage might already be deleted
        }
    },
});

/**
 * Delete avatar from storage and student record
 */
export const deleteAvatar = mutation({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        // Delete from storage if exists
        if (student.avatarStorageId) {
            await ctx.storage.delete(student.avatarStorageId);
        }

        // Remove from student record
        await ctx.db.patch(args.studentId, {
            avatarStorageId: undefined,
            updatedAt: Date.now(),
        });

        return args.studentId;
    },
});

/**
 * Get avatar URL from storage ID (for individual use)
 */
/**
 * Get a single avatar URL efficiently for individual components
 */
export const getAvatarUrl = query({
    args: {
        storageId: v.id("_storage")
    },
    handler: async (ctx, args) => {
        try {
            return await ctx.storage.getUrl(args.storageId);
        } catch {
            return null;
        }
    }
});

/**
 * Get multiple avatar URLs efficiently for batch operations
 * Use sparingly to avoid performance issues - prefer individual queries
 */
export const getBatchAvatarUrls = query({
    args: {
        storageIds: v.array(v.id("_storage"))
    },
    handler: async (ctx, args) => {
        try {
            const urls: Record<string, string | null> = {};

            // Process each storage ID individually to avoid Promise.all performance issues
            for (const storageId of args.storageIds) {
                try {
                    const url = await ctx.storage.getUrl(storageId);
                    urls[storageId] = url;
                } catch {
                    urls[storageId] = null;
                }
            }

            return urls;
        } catch {
            return {};
        }
    }
});

// ============================================================================
// EXISTING STUDENT FUNCTIONS
// ============================================================================

/**
 * Helper function to get students by car number
 * Searches across ALL campuses since car numbers are unique globally
 */
async function getStudentsByCarNumber(db: any, carNumber: number, campusId?: Id<"campusSettings">) {
    if (carNumber === 0) return [];

    // Get all students with this car number
    const allStudents = await db
        .query("students")
        .withIndex("by_car_number", (q: any) =>
            q.eq("carNumber", carNumber)
        )
        .collect();

    // If campusId provided, filter to that campus first
    if (campusId) {
        const studentsInCampus = allStudents.filter((s: any) => 
            s.campuses?.includes(campusId)
        );
        if (studentsInCampus.length > 0) {
            return studentsInCampus;
        }
    }

    return allStudents;
}

/**
 * List students with filtering options
 */
export const list = query({
    args: {
        campus: v.optional(v.string()),
        grade: v.optional(v.string()),
        search: v.optional(v.string()),
        carNumber: v.optional(v.number()),
        hasCarAssigned: v.optional(v.boolean()),
        limit: v.optional(v.number()),
        offset: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        // Check authentication first
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty results when not authenticated
            return {
                students: [],
                total: 0,
                hasMore: false,
                authState: "unauthenticated"
            };
        }

        try {
            let students: any[];

            // Get all students first
            students = await ctx.db
                .query("students")
                .collect();

            // Filter by campus if provided (campus arg is the campus name)
            if (args.campus) {
                // First, find the campus ID by name
                const campusDoc = await ctx.db
                    .query("campusSettings")
                    .filter((q: any) => q.eq(q.field("campusName"), args.campus))
                    .first();
                
                if (campusDoc) {
                    students = students.filter((s: any) => 
                        s.campuses?.includes(campusDoc._id)
                    );
                } else {
                    students = [];
                }
            }

            // Additional filtering in memory
            if (args.grade) {
                students = students.filter((s: any) => s.grade === args.grade);
            }

            if (args.carNumber !== undefined) {
                students = students.filter((s: any) => s.carNumber === args.carNumber);
            }

            if (args.hasCarAssigned !== undefined) {
                students = students.filter((s: any) =>
                    args.hasCarAssigned ? s.carNumber > 0 : s.carNumber === 0
                );
            }

            if (args.search) {
                const searchLower = args.search.toLowerCase();
                students = students.filter((s: any) =>
                    s.fullName.toLowerCase().includes(searchLower) ||
                    s.firstName.toLowerCase().includes(searchLower) ||
                    s.lastName.toLowerCase().includes(searchLower)
                );
            }

            // Sort by full name for consistent ordering
            students.sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));

            // Pagination - usar un límite muy alto por defecto para obtener todos
            const offset = args.offset || 0;
            const limit = args.limit || 10000; // Límite muy alto por defecto
            const paginatedStudents = students.slice(offset, offset + limit);

            return {
                students: paginatedStudents,
                total: students.length,
                hasMore: offset + limit < students.length,
                authState: "authenticated"
            };
        } catch {
            return {
                students: [],
                total: 0,
                hasMore: false,
                authState: "error"
            };
        }
    }
});

/**
 * Get a single student by ID
 */
export const get = query({
    args: { id: v.id("students") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.id);
        if (!student) {
            return null;
        }

        // Get siblings (other students with same car number)
        const siblings = student.carNumber > 0 ?
            await getStudentsByCarNumber(ctx.db, student.carNumber, student.campuses?.[0])
                .then((students: any[]) => students.filter((s: any) => s._id !== student._id)) :
            [];

        return {
            student,
            siblings
        };
    }
});

/**
 * Create a new student
 */
export const create = mutation({
    args: {
        firstName: v.string(),
        lastName: v.string(),
        birthday: v.string(),
        grade: gradeValidator,
        campuses: v.array(v.id("campusSettings")),
        carNumber: v.optional(v.number()),
        avatarUrl: v.optional(v.string()),
        avatarStorageId: v.optional(v.id("_storage")), // For new Convex storage
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Validate required fields are not empty
        if (!args.firstName.trim()) {
            throw new Error("First name is required");
        }
        if (!args.lastName.trim()) {
            throw new Error("Last name is required");
        }
        if (args.campuses.length === 0) {
            throw new Error("At least one campus is required");
        }

        // Validate car number
        const carNumber = args.carNumber || 0;
        if (carNumber < 0) {
            throw new Error("Car number cannot be negative");
        }

        // Create full name
        const fullName = `${args.firstName.trim()} ${args.lastName.trim()}`;

        // Insert student
        const studentId = await ctx.db.insert("students", {
            firstName: args.firstName.trim(),
            lastName: args.lastName.trim(),
            fullName,
            birthday: args.birthday,
            grade: args.grade,
            campuses: args.campuses,
            carNumber,
            avatarUrl: args.avatarUrl,
            avatarStorageId: args.avatarStorageId,
            isActive: true,
            createdAt: Date.now()
        });

        return studentId;
    }
});

/**
 * Update an existing student
 */
export const update = mutation({
    args: {
        studentId: v.id("students"),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        birthday: v.optional(v.string()),
        grade: v.optional(gradeValidator),
        campuses: v.optional(v.array(v.id("campusSettings"))),
        carNumber: v.optional(v.number()),
        avatarUrl: v.optional(v.string()),
        avatarStorageId: v.optional(v.id("_storage")) // For new Convex storage
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        // If updating avatar storage, delete the old one first
        if (args.avatarStorageId !== undefined && student.avatarStorageId &&
            student.avatarStorageId !== args.avatarStorageId) {
            try {
                await ctx.storage.delete(student.avatarStorageId);
            } catch {
                // Continue with update even if deletion fails
            }
        }

        // Build update object
        const updates: any = {};

        // Update individual fields
        if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
        if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
        if (args.birthday !== undefined) updates.birthday = args.birthday;
        if (args.grade !== undefined) updates.grade = args.grade;
        if (args.campuses !== undefined) updates.campuses = args.campuses;
        if (args.carNumber !== undefined) {
            if (args.carNumber < 0) throw new Error("Car number cannot be negative");
            updates.carNumber = args.carNumber;
        }
        if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
        if (args.avatarStorageId !== undefined) updates.avatarStorageId = args.avatarStorageId;

        // Update full name if first or last name changed
        if (args.firstName !== undefined || args.lastName !== undefined) {
            const firstName = args.firstName || student.firstName;
            const lastName = args.lastName || student.lastName;
            updates.fullName = `${firstName.trim()} ${lastName.trim()}`;
        }

        // Apply updates
        await ctx.db.patch(args.studentId, updates);

        return args.studentId;
    }
});

/**
 * Hard delete a student with cascade queue removal and avatar cleanup
 */
export const deleteStudent = mutation({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        let carRemovedFromQueue = false;

        // Delete avatar from storage if exists
        if (student.avatarStorageId) {
            try {
                await ctx.storage.delete(student.avatarStorageId);
            } catch {
                // Continue with deletion even if avatar deletion fails
            }
        }

        // Check if this student's car is currently in any queue
        const studentCampusId = student.campuses[0];
        if (student.carNumber > 0 && studentCampusId) {
            // Get campus name for dismissalQueue lookup (queue uses campusName as string)
            const campusSettings = await ctx.db.get(studentCampusId);
            const campusName = campusSettings?.campusName;

            if (campusName) {
                const queueEntry = await ctx.db
                    .query("dismissalQueue")
                    .withIndex("by_car_campus", (q: any) =>
                        q.eq("carNumber", student.carNumber)
                            .eq("campusLocation", campusName)
                    )
                    .filter((q: any) => q.eq(q.field("status"), "waiting"))
                    .first();

                if (queueEntry) {
                    // Get remaining students with the same car number (siblings)
                    const remainingStudents = await getStudentsByCarNumber(
                        ctx.db,
                        student.carNumber,
                        studentCampusId
                    ).then((students: any[]) =>
                        students.filter((s: any) => s._id !== student._id)
                    );

                if (remainingStudents.length === 0) {
                    // No other students with this car number, remove from queue entirely

                    // Create history entry for the removal
                    const waitTimeSeconds = Math.floor((Date.now() - queueEntry.assignedTime) / 1000);

                    // Get or create user record for history (use the user who added the car originally)
                    let removedByUser = queueEntry.addedBy;

                    await ctx.db.insert("dismissalHistory", {
                        carNumber: queueEntry.carNumber,
                        campusLocation: queueEntry.campusLocation,
                        lane: queueEntry.lane,
                        studentIds: queueEntry.students.map((s: any) => s.studentId),
                        studentNames: queueEntry.students.map((s: any) => s.name),
                        queuedAt: queueEntry.assignedTime,
                        completedAt: Date.now(),
                        waitTimeSeconds,
                        addedBy: queueEntry.addedBy,
                        removedBy: removedByUser,
                        date: new Date().toISOString().split('T')[0]
                    });

                    // Reposition remaining cars in lane
                    const entriesToReposition = await ctx.db
                        .query("dismissalQueue")
                        .withIndex("by_campus_lane_position", (q: any) =>
                            q.eq("campusLocation", queueEntry.campusLocation)
                                .eq("lane", queueEntry.lane)
                        )
                        .filter((q: any) => q.gt(q.field("position"), queueEntry.position))
                        .collect();

                    // Reposition cars
                    for (const entry of entriesToReposition) {
                        const { _id, _creationTime, ...entryData } = entry;
                        const newEntry = { ...entryData, position: entry.position - 1 };
                        await ctx.db.delete(entry._id);
                        await ctx.db.insert("dismissalQueue", newEntry);
                    }

                    // Remove the queue entry
                    await ctx.db.delete(queueEntry._id);
                    carRemovedFromQueue = true;
                } else {
                    // Update queue entry to remove this student but keep the car
                    const updatedStudents = queueEntry.students.filter(
                        (s: any) => s.studentId !== student._id
                    );

                    await ctx.db.patch(queueEntry._id, {
                        students: updatedStudents
                    });
                }
                }
            }
        }

        // Hard delete the student from database
        await ctx.db.delete(args.studentId);

        return {
            studentId: args.studentId,
            carRemoved: carRemovedFromQueue
        };
    }
});

/**
 * Hard delete multiple students with cascade queue removal and avatar cleanup
 */
export const deleteMultipleStudents = mutation({
    args: { studentIds: v.array(v.id("students")) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const results = [];
        const processedCars = new Set<string>(); // To avoid processing the same car multiple times

        for (const studentId of args.studentIds) {
            const student = await ctx.db.get(studentId);
            if (!student) {
                results.push({ studentId, success: false, error: "Student not found" });
                continue;
            }

            // Delete avatar from storage if exists
            if (student.avatarStorageId) {
                try {
                    await ctx.storage.delete(student.avatarStorageId);
                } catch {
                    // Continue with deletion even if avatar deletion fails
                }
            }

            let carRemovedFromQueue = false;
            const studentCampusId = student.campuses[0];
            const carKey = `${student.carNumber}-${studentCampusId}`;

            // Check if this student's car is currently in any queue (only once per car)
            if (student.carNumber > 0 && studentCampusId && !processedCars.has(carKey)) {
                processedCars.add(carKey);

                // Get campus name for dismissalQueue lookup (queue uses campusName as string)
                const campusSettings = await ctx.db.get(studentCampusId);
                const campusName = campusSettings?.campusName;

                if (campusName) {
                    const queueEntry = await ctx.db
                        .query("dismissalQueue")
                        .withIndex("by_car_campus", (q: any) =>
                            q.eq("carNumber", student.carNumber)
                                .eq("campusLocation", campusName)
                        )
                        .filter((q: any) => q.eq(q.field("status"), "waiting"))
                        .first();

                    if (queueEntry) {
                        // Get remaining students with the same car number after all deletions
                        const remainingStudents = await getStudentsByCarNumber(
                            ctx.db,
                            student.carNumber,
                            studentCampusId
                        ).then((students: any[]) =>
                            students.filter((s: any) =>
                                !args.studentIds.includes(s._id)
                            )
                        );

                    if (remainingStudents.length === 0) {
                        // No students will remain with this car number, remove from queue entirely

                        // Create history entry for the removal
                        const waitTimeSeconds = Math.floor((Date.now() - queueEntry.assignedTime) / 1000);

                        await ctx.db.insert("dismissalHistory", {
                            carNumber: queueEntry.carNumber,
                            campusLocation: queueEntry.campusLocation,
                            lane: queueEntry.lane,
                            studentIds: queueEntry.students.map((s: any) => s.studentId),
                            studentNames: queueEntry.students.map((s: any) => s.name),
                            queuedAt: queueEntry.assignedTime,
                            completedAt: Date.now(),
                            waitTimeSeconds,
                            addedBy: queueEntry.addedBy,
                            removedBy: queueEntry.addedBy,
                            date: new Date().toISOString().split('T')[0]
                        });

                        // Reposition remaining cars in lane
                        const entriesToReposition = await ctx.db
                            .query("dismissalQueue")
                            .withIndex("by_campus_lane_position", (q: any) =>
                                q.eq("campusLocation", queueEntry.campusLocation)
                                    .eq("lane", queueEntry.lane)
                            )
                            .filter((q: any) => q.gt(q.field("position"), queueEntry.position))
                            .collect();

                        // Reposition cars
                        for (const entry of entriesToReposition) {
                            const { _id, _creationTime, ...entryData } = entry;
                            const newEntry = { ...entryData, position: entry.position - 1 };
                            await ctx.db.delete(entry._id);
                            await ctx.db.insert("dismissalQueue", newEntry);
                        }

                        // Remove the queue entry
                        await ctx.db.delete(queueEntry._id);
                        carRemovedFromQueue = true;
                    } else {
                        // Update queue entry to remove deleted students but keep the car
                        const updatedStudents = queueEntry.students.filter(
                            (s: any) => !args.studentIds.includes(s.studentId)
                        );

                        await ctx.db.patch(queueEntry._id, {
                            students: updatedStudents
                        });
                    }
                    }
                }
            }

            // Hard delete the student from database
            await ctx.db.delete(studentId);

            results.push({
                studentId,
                success: true,
                carRemoved: carRemovedFromQueue
            });
        }

        return {
            results,
            totalDeleted: results.filter(r => r.success).length,
            totalCarsRemoved: results.filter(r => r.carRemoved).length
        };
    }
});

/**
 * Assign car number to a student
 */
export const assignCarNumber = mutation({
    args: {
        studentId: v.id("students"),
        carNumber: v.number()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        if (args.carNumber < 0) {
            throw new Error("Car number cannot be negative");
        }

        // Update car number
        await ctx.db.patch(args.studentId, {
            carNumber: args.carNumber
        });

        return args.studentId;
    }
});

/**
 * Remove car assignment from a student
 */
export const removeCarNumber = mutation({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student) {
            throw new Error("Student not found");
        }

        // Remove car assignment
        await ctx.db.patch(args.studentId, {
            carNumber: 0
        });

        return args.studentId;
    }
});

/**
 * Get students by car number for a specific campus
 * Lightweight query for queue operations
 */
export const getByCarNumber = query({
    args: {
        carNumber: v.number(),
        campusId: v.id("campusSettings")
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        return await getStudentsByCarNumber(ctx.db, args.carNumber, args.campusId);
    }
});
