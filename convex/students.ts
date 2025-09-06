// convex/students.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { gradeValidator } from "./types";

/**
 * Helper function to get students by car number
 */
async function getStudentsByCarNumber(db: any, carNumber: number, campus: string) {
    if (carNumber === 0) return [];

    return await db
        .query("students")
        .withIndex("by_car_campus", (q: any) =>
            q.eq("carNumber", carNumber)
                .eq("campusLocation", campus)
                .eq("isActive", true)
        )
        .collect();
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

            // Optimize query - use indexes when possible
            if (args.campus) {
                students = await ctx.db
                    .query("students")
                    .withIndex("by_campus_active", (q: any) =>
                        q.eq("campusLocation", args.campus!).eq("isActive", true)
                    )
                    .collect();
            } else {
                students = await ctx.db
                    .query("students")
                    .filter((q: any) => q.eq(q.field("isActive"), true))
                    .collect();
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

            // Pagination
            const offset = args.offset || 0;
            const limit = args.limit || 50;
            const paginatedStudents = students.slice(offset, offset + limit);

            return {
                students: paginatedStudents,
                total: students.length,
                hasMore: offset + limit < students.length,
                authState: "authenticated"
            };
        } catch (error) {
            console.error("Error fetching students:", error);
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
        if (!student || !student.isActive) {
            return null;
        }

        // Get siblings (other students with same car number)
        const siblings = student.carNumber > 0 ?
            await getStudentsByCarNumber(ctx.db, student.carNumber, student.campusLocation)
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
        campusLocation: v.string(),
        carNumber: v.optional(v.number()),
        avatarUrl: v.optional(v.string())
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
        if (!args.campusLocation.trim()) {
            throw new Error("Campus location is required");
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
            campusLocation: args.campusLocation,
            carNumber,
            avatarUrl: args.avatarUrl,
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
        campusLocation: v.optional(v.string()),
        carNumber: v.optional(v.number()),
        avatarUrl: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const student = await ctx.db.get(args.studentId);
        if (!student || !student.isActive) {
            throw new Error("Student not found");
        }

        // Build update object
        const updates: any = {};

        // Update individual fields
        if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
        if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
        if (args.birthday !== undefined) updates.birthday = args.birthday;
        if (args.grade !== undefined) updates.grade = args.grade;
        if (args.campusLocation !== undefined) updates.campusLocation = args.campusLocation;
        if (args.carNumber !== undefined) {
            if (args.carNumber < 0) throw new Error("Car number cannot be negative");
            updates.carNumber = args.carNumber;
        }
        if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

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
 * Soft delete a student with cascade queue removal
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

        // Check if this student's car is currently in any queue
        if (student.carNumber > 0) {
            const queueEntry = await ctx.db
                .query("dismissalQueue")
                .withIndex("by_car_campus", (q: any) =>
                    q.eq("carNumber", student.carNumber)
                        .eq("campusLocation", student.campusLocation)
                )
                .filter((q: any) => q.eq(q.field("status"), "waiting"))
                .first();

            if (queueEntry) {
                // Get remaining students with the same car number (siblings)
                const remainingStudents = await getStudentsByCarNumber(
                    ctx.db,
                    student.carNumber,
                    student.campusLocation
                ).then((students: any[]) =>
                    students.filter((s: any) => s._id !== student._id && s.isActive)
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

        // Soft delete the student
        await ctx.db.patch(args.studentId, {
            isActive: false
        });

        return {
            studentId: args.studentId,
            carRemoved: carRemovedFromQueue
        };
    }
});

/**
 * Soft delete multiple students with cascade queue removal
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

            let carRemovedFromQueue = false;
            const carKey = `${student.carNumber}-${student.campusLocation}`;

            // Check if this student's car is currently in any queue (only once per car)
            if (student.carNumber > 0 && !processedCars.has(carKey)) {
                processedCars.add(carKey);

                const queueEntry = await ctx.db
                    .query("dismissalQueue")
                    .withIndex("by_car_campus", (q: any) =>
                        q.eq("carNumber", student.carNumber)
                            .eq("campusLocation", student.campusLocation)
                    )
                    .filter((q: any) => q.eq(q.field("status"), "waiting"))
                    .first();

                if (queueEntry) {
                    // Get remaining students with the same car number after all deletions
                    const remainingStudents = await getStudentsByCarNumber(
                        ctx.db,
                        student.carNumber,
                        student.campusLocation
                    ).then((students: any[]) =>
                        students.filter((s: any) =>
                            s.isActive && !args.studentIds.includes(s._id)
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

            // Soft delete the student
            await ctx.db.patch(studentId, {
                isActive: false
            });

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
        if (!student || !student.isActive) {
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
        if (!student || !student.isActive) {
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
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        return await getStudentsByCarNumber(ctx.db, args.carNumber, args.campus);
    }
});
