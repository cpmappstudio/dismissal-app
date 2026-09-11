import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type DatabaseReader,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { validateUserAccess, getCampusSettings, getStudentsByCarNumber } from "./helpers";
import { canDispatch, hasGlobalCampusScope, isManagementRole, type DismissalRole } from "../lib/role-utils";
import {
  normalizeVehicleIdentifier,
  type VehicleIdentifier,
} from "../lib/vehicle";
import { operationalDate } from "../lib/operational-day";
import { isBus } from "./buses";
export { isBus } from "./buses";

const rosterRoles: DismissalRole[] = [
  "superadmin",
  "principal",
  "admin",
  "operator",
  "allocator",
  "dispatcher",
  "bus_driver",
];
const vehicleValidator = v.union(v.number(), v.string());
const editableStatus = v.union(
  v.literal("pending"),
  v.literal("boarded"),
  v.literal("not_traveling"),
  v.literal("picked_up_early"),
);

export async function rosterStudents(
  db: DatabaseReader,
  identifier: VehicleIdentifier,
  campusId: Id<"campusSettings">,
  date: string,
) {
  const students = await getStudentsByCarNumber(db, identifier, campusId, false);
  const boardings = await db
    .query("studentDismissals")
    .withIndex("by_campusId_date_vehicleIdentifier_status", (q) =>
      q.eq("campusId", campusId).eq("date", date)
        .eq("vehicleIdentifier", identifier),
    )
    .take(201);
  if (students.length > 200 || boardings.length > 200)
    throw new Error("Too many students assigned to this vehicle");
  // Preserve the day's bus journey after departure or assignment changes as well.
  const roster = new Map(students.map((student) => [student._id, student]));
  for (const boarding of boardings) {
    if (boarding.dropoff) continue;
    if (boarding.status !== "boarded" && !(boarding.status === "departed" && boarding.vehicleType === "bus")) continue;
    if (roster.has(boarding.studentId)) continue;
    const student = await db.get(boarding.studentId);
    if (!student) throw new Error("A boarded student's record is missing");
    roster.set(student._id, student);
  }
  if (roster.size > 200)
    throw new Error("Too many students assigned to this vehicle");
  return [...roster.values()];
}

export async function getDailyState(
  db: DatabaseReader,
  campusId: Id<"campusSettings">,
  date: string,
  studentId: Id<"students">,
) {
  // An early pickup means "do not wait" at every campus, even with a local state.
  const earlyPickup = await db
    .query("studentDismissals")
    .withIndex("by_studentId_date_status", (q) =>
      q.eq("studentId", studentId).eq("date", date).eq("status", "picked_up_early"),
    )
    .unique();
  if (earlyPickup) return earlyPickup;
  return db
    .query("studentDismissals")
    .withIndex("by_campusId_date_studentId", (q) =>
      q.eq("campusId", campusId).eq("date", date).eq("studentId", studentId),
    )
    .unique();
}

export async function assertNotBoarded(
  db: DatabaseReader,
  student: Doc<"students">,
) {
  const boardings = await db
    .query("studentDismissals")
    .withIndex("by_studentId_date_status", (q) =>
      q.eq("studentId", student._id).eq("date", operationalDate()),
    )
    .collect();
  for (const boarding of boardings) {
    const state = await getDailyState(
      db,
      boarding.campusId,
      boarding.date,
      student._id,
    );
    if (state && !state.dropoff && (state.status === "boarded" || (state.status === "departed" && state.vehicleType === "bus")))
      throw new Error(
        "Mark this student pending in the bus list before changing their assignment or deleting them",
      );
  }
}

function transportEvent(data: Pick<Doc<"studentDismissals">, "updatedAt" | "updatedBy" | "updatedByName">) {
  return { at: data.updatedAt, by: data.updatedBy, byName: data.updatedByName };
}

export async function writeDailyState(
  ctx: MutationCtx,
  previous: Doc<"studentDismissals"> | null,
  data: Omit<Doc<"studentDismissals">, "_id" | "_creationTime" | "revision">,
  user: Doc<"users">,
) {
  const traveling = data.vehicleType === "bus" && (data.status === "boarded" || data.status === "departed");
  const next = {
    ...data,
    boarding: traveling ? previous?.boarding ??
      (previous?.status === "boarded" ? transportEvent(previous) : data.status === "boarded" ? transportEvent(data) : undefined) : undefined,
    departure: data.status === "departed" ? previous?.departure ??
      transportEvent(previous?.status === "departed" ? previous : data) : undefined,
    revision: (previous?.revision ?? 0) + 1,
  };
  const id = previous
    ? previous._id
    : await ctx.db.insert("studentDismissals", next);
  if (previous) await ctx.db.replace(previous._id, next);
  await ctx.db.insert("auditLogs", {
    userId: user._id,
    username: user.email ?? user.fullName ?? "",
    userRole: user.role ?? "viewer",
    action: "student_dismissal_updated",
    targetType: "student",
    targetId: data.studentId,
    details: { before: previous, after: next },
    timestamp: data.updatedAt,
  });
  return id;
}

export const getDriverContext = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await validateUserAccess(ctx, ["bus_driver"]);
    const campuses = await Promise.all(
      user.assignedCampuses.map((id) => ctx.db.get(id)),
    );
    return {
      busNumber: user.busNumber,
      campuses: campuses
        .filter((c) => c?.isActive)
        .map((c) => ({ name: c!.campusName, timezone: c!.timezone })),
    };
  },
});

export const getRoster = query({
  args: { campus: v.string(), carNumber: vehicleValidator, date: v.string(), historical: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(
      ctx,
      rosterRoles,
      args.campus,
    );
    const identifier = normalizeVehicleIdentifier(args.carNumber);
    if (role === "bus_driver" && user.busNumber !== identifier)
      throw new Error("This is not your bus");
    const campus = await getCampusSettings(ctx.db, args.campus);
    if (!campus || !campus.isActive) throw new Error("Campus unavailable");
    const today = operationalDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) ||
      !Number.isFinite(Date.parse(args.date)) ||
      new Date(args.date).toISOString().slice(0, 10) !== args.date || args.date > today)
      throw new Error("Choose today or a valid past date");
    // Distinct query keys prevent a cached live roster being reused as history after midnight.
    const isToday = args.date === today && !args.historical;
    // Historical membership comes from recorded events, never today's assignments.
    const records = isToday ? null : await ctx.db.query("studentDismissals")
      .withIndex("by_campusId_date_vehicleIdentifier_status", q =>
        q.eq("campusId", campus._id).eq("date", args.date).eq("vehicleIdentifier", identifier),
      ).take(201);
    if (records && records.length > 200) throw new Error("Too many student records for this vehicle");
    const rows = records
      ? await Promise.all(records.map(async record => ({
          id: record.studentId,
          name: record.studentName,
          student: await ctx.db.get(record.studentId),
          state: await getDailyState(ctx.db, campus._id, args.date, record.studentId),
        })))
      : await Promise.all((await rosterStudents(ctx.db, identifier, campus._id, args.date)).map(async student => ({
          id: student._id,
          name: student.fullName,
          student,
          state: await getDailyState(ctx.db, campus._id, args.date, student._id),
        })));
    const bus = await isBus(ctx.db, identifier);
    const [previous, next] = await Promise.all([
      ctx.db.query("studentDismissals")
        .withIndex("by_campusId_vehicleIdentifier_date", q =>
          q.eq("campusId", campus._id).eq("vehicleIdentifier", identifier).lt("date", args.date),
        ).order("desc").first(),
      ctx.db.query("studentDismissals")
        .withIndex("by_campusId_vehicleIdentifier_date", q =>
          q.eq("campusId", campus._id).eq("vehicleIdentifier", identifier).gt("date", args.date),
        ).order("asc").first(),
    ]);
    return {
      date: args.date,
      previousDate: previous?.date ?? null,
      nextDate: next && next.date <= today ? next.date : null,
      timezone: campus.timezone,
      isBus: bus,
      canEdit: isToday && bus && (canDispatch(role) || role === "bus_driver"),
      students: await Promise.all(
        rows.map(async ({ student, ...row }) => ({
          ...row,
          grade: student?.grade ?? "",
          avatarUrl: student?.avatarStorageId
            ? await ctx.storage.getUrl(student.avatarStorageId)
            : student?.avatarUrl,
        })),
      ),
    };
  },
});

export const searchPickupStudents = query({
  args: { campus: v.string(), date: v.string(), search: v.string() },
  handler: async (ctx, args) => {
    const { role } = await validateUserAccess(ctx, undefined, args.campus);
    if (!canDispatch(role)) throw new Error("Not authorized to record pickups");
    const campus = await getCampusSettings(ctx.db, args.campus);
    if (!campus) throw new Error("Campus unavailable");
    const matches =
      args.search.trim().length < 2
        ? []
        : await ctx.db
            .query("students")
            .withSearchIndex("search_fullName", (q) =>
              q.search("fullName", args.search.trim()).eq("isActive", true),
            )
            .take(100);
    return {
      students: await Promise.all(
        matches
          .filter((s) => s.campuses.includes(campus._id))
          .slice(0, 20)
          .map(async (s) => ({
            id: s._id,
            name: s.fullName,
            grade: s.grade,
            carNumber: s.carNumber,
            state: await getDailyState(ctx.db, campus._id, args.date, s._id),
          })),
      ),
    };
  },
});

export const listRecordedDepartures = query({
  args: { campus: v.string(), date: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { role, user } = await validateUserAccess(ctx, undefined, args.campus);
    if (!canDispatch(role)) throw new Error("Not authorized to view departures");
    const campus = await getCampusSettings(ctx.db, args.campus);
    if (!campus?.isActive) throw new Error("Campus unavailable");
    const results = await ctx.db.query("studentDismissals")
      .withIndex("by_date_status", q =>
        q.eq("date", args.date),
      ).filter(q => q.or(q.eq(q.field("status"), "departed"), q.eq(q.field("status"), "picked_up_early")))
      .order("desc").paginate(args.paginationOpts);
    // Filter by current student membership, just like the early-pickup search.
    // Keep the original cursor so sparse pages still reach every matching departure.
    const page = await Promise.all(results.page.map(async record => {
      const student = await ctx.db.get(record.studentId);
      if (!student?.isActive || !student.campuses.includes(campus._id)) return null;
      const origin = record.campusId === campus._id ? campus : await ctx.db.get(record.campusId);
      return {
        ...record, departureCampus: origin?.campusName ?? "—",
        canCorrect: record.status === "departed" ? isManagementRole(role) && !record.dropoff
          : !!origin?.isActive && (hasGlobalCampusScope(role) || user.assignedCampuses.includes(record.campusId)),
      };
    }));
    return { ...results, page: page.filter(record => record !== null) };
  },
});

// Correct the daily state, not the immutable vehicle departure/history.
export const correctDeparture = mutation({
  args: {
    campus: v.string(), date: v.string(), departureId: v.id("studentDismissals"),
    expectedRevision: v.number(), reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(ctx, undefined, args.campus);
    if (!isManagementRole(role)) throw new Error("Only administrators can correct departures");
    const campus = await getCampusSettings(ctx.db, args.campus);
    if (!campus?.isActive || args.date !== operationalDate())
      throw new Error("The operational day changed. Refresh the list");
    const reason = args.reason.trim();
    if (!reason || reason.length > 500) throw new Error("Enter a correction reason (maximum 500 characters)");
    // Correct the exact departure shown, even if it was recorded at another campus.
    const previous = await ctx.db.get(args.departureId);
    if (previous?.date !== args.date || previous.status !== "departed" || previous.revision !== args.expectedRevision)
      throw new Error("The student was updated by someone else. Review the latest state");
    if (previous.dropoff) throw new Error("Undo the bus drop-off before correcting this departure");
    const student = await ctx.db.get(previous.studentId);
    if (!student?.isActive || !student.campuses.includes(campus._id))
      throw new Error("Student does not belong to this campus");
    await writeDailyState(ctx, previous, {
      studentId: previous.studentId, studentName: previous.studentName,
      campusId: previous.campusId, date: previous.date, status: "pending",
      vehicleIdentifier: previous.vehicleIdentifier, vehicleType: previous.vehicleType,
      reason, updatedAt: Date.now(), updatedBy: user._id,
      updatedByName: user.fullName ?? user.email ?? "",
    }, user);
    return null;
  },
});

// Shared authorization and concurrency boundary for attendance and drop-off writes.
async function editableStudent(ctx: MutationCtx, args: {
  campus: string; date: string; studentId: Id<"students">; expectedRevision: number;
}) {
  const { user, role } = await validateUserAccess(ctx, rosterRoles, args.campus);
  if (!canDispatch(role) && role !== "bus_driver")
    throw new Error("Not authorized to update student departures");
  const campus = await getCampusSettings(ctx.db, args.campus);
  if (!campus?.isActive || args.date !== operationalDate())
    throw new Error("The operational day changed. Refresh the list");
  const student = await ctx.db.get(args.studentId);
  if (!student?.isActive) throw new Error("Student does not belong to this campus");
  const bus = student.carNumber !== 0 && await isBus(ctx.db, student.carNumber);
  if (!student.campuses.includes(campus._id) && (
    !bus || !(await rosterStudents(ctx.db, student.carNumber, campus._id, args.date)).some(s => s._id === student._id)
  )) throw new Error("Student does not belong to this campus");
  if (role === "bus_driver" && (!bus || user.busNumber !== student.carNumber))
    throw new Error("Student does not belong to your bus");
  const previous = await getDailyState(ctx.db, campus._id, args.date, student._id);
  if ((previous?.revision ?? 0) !== args.expectedRevision)
    throw new Error("The student was updated by someone else. Review the latest state");
  return { user, role, campus, student, bus, previous };
}

export const setDropoff = mutation({
  args: {
    campus: v.string(), date: v.string(), studentId: v.id("students"),
    expectedRevision: v.number(), droppedOff: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, student, bus, previous } = await editableStudent(ctx, args);
    if (!bus || !previous || previous.vehicleType !== "bus" ||
      previous.vehicleIdentifier !== student.carNumber ||
      (previous.status !== "boarded" && previous.status !== "departed"))
      throw new Error("The student must be on this bus before recording a drop-off");
    if (!!previous.dropoff === args.droppedOff) return null;
    const now = Date.now();
    await writeDailyState(ctx, previous, {
      studentId: previous.studentId, studentName: previous.studentName,
      campusId: previous.campusId, date: previous.date, status: previous.status,
      vehicleIdentifier: previous.vehicleIdentifier, vehicleType: previous.vehicleType,
      dropoff: args.droppedOff ? { at: now, by: user._id, byName: user.fullName ?? user.email ?? "" } : undefined,
      updatedAt: now, updatedBy: user._id, updatedByName: user.fullName ?? user.email ?? "",
    }, user);
    return null;
  },
});

export const setStatus = mutation({
  args: {
    campus: v.string(),
    date: v.string(),
    studentId: v.id("students"),
    status: editableStatus,
    expectedRevision: v.number(),
    reason: v.optional(v.string()),
    collectedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role, campus, student, bus, previous } = await editableStudent(ctx, args);
    if (args.status === "picked_up_early" && !student.campuses.includes(campus._id))
      throw new Error("Student does not belong to this campus");
    if (previous?.dropoff) throw new Error("Undo the bus drop-off before changing attendance");
    if (previous?.status === "departed")
      throw new Error("The student has already departed");
    if (
      role === "bus_driver" &&
      (args.status === "picked_up_early" ||
        previous?.status === "picked_up_early")
    )
      throw new Error(
        "Early pickups must be recorded or corrected by school staff",
      );
    if (previous?.status === "picked_up_early" && args.status !== "pending")
      throw new Error("Correct the early pickup before changing this student");
    if (previous?.status === "picked_up_early" && previous.campusId !== campus._id)
      throw new Error("Correct the early pickup from the campus where it was recorded");
    const reason = args.reason?.trim();
    const collectedBy = args.collectedBy?.trim();
    if (args.status === "not_traveling" && !reason)
      throw new Error("A reason is required");
    if (args.status === "picked_up_early" && !collectedBy)
      throw new Error("Enter who collected the student");
    if (previous?.status === "picked_up_early" && !reason)
      throw new Error("A correction reason is required");
    if ((reason?.length ?? 0) > 500 || (collectedBy?.length ?? 0) > 150)
      throw new Error("Text is too long");
    if (args.status === "boarded" && !bus)
      throw new Error("This student is not assigned to an active bus");
    await writeDailyState(
      ctx,
      previous,
      {
        studentId: student._id,
        studentName: student.fullName,
        campusId: campus._id,
        date: args.date,
        status: args.status,
        vehicleIdentifier: student.carNumber || undefined,
        vehicleType: bus ? "bus" : "car",
        reason,
        collectedBy:
          args.status === "picked_up_early" ? collectedBy : undefined,
        updatedBy: user._id,
        updatedByName: user.fullName ?? user.email ?? "",
        updatedAt: Date.now(),
      },
      user,
    );
    return null;
  },
});

// Called in the same transaction as queue removal; clearing a lane does not call this.
export async function recordDeparture(
  ctx: MutationCtx,
  entry: Doc<"dismissalQueue">,
  user: Doc<"users">,
) {
  const campus = await getCampusSettings(ctx.db, entry.campusLocation);
  if (!campus) throw new Error("Campus unavailable");
  const date = operationalDate();
  const bus = await isBus(ctx.db, entry.carNumber);
  if (bus && operationalDate(entry.assignedTime) !== date)
    throw new Error("Clear yesterday's bus before registering a new arrival");
  const roster = bus
    ? await rosterStudents(ctx.db, entry.carNumber, campus._id, date)
    : null;
  const students =
    roster?.map((s) => ({ studentId: s._id, name: s.fullName })) ??
    entry.students;
  const departing: { studentId: Id<"students">; name: string }[] = [];
  for (const student of students) {
    const previous = await getDailyState(
      ctx.db,
      campus._id,
      date,
      student.studentId,
    );
    if (bus && (!previous || previous.status === "pending"))
      throw new Error(
        "Resolve all pending students in the bus list before dispatching",
      );
    if (
      previous &&
      (previous.dropoff || ["picked_up_early", "not_traveling", "departed"].includes(previous.status))
    )
      continue;
    if (
      previous?.status === "boarded" &&
      previous.vehicleIdentifier !== entry.carNumber
    )
      throw new Error("A student boarded another vehicle");
    departing.push(student);
    await writeDailyState(
      ctx,
      previous,
      {
        studentId: student.studentId,
        studentName: student.name,
        campusId: campus._id,
        date,
        status: "departed",
        vehicleIdentifier: entry.carNumber,
        vehicleType: bus ? "bus" : "car",
        updatedBy: user._id,
        updatedByName: user.fullName ?? user.email ?? "",
        updatedAt: Date.now(),
      },
      user,
    );
  }
  return {
    students: departing,
    vehicleType: bus ? ("bus" as const) : ("car" as const),
  };
}
