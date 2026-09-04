/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { Webhook } from "svix";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { normalizeVehicleIdentifier } from "../lib/vehicle";
import { DAILY_RESET_UTC, nextOperationalDay, operationalDate } from "../lib/operational-day";
import { calculateTopArrivalsForMonth } from "./lib/dashboard_utils";
import { deleteUserWithClerk } from "./users";

const modules = import.meta.glob("./**/*.ts");

test("Recorded today combines early pickups and dispatched students while preserving correction permissions", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run(ctx => ctx.db.patch(ids.driver, { isActive: false }));
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId: ids.students[0], status: "picked_up_early",
    expectedRevision: 0, collectedBy: "Parent",
  });
  const arrival = await operator.mutation(api.queue.addCar, { campus: "School", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  const args = { campus: "School", date, paginationOpts: { numItems: 10, cursor: null } };
  const records = (await operator.query(api.studentDismissals.listRecordedDepartures, args)).page;
  expect(records).toHaveLength(3);
  expect(records.filter(r => r.status === "picked_up_early")).toHaveLength(1);
  expect(records.filter(r => r.status === "departed")).toHaveLength(2);
  expect(records.every(r => r.canCorrect === (r.status === "picked_up_early"))).toBe(true);
  const pickup = records.find(r => r.status === "picked_up_early")!;
  expect(pickup.collectedBy).toBe("Parent");
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: pickup.departureCampus, date, studentId: pickup.studentId, status: "pending",
    expectedRevision: pickup.revision, reason: "Wrong pickup",
  });
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, args)).page.map(r => r.status)).toEqual(["departed", "departed"]);
  await t.run(ctx => ctx.db.patch(ids.operator, { role: "principal" }));
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, args)).page.every(r => r.canCorrect)).toBe(true);
});

test("administrative departure corrections preserve history, audit the reason and return the student to pending", async () => {
  const { t, ids, operator, date, rosterArgs } = await setup();
  await t.run(ctx => ctx.db.patch(ids.driver, { isActive: false }));
  const arrival = await operator.mutation(api.queue.addCar, { campus: "School", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  const listArgs = { campus: "School", date, paginationOpts: { numItems: 2, cursor: null } };
  const first = await operator.query(api.studentDismissals.listRecordedDepartures, listArgs);
  expect(first.page).toHaveLength(2);
  expect(first.isDone).toBe(false);
  const second = await operator.query(api.studentDismissals.listRecordedDepartures, {
    ...listArgs, paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(1);
  const record = first.page[0];
  const history = await t.run(ctx => ctx.db.query("dismissalHistory").collect());
  await t.run(ctx => ctx.db.patch(ids.operator, { role: "principal" }));
  const correction = { campus: "School", date, departureId: record._id, expectedRevision: record.revision, reason: "  Wrong student dispatched  " };
  await operator.mutation(api.studentDismissals.correctDeparture, correction);
  expect(await t.run(ctx => ctx.db.get(record._id))).toMatchObject({
    status: "pending", revision: record.revision + 1, reason: "Wrong student dispatched", updatedBy: ids.operator,
  });
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, listArgs)).page.map(s => s.studentId)).not.toContain(record.studentId);
  expect((await operator.query(api.studentDismissals.getRoster, rosterArgs)).students.find(s => s.id === record.studentId)?.state?.status).toBe("pending");
  expect(await t.run(ctx => ctx.db.query("dismissalHistory").collect())).toEqual(history);
  expect(await t.run(ctx => ctx.db.query("dismissalQueue").collect())).toHaveLength(0);
  const audit = await t.run(ctx => ctx.db.query("auditLogs").collect());
  expect(audit.at(-1)).toMatchObject({ action: "student_dismissal_updated", userId: ids.operator,
    details: { before: { status: "departed" }, after: { status: "pending", reason: "Wrong student dispatched" } },
  });
  await expect(operator.mutation(api.studentDismissals.correctDeparture, correction)).rejects.toThrow("updated by someone else");
});

test("departure correction checks role, active principal, campus, date, reason and revision on the server", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run(ctx => ctx.db.patch(ids.driver, { isActive: false }));
  const arrival = await operator.mutation(api.queue.addCar, { campus: "School", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  const records = await t.run(ctx => ctx.db.query("studentDismissals").collect());
  const args = { campus: "School", date, departureId: records[0]._id, expectedRevision: records[0].revision, reason: "Mistake" };
  for (const role of ["operator", "dispatcher", "allocator", "viewer", "bus_driver"] as const) {
    await t.run(ctx => ctx.db.patch(ids.operator, { role }));
    await expect(operator.mutation(api.studentDismissals.correctDeparture, args)).rejects.toThrow();
  }
  await t.run(ctx => ctx.db.patch(ids.operator, { role: "principal", isActive: false }));
  await expect(operator.mutation(api.studentDismissals.correctDeparture, args)).rejects.toThrow("not active");
  await expect(operator.query(api.studentDismissals.listRecordedDepartures, { campus: "School", date, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow("not active");
  await t.run(ctx => ctx.db.patch(ids.operator, { isActive: true, status: "inactive" }));
  await expect(operator.mutation(api.studentDismissals.correctDeparture, args)).rejects.toThrow("not active");
  await t.run(ctx => ctx.db.patch(ids.operator, { status: "active" }));
  await expect(operator.mutation(api.studentDismissals.correctDeparture, { ...args, campus: "Other" })).rejects.toThrow("No access");
  await expect(operator.mutation(api.studentDismissals.correctDeparture, { ...args, date: "2000-01-01" })).rejects.toThrow("day changed");
  for (const reason of ["   ", "x".repeat(501)])
    await expect(operator.mutation(api.studentDismissals.correctDeparture, { ...args, reason })).rejects.toThrow("correction reason");
  await expect(operator.mutation(api.studentDismissals.correctDeparture, { ...args, expectedRevision: 0 })).rejects.toThrow("updated by someone else");
  expect(await t.run(ctx => ctx.db.query("studentDismissals").collect())).toEqual(records);
  for (const [index, role] of (["admin", "principal", "superadmin"] as const).entries()) {
    await t.run(ctx => ctx.db.patch(ids.operator, { role }));
    await operator.mutation(api.studentDismissals.correctDeparture, { ...args, departureId: records[index]._id });
  }
});

test("departed table follows student membership and correction never undoes another campus's early pickup", async () => {
  const { t, ids, operator, date, rosterArgs } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.driver, { isActive: false });
    await ctx.db.patch(ids.operator, { role: "principal", assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
  });
  const arrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId: ids.students[0], status: "picked_up_early", collectedBy: "Parent", expectedRevision: 0,
  });
  const paginationOpts = { numItems: 10, cursor: null };
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, { campus: "School", date, paginationOpts })).page.map(r => r.studentId)).toEqual([ids.students[0], ids.students[0]]);
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, { campus: "Other", date: "2000-01-01", paginationOpts })).page).toHaveLength(0);
  const record = (await operator.query(api.studentDismissals.listRecordedDepartures, { campus: "Other", date, paginationOpts })).page.find(s => s.studentId === ids.students[0] && s.status === "departed")!;
  // An administrator of the student's campus can correct the shown departure,
  // without requiring permission to manage all students at the originating campus.
  await t.run(ctx => ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus] }));
  await operator.mutation(api.studentDismissals.correctDeparture, {
    campus: "School", date, departureId: record._id, expectedRevision: record.revision, reason: "Wrong departure",
  });
  expect((await operator.query(api.studentDismissals.getRoster, rosterArgs)).students.find(s => s.id === ids.students[0])?.state?.status).toBe("picked_up_early");
});

test("membership filtering reaches other-campus departures through sparse pages and rejects unrelated corrections", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.driver, { isActive: false });
    await ctx.db.patch(ids.operator, { role: "principal", assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.otherStudent, { carNumber: 99 });
  });
  // Existing fallback calls School's students from Other.
  const schoolArrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: schoolArrival.queueId! });
  const otherArrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: 99, lane: "left" });
  await operator.mutation(api.queue.removeCar, { queueId: otherArrival.queueId! });
  await t.run(ctx => ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus] }));
  const args = { campus: "School", date, paginationOpts: { numItems: 1, cursor: null } };
  const first = await operator.query(api.studentDismissals.listRecordedDepartures, args);
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await operator.query(api.studentDismissals.listRecordedDepartures, { ...args, paginationOpts: { numItems: 10, cursor: first.continueCursor } });
  expect(new Set(next.page.map(r => r.studentId))).toEqual(new Set(ids.students));
  expect(next.page.every(r => r.departureCampus === "Other")).toBe(true);
  const foreignRecord = await t.run(ctx => ctx.db.query("studentDismissals").withIndex("by_studentId_date_status", q => q.eq("studentId", ids.otherStudent).eq("date", date).eq("status", "departed")).unique());
  await expect(operator.mutation(api.studentDismissals.correctDeparture, {
    campus: "School", date, departureId: foreignRecord!._id, expectedRevision: foreignRecord!.revision, reason: "Not my student",
  })).rejects.toThrow("does not belong");
  // Membership changes refresh the list and invalidate a previously opened correction.
  const record = next.page[0];
  await t.run(ctx => ctx.db.patch(record.studentId, { campuses: [ids.otherCampus] }));
  await expect(operator.mutation(api.studentDismissals.correctDeparture, {
    campus: "School", date, departureId: record._id, expectedRevision: record.revision, reason: "Stale selection",
  })).rejects.toThrow("does not belong");
  const refreshed = await operator.query(api.studentDismissals.listRecordedDepartures, { ...args, paginationOpts: { numItems: 10, cursor: null } });
  expect(refreshed.page.some(r => r._id === record._id)).toBe(false);
});

test("a bus identifier is global but its roster stays scoped to the selected campus", async () => {
  const { t, ids, operator, date } = await setup();
  // The driver belongs to School; the same bus visits Other next.
  await t.run(ctx => ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] }));
  const args = { campus: "Other", carNumber: "ABC-123", date };
  const arrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  expect(arrival.success).toBe(true);
  const queue = await operator.query(api.queue.getCurrentQueue, { campus: "Other" });
  expect(queue.leftLane[0].vehicleType).toBe("bus");
  expect(queue.leftLane[0].students.map(s => s.studentId)).toEqual([ids.otherStudent]);
  const roster = await operator.query(api.studentDismissals.getRoster, args);
  expect(roster.isBus).toBe(true);
  expect(roster.canEdit).toBe(true);
  expect(roster.students.map(s => s.id)).toEqual([ids.otherStudent]);
  await operator.mutation(api.studentDismissals.setStatus, { campus: "Other", date, studentId: ids.otherStudent, status: "boarded", expectedRevision: 0 });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  expect((await t.run(ctx => ctx.db.query("dismissalHistory").collect()))[0]).toMatchObject({ vehicleType: "bus", studentIds: [ids.otherStudent] });

  // No local assignments must not expand the bus roster to all campuses.
  await t.run(ctx => ctx.db.patch(ids.otherStudent, { carNumber: 0 }));
  const secondArrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "right" });
  expect(secondArrival).toMatchObject({ success: false, error: "NO_STUDENTS_FOUND" });
  expect((await operator.query(api.studentDismissals.getRoster, args)).students).toEqual([]);
  expect((await operator.query(api.queue.getCurrentQueue, { campus: "Other" })).totalCars).toBe(0);
  for (const studentId of ids.students) {
    await expect(operator.mutation(api.studentDismissals.setStatus, { campus: "Other", date, studentId, status: "boarded", expectedRevision: 0 })).rejects.toThrow("does not belong");
  }
  expect(await t.run(ctx => ctx.db.query("dismissalHistory").collect())).toHaveLength(1);
  // The legacy fallback is unchanged for normal cars.
  await t.run(ctx => ctx.db.patch(ids.driver, { isActive: false }));
  const carArrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "right" });
  expect(carArrival.success).toBe(true);
  expect((await operator.query(api.queue.getCurrentQueue, { campus: "Other" })).rightLane[0].students.map(s => s.studentId).sort()).toEqual([...ids.students].sort());
});

test("legacy bus queue snapshots cannot leak foreign students into viewer or dispatch", async () => {
  const { t, ids, operator, driver, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.driver, { assignedCampuses: [ids.campus, ids.otherCampus] });
  });
  const arrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  await t.run(async ctx => {
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    await ctx.db.patch(arrival.queueId!, { students: [{ studentId: ids.students[0], name: "Sofia Martinez", grade: "5th" }] });
  });
  const args = { campus: "Other", carNumber: "ABC-123", date };
  expect((await driver.query(api.studentDismissals.getRoster, args)).students).toEqual([]);
  expect((await operator.query(api.studentDismissals.getRoster, args)).students).toEqual([]);
  expect((await operator.query(api.queue.getCurrentQueue, { campus: "Other" })).leftLane[0].students).toEqual([]);
  for (const status of ["boarded", "not_traveling", "pending"] as const) {
    await expect(driver.mutation(api.studentDismissals.setStatus, { campus: "Other", date, studentId: ids.students[0], status, reason: "Test", expectedRevision: 0 })).rejects.toThrow("does not belong");
  }
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  expect((await t.run(ctx => ctx.db.query("dismissalHistory").collect()))[0].studentIds).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("studentDismissals").collect())).toEqual([]);
});

test.each(["dispatch", "undo"])("legacy boarding survives another student's local assignment and supports %s", async (action) => {
  const { t, ids, operator, driver, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { role: "principal", assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.driver, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
  });
  const args = { campus: "Other", carNumber: "ABC-123", date };
  const arrival = await operator.mutation(api.queue.addCar, { campus: args.campus, carNumber: args.carNumber, lane: "left" });
  await driver.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId: ids.students[0], status: "boarded", expectedRevision: 0,
  });
  // Simulate a boarding left by the former cross-campus fallback.
  await t.run(ctx => ctx.db.patch(ids.students[0], { campuses: [ids.campus] }));
  const before = await driver.query(api.studentDismissals.getRoster, args);
  expect(before.students.map(s => s.id)).toEqual([ids.students[0]]);
  expect(before.students.filter(s => s.id === ids.students[0])).toHaveLength(1);

  await operator.mutation(api.students.assignCarNumber, { studentId: ids.otherStudent, carNumber: "ABC-123" });
  const roster = await driver.query(api.studentDismissals.getRoster, args);
  expect(roster).toEqual(await operator.query(api.studentDismissals.getRoster, args));
  expect(roster.students.map(s => s.id).sort()).toEqual([ids.otherStudent, ids.students[0]].sort());
  expect(roster.students.find(s => s.id === ids.students[0])?.state?.status).toBe("boarded");
  expect((await operator.query(api.queue.getCurrentQueue, { campus: "Other" })).leftLane[0].students.map(s => s.studentId).sort()).toEqual([ids.otherStudent, ids.students[0]].sort());
  expect((await driver.query(api.studentDismissals.getRoster, { ...args, date: "2099-01-01" })).students.map(s => s.id)).toEqual([ids.otherStudent]);

  if (action === "undo") {
    await driver.mutation(api.studentDismissals.setStatus, {
      campus: "Other", date, studentId: ids.students[0], status: "pending", expectedRevision: 1,
    });
    expect((await driver.query(api.studentDismissals.getRoster, args)).students.map(s => s.id)).toEqual([ids.otherStudent]);
  }
  await expect(operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! })).rejects.toThrow("pending");
  expect(await t.run(ctx => ctx.db.get(arrival.queueId!))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.query("dismissalHistory").collect())).toHaveLength(0);
  await driver.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId: ids.otherStudent, status: "boarded", expectedRevision: 0,
  });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  const history = (await t.run(ctx => ctx.db.query("dismissalHistory").collect()))[0];
  expect([...history.studentIds].sort()).toEqual(
    (action === "dispatch" ? [ids.otherStudent, ids.students[0]] : [ids.otherStudent]).sort(),
  );
  expect(history.studentNames).toContain("Other Student");
  if (action === "dispatch") expect(history.studentNames).toContain("Sofia Martinez");
  const state = await t.run(ctx => ctx.db.query("studentDismissals")
    .withIndex("by_campusId_date_studentId", q => q.eq("campusId", ids.otherCampus).eq("date", date).eq("studentId", ids.students[0])).unique());
  expect(state?.status).toBe(action === "dispatch" ? "departed" : "pending");
});

test.each(["campus", "vehicle", "date", "not_traveling", "departed"])("roster retention excludes a daily state with a different %s", async (difference) => {
  const { t, ids, operator, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { assignedCampuses: [ids.otherCampus] });
    await ctx.db.insert("studentDismissals", {
      studentId: ids.students[0],
      studentName: "Sofia Martinez",
      campusId: difference === "campus" ? ids.campus : ids.otherCampus,
      date: difference === "date" ? "2000-01-01" : date,
      vehicleIdentifier: difference === "vehicle" ? "XYZ-987" : "ABC-123",
      status: difference === "not_traveling" || difference === "departed" ? difference : "boarded",
      revision: 1,
      updatedBy: ids.operator,
      updatedByName: "Operator",
      updatedAt: Date.now(),
    });
  });
  const roster = await operator.query(api.studentDismissals.getRoster, {
    campus: "Other", carNumber: "ABC-123", date,
  });
  expect(roster.students.map(s => s.id)).toEqual([ids.otherStudent]);
});

test.each([true, false])("early pickup remains visible across campuses and is excluded from dispatch (bus: %s)", async (bus) => {
  const { t, ids, operator, driver, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.driver, { assignedCampuses: [ids.otherCampus], isActive: bus });
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    for (const studentId of ids.students)
      await ctx.db.patch(studentId, { campuses: [ids.campus, ids.otherCampus] });
  });
  const args = { campus: "Other", carNumber: "ABC-123", date };
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId: ids.students[0], status: "picked_up_early",
    collectedBy: "Parent", expectedRevision: 0,
  });
  const recorded = (await operator.query(api.studentDismissals.searchPickupStudents, {
    campus: "School", date, search: "Sofia",
  })).students[0].state!;
  const beforeArrival = await operator.query(api.studentDismissals.getRoster, args);
  expect(beforeArrival.inQueue).toBe(false);
  expect(beforeArrival.students[0].state).toEqual(recorded);

  const arrival = await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  if (bus) {
    expect((await driver.query(api.studentDismissals.getRoster, args)).students[0].state).toEqual(recorded);
    await expect(driver.mutation(api.studentDismissals.setStatus, {
      campus: "Other", date, studentId: ids.students[0], status: "boarded", expectedRevision: 1,
    })).rejects.toThrow("staff");
    await expect(operator.mutation(api.studentDismissals.setStatus, {
      campus: "Other", date, studentId: ids.students[0], status: "boarded", expectedRevision: 0,
    })).rejects.toThrow("someone else");
    await expect(operator.mutation(api.studentDismissals.setStatus, {
      campus: "Other", date, studentId: ids.students[0], status: "boarded", expectedRevision: 1,
    })).rejects.toThrow("Correct the early pickup");
    for (const studentId of ids.students.slice(1)) {
      await driver.mutation(api.studentDismissals.setStatus, {
        campus: "Other", date, studentId, status: "boarded", expectedRevision: 0,
      });
    }
  }
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  expect((await t.run(ctx => ctx.db.query("dismissalHistory").collect()))[0]).toMatchObject({
    vehicleType: bus ? "bus" : "car", studentIds: ids.students.slice(1),
  });
  const states = await t.run(ctx => ctx.db.query("studentDismissals").collect());
  expect(states.filter(s => s.studentId === ids.students[0])).toEqual([recorded]);
  expect((await operator.query(api.studentDismissals.getRoster, args)).students[0].state).toEqual(recorded);
  expect((await operator.query(api.studentDismissals.getRoster, { ...args, date: "2099-01-01" })).students[0].state).toBeNull();
});

test("early pickup overrides a local state without copying it; correction stays at the recording campus", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
  });
  const studentId = ids.students[0];
  const args = { campus: "Other", carNumber: "ABC-123", date };
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId, status: "pending", expectedRevision: 0,
  });
  const initial = (await operator.query(api.studentDismissals.getRoster, args)).students[0].state!;
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId, status: "picked_up_early", collectedBy: "Parent", expectedRevision: 0,
  });
  const pickup = (await operator.query(api.studentDismissals.getRoster, args)).students[0].state!;
  expect(pickup).toMatchObject({ status: "picked_up_early", campusId: ids.campus });
  expect(pickup._id).not.toBe(initial._id);
  const search = await operator.query(api.studentDismissals.searchPickupStudents, { campus: "Other", date, search: "Sofia" });
  expect(search.students[0].state).toEqual(pickup);
  await expect(operator.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId, status: "picked_up_early", collectedBy: "Parent", expectedRevision: 1,
  })).rejects.toThrow("Correct the early pickup");
  await expect(operator.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId, status: "not_traveling", reason: "Absent", expectedRevision: 0,
  })).rejects.toThrow("someone else");
  await expect(operator.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId, status: "pending", reason: "Mistake", expectedRevision: 1,
  })).rejects.toThrow("campus where it was recorded");
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId, status: "pending", reason: "Wrong student", expectedRevision: 1,
  });
  const corrected = (await operator.query(api.studentDismissals.getRoster, args)).students[0].state!;
  expect(corrected).toEqual(initial);
  const states = await t.run(ctx => ctx.db.query("studentDismissals").collect());
  expect(states).toHaveLength(2);
  expect(states.find(s => s._id === pickup._id)).toMatchObject({ status: "pending", revision: 2, campusId: ids.campus });
  expect((await operator.query(api.studentDismissals.listRecordedDepartures, { campus: "School", date, paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(0);
});

test.each(["School", "Other"])("a student boarded at %s cannot disappear through assignment edits or deletion", async (campus) => {
  const { t, ids, operator, driver, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.driver, { assignedCampuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
  });
  await operator.mutation(api.queue.addCar, {
    campus,
    carNumber: "ABC-123",
    lane: "left",
  });
  await driver.mutation(api.studentDismissals.setStatus, {
    campus,
    date,
    studentId: ids.students[0],
    status: "boarded",
    expectedRevision: 0,
  });
  await t.run(async ctx => {
    // Preserve the regression for an actual boarding outside the student's membership.
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus] });
    await ctx.db.patch(ids.operator, { role: "principal" });
  });
  await expect(operator.mutation(api.students.update, {
    studentId: ids.students[0], campuses: [ids.otherCampus],
  })).rejects.toThrow("pending");
  await expect(
    operator.mutation(api.students.update, {
      studentId: ids.students[0],
      carNumber: 11,
    }),
  ).rejects.toThrow("pending");
  await expect(
    operator.mutation(api.students.assignCarNumber, {
      studentId: ids.students[0],
      carNumber: 11,
    }),
  ).rejects.toThrow("pending");
  await expect(
    operator.mutation(api.students.removeCarNumber, {
      studentId: ids.students[0],
    }),
  ).rejects.toThrow("pending");
  await expect(
    operator.mutation(api.students.deleteStudent, {
      studentId: ids.students[0],
    }),
  ).rejects.toThrow("pending");
  await expect(
    operator.mutation(api.students.deleteMultipleStudents, {
      studentIds: [ids.students[0]],
    }),
  ).rejects.toThrow("pending");
  expect((await driver.query(api.studentDismissals.getRoster, {
    campus, carNumber: "ABC-123", date,
  })).students.map(s => s.id)).toContain(ids.students[0]);
  expect(await t.run(ctx => ctx.db.get(ids.students[0]))).toMatchObject({
    carNumber: "ABC-123", campuses: [ids.campus],
  });
  await driver.mutation(api.studentDismissals.setStatus, {
    campus,
    date,
    studentId: ids.students[0],
    status: "pending",
    expectedRevision: 1,
  });
  await operator.mutation(api.students.assignCarNumber, {
    studentId: ids.students[0],
    carNumber: 11,
  });
  expect((await t.run((ctx) => ctx.db.get(ids.students[0])))?.carNumber).toBe(
    11,
  );
});

test.each(["Pacific/Honolulu", "Asia/Tokyo"])("boarding guard uses the shared day regardless of campus timezone (%s)", async (timezone) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = Date.UTC(2026, 8, 4, 2);
  vi.setSystemTime(now);
  try {
    const { t, ids, operator } = await setup();
    await t.run(async ctx => {
      await ctx.db.patch(ids.otherCampus, { timezone });
      await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
      await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
      await ctx.db.patch(ids.operator, { assignedCampuses: [ids.campus, ids.otherCampus] });
    });
    await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
    await operator.mutation(api.studentDismissals.setStatus, {
      campus: "Other", date: operationalDate(), studentId: ids.students[0], status: "boarded", expectedRevision: 0,
    });
    await t.run(ctx => ctx.db.patch(ids.students[0], { campuses: [ids.campus] }));
    await t.run(ctx => ctx.db.patch(ids.operator, { role: "principal", assignedCampuses: [ids.campus] }));
    await expect(operator.mutation(api.students.assignCarNumber, {
      studentId: ids.students[0], carNumber: 11,
    })).rejects.toThrow("pending");
    vi.setSystemTime(now + 24 * 60 * 60 * 1000);
    await operator.mutation(api.students.assignCarNumber, { studentId: ids.students[0], carNumber: 11 });
    expect(await t.run(ctx => ctx.db.get(ids.students[0]))).toMatchObject({ carNumber: 11 });
  } finally {
    vi.useRealTimers();
  }
});

test("a confirmed early pickup overrides a boarding at another campus for assignment edits", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.otherStudent, { carNumber: 0 });
    await ctx.db.patch(ids.students[0], { campuses: [ids.campus, ids.otherCampus] });
    await ctx.db.patch(ids.operator, { role: "principal", assignedCampuses: [ids.campus, ids.otherCampus] });
  });
  await operator.mutation(api.queue.addCar, { campus: "Other", carNumber: "ABC-123", lane: "left" });
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "Other", date, studentId: ids.students[0], status: "boarded", expectedRevision: 0,
  });
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School", date, studentId: ids.students[0], status: "picked_up_early", collectedBy: "Parent", expectedRevision: 0,
  });
  await operator.mutation(api.students.assignCarNumber, { studentId: ids.students[0], carNumber: 11 });
  expect(await t.run(ctx => ctx.db.get(ids.students[0]))).toMatchObject({ carNumber: 11 });
});

test.each(["principal", "admin", "superadmin"] as const)(
  "inactive %s cannot call Clerk management actions",
  async (role) => {
    const { t, ids, operator } = await setup();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected Clerk request"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
    try {
      // Either flag must deny access, even when the other still says active.
      for (const state of [
        { isActive: false, status: "active" as const },
        { isActive: true, status: "inactive" as const },
      ]) {
        await t.run(ctx => ctx.db.patch(ids.operator, { role, ...state }));
        await expect(operator.action(api.users.createUserWithClerk, {
          username: "blocked_driver", password: "test-password-only",
          firstName: "Blocked", lastName: "Driver", role: "bus_driver",
          assignedCampuses: [ids.campus], busNumber: 999,
        })).rejects.toThrow("User not active in system");
        await expect(operator.action(api.users.updateUserWithClerk, {
          clerkUserId: "driver", firstName: "Changed",
        })).rejects.toThrow("User not active in system");
        await expect(operator.action(api.users.deleteUserWithClerk, {
          clerkUserId: "driver",
        })).rejects.toThrow("User not active in system");
        await expect(operator.action(api.users.updateClerkProfileImage, {
          clerkUserId: "driver", avatarStorageId: null,
        })).rejects.toThrow("User not active in system");
      }
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await t.run(ctx => ctx.db.get(ids.driver))).toMatchObject({ fullName: "Driver", isActive: true });
      // Legacy active accounts can omit status; the caller is resolved from auth.
      await t.run(ctx => ctx.db.patch(ids.operator, { isActive: true, status: undefined }));
      expect(await operator.query(internal.users.checkManagementPermissions, {})).toMatchObject({
        _id: ids.operator, role,
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  },
);

test.each(["principal", "admin", "superadmin"] as const)("inactive %s cannot list users or create temporary records", async (role) => {
  const { t, ids, operator } = await setup();
  for (const state of [
    { isActive: false, status: "active" as const },
    { isActive: true, status: "inactive" as const },
    { isActive: false, status: undefined },
  ]) {
    await t.run(ctx => ctx.db.patch(ids.operator, { role, ...state }));
    const before = await t.run(ctx => ctx.db.query("users").collect());
    await expect(operator.query(api.users.listUsers, {})).rejects.toThrow("User not active in system");
    await expect(operator.mutation(api.users.createTempUser, {
      email: "blocked@example.test", firstName: "Blocked", lastName: "User",
      role: "allocator", assignedCampuses: [ids.campus],
    })).rejects.toThrow("User not active in system");
    expect(await t.run(ctx => ctx.db.query("users").collect())).toEqual(before);
  }
});

test("user listing and temporary creation reject unauthenticated, missing and non-management callers", async () => {
  const { t, ids, operator } = await setup();
  const deny = async (caller: typeof operator) => {
    await expect(caller.query(api.users.listUsers, {})).rejects.toThrow();
    await expect(caller.mutation(api.users.createTempUser, {
      email: "blocked@example.test", firstName: "Blocked", lastName: "User",
      role: "allocator", assignedCampuses: [ids.campus],
    })).rejects.toThrow();
  };
  await deny(t);
  await deny(t.withIdentity({ subject: "missing-user" }));
  for (const role of ["operator", "allocator", "dispatcher", "viewer", "bus_driver"] as const) {
    await t.run(ctx => ctx.db.patch(ids.operator, { role }));
    await deny(operator);
  }
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(2);
});

test.each(["principal", "admin", "superadmin"] as const)("active %s retains listing filters and temporary-user creation scope", async (role) => {
  const { t, ids, operator } = await setup();
  const foreignId = await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { role });
    return ctx.db.insert("users", {
      clerkId: "foreign", role: "viewer", assignedCampuses: [ids.otherCampus],
      isActive: false, status: "inactive", createdAt: Date.now(),
    });
  });
  const visible = await operator.query(api.users.listUsers, {});
  expect(visible.map(user => user._id).sort()).toEqual(
    (role === "superadmin" ? [ids.operator, ids.driver, foreignId] : [ids.operator, ids.driver]).sort(),
  );
  expect((await operator.query(api.users.listUsers, { role: "bus_driver", assignedCampus: ids.campus })).map(user => user._id)).toEqual([ids.driver]);
  expect((await operator.query(api.users.listUsers, { status: "inactive", assignedCampus: ids.otherCampus })).map(user => user._id)).toEqual(role === "superadmin" ? [foreignId] : []);
  const args = { email: "temp@example.test", firstName: "Temp", lastName: "User", role: "allocator" as const, assignedCampuses: [ids.campus] };
  // Both explicit-active and legacy accounts without status remain supported.
  for (const status of [undefined, "active"] as const) {
    await t.run(ctx => ctx.db.patch(ids.operator, { status }));
    const userId = await operator.mutation(api.users.createTempUser, { ...args, email: `${status ?? "legacy"}@example.test` });
    expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({
      clerkId: expect.stringMatching(/^temp_/), role: "allocator", assignedCampuses: [ids.campus], isActive: false,
    });
  }
  if (role !== "superadmin") {
    await expect(operator.mutation(api.users.createTempUser, { ...args, assignedCampuses: [ids.otherCampus] })).rejects.toThrow("outside your scope");
    await expect(operator.mutation(api.users.createTempUser, { ...args, role: "superadmin" })).rejects.toThrow("Only superadmin");
    await expect(operator.mutation(api.users.createTempUser, { ...args, role: "principal" })).rejects.toThrow("Principals can only manage");
  } else {
    await operator.mutation(api.users.createTempUser, { ...args, role: "principal", assignedCampuses: [ids.otherCampus] });
  }
});

test("management authorization rejects unauthenticated, missing and non-management callers", async () => {
  const { t, operator } = await setup();
  await expect(t.query(internal.users.checkManagementPermissions, {})).rejects.toThrow("Not authenticated");
  await expect(t.withIdentity({ subject: "missing-user" }).query(
    internal.users.checkManagementPermissions, {},
  )).rejects.toThrow("User not active in system");
  await expect(operator.query(internal.users.checkManagementPermissions, {})).rejects.toThrow("Requires role");
});

test("driver creation uses username/password without email or bypassing Clerk checks, and enforces campus scope", async () => {
  const { t, ids, operator } = await setup();
  await t.run((ctx) => ctx.db.patch(ids.operator, { role: "principal" }));
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async (_url, init) => {
        if (String(_url).endsWith("/invitations")) return new Response("{}", { status: 200 });
        const { username, first_name, last_name, email_address, public_metadata } = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          id: username ? "new-driver" : "new-staff", updated_at: 100, username, first_name, last_name,
          email_addresses: (email_address ?? []).map((email_address: string) => ({ email_address })),
          public_metadata,
        }), { status: 200 });
      },
    );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  try {
    const args = {
      username: " bus_driver_11 ",
      password: "test-password-only",
      firstName: "Bus",
      lastName: "Driver",
      role: "bus_driver" as const,
      assignedCampuses: [ids.campus],
      busNumber: " ab c-123 ",
    };
    await operator.action(api.users.createUserWithClerk, args);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.username).toBe("bus_driver_11");
    expect(body.password).toBe(args.password);
    expect(body).not.toHaveProperty("email_address");
    expect(body).not.toHaveProperty("skip_password_checks");
    expect(body).not.toHaveProperty("skip_password_requirement");
    expect(body.public_metadata).not.toHaveProperty("password");
    const visibleDrivers = await operator.query(api.users.listUsers, { role: "bus_driver" });
    const createdDriver = visibleDrivers.find((user) => user.clerkId === "new-driver");
    expect(createdDriver).toMatchObject({ username: "bus_driver_11", role: "bus_driver", busNumber: "ABC-123" });
    const clerkData = { ...body, id: "new-driver", updated_at: 100 };
    delete clerkData.password;
    await t.mutation(internal.users.upsertFromClerk, { data: clerkData });
    const afterWebhook = await operator.query(api.users.listUsers, { role: "bus_driver" });
    expect(afterWebhook.filter((user) => user.clerkId === "new-driver").map(user => user._id)).toEqual([createdDriver?._id]);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).public_metadata,
    ).toMatchObject({
      role: "bus_driver",
      busNumber: "ABC-123",
      assignedCampuses: [ids.campus],
    });
    await expect(
      operator.action(api.users.createUserWithClerk, {
        ...args,
        assignedCampuses: [ids.otherCampus],
      }),
    ).rejects.toThrow("outside your scope");
    await expect(
      operator.action(api.users.createUserWithClerk, {
        ...args,
        busNumber: "",
      }),
    ).rejects.toThrow();
    await expect(operator.action(api.users.createUserWithClerk, { ...args, username: " " })).rejects.toThrow("username");
    await expect(operator.action(api.users.createUserWithClerk, { ...args, password: undefined })).rejects.toThrow("password");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{
      code: "form_identifier_exists", long_message: "That username is taken. Please try another.",
    }] }), { status: 422 }));
    await expect(operator.action(api.users.createUserWithClerk, args)).rejects.toThrow("That username is taken.");

    fetchMock.mockClear();
    await operator.action(api.users.createUserWithClerk, {
      email: "staff@example.test", firstName: "Staff", lastName: "Member",
      role: "allocator", assignedCampuses: [ids.campus],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ email_address: ["staff@example.test"] });

    fetchMock.mockImplementation(async (_url, init) => new Response(JSON.stringify({
      ...clerkData, ...(init?.method === "PATCH" ? { ...JSON.parse(String(init.body)), updated_at: 200 } : {}),
    }), { status: 200 }));
    await operator.action(api.users.updateUserWithClerk, { clerkUserId: "new-driver", username: "renamed_driver" });
    expect((await operator.query(api.users.listUsers, { role: "bus_driver" })).find(user => user.clerkId === "new-driver")?.username).toBe("renamed_driver");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ...clerkData, id: "unsynchronized-driver",
      public_metadata: { ...clerkData.public_metadata, assignedCampuses: ["invalid-campus-id"] },
    }), { status: 200 }));
    await expect(operator.action(api.users.createUserWithClerk, args)).rejects.toThrow("Do not create it again");
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test.each([
  { status: 200, webhookFirst: false },
  { status: 404, webhookFirst: false },
  { status: 200, webhookFirst: true },
])("driver deletion is synchronized before success: %j", async ({ status, webhookFirst }) => {
  const { t, ids, operator, date } = await setup();
  const avatar = await t.run(async ctx => {
    await ctx.db.patch(ids.operator, { role: "principal" });
    const id = await ctx.storage.store(new Blob(["test-avatar"], { type: "image/png" }));
    await ctx.db.patch(ids.driver, { avatarStorageId: id });
    return id;
  });
  const arrival = await operator.mutation(api.queue.addCar, { campus: "School", carNumber: "ABC-123", lane: "left" });
  const students = await t.run(ctx => ctx.db.query("students").collect());
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
    if (webhookFirst) await t.mutation(internal.users.deleteFromClerk, { clerkUserId: "driver" });
    return new Response("{}", { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    expect(await operator.action(api.users.deleteUserWithClerk, { clerkUserId: "driver" })).toMatchObject({ success: true });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://api.clerk.com/v1/users/driver", expect.objectContaining({ method: "DELETE" }));
    expect(await t.run(ctx => ctx.db.get(ids.driver))).toBeNull();
    expect(await t.run(ctx => ctx.storage.get(avatar))).toBeNull();
    expect(await operator.query(api.users.listUsers, { role: "bus_driver" })).toHaveLength(0);
    expect((await operator.query(api.queue.getCurrentQueue, { campus: "School" })).leftLane[0]).toMatchObject({ _id: arrival.queueId, vehicleType: "car" });
    expect((await operator.query(api.studentDismissals.getRoster, { campus: "School", carNumber: "ABC-123", date })).isBus).toBe(false);
    // Late/repeated webhook deliveries reuse this same idempotent mutation.
    await t.mutation(internal.users.deleteFromClerk, { clerkUserId: "driver" });
    await t.mutation(internal.users.deleteFromClerk, { clerkUserId: "driver" });
    expect(await t.run(ctx => ctx.db.query("students").collect())).toEqual(students);
    expect(await t.run(ctx => ctx.db.get(ids.operator))).not.toBeNull();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test.each([401, 403, 429, 500, "network"])("failed Clerk deletion (%s) preserves the Convex user", async (failure) => {
  const { t, ids, operator } = await setup();
  await t.run(ctx => ctx.db.patch(ids.operator, { role: "principal" }));
  const before = await t.run(ctx => ctx.db.get(ids.driver));
  const fetchMock = vi.fn<typeof fetch>();
  if (failure === "network") fetchMock.mockRejectedValue(new Error("Network unavailable"));
  else fetchMock.mockResolvedValue(new Response("Clerk failure", { status: failure as number }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  try {
    await expect(operator.action(api.users.deleteUserWithClerk, { clerkUserId: "driver" })).rejects.toThrow("Failed to delete user");
    expect(await t.run(ctx => ctx.db.get(ids.driver))).toEqual(before);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test("partial deletion reports the Convex failure and can retry after Clerk returns 404", async () => {
  // Inject only the failing boundary; the real action handler controls ordering/errors.
  const ctx = {
    runQuery: vi.fn().mockResolvedValue({ role: "superadmin" }),
    runMutation: vi.fn().mockRejectedValueOnce(new Error("Convex unavailable")).mockResolvedValue(null),
  };
  const actor = { role: "superadmin" };
  const target = { role: "bus_driver" };
  ctx.runQuery.mockResolvedValueOnce(actor).mockResolvedValueOnce(target)
    .mockResolvedValueOnce(actor).mockResolvedValueOnce(target);
  const handler = Reflect.get(deleteUserWithClerk, "_handler") as (
    context: typeof ctx, args: { clerkUserId: string },
  ) => Promise<unknown>;
  const fetchMock = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("{}", { status: 200 }))
    .mockResolvedValueOnce(new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  try {
    await expect(handler(ctx, { clerkUserId: "driver" })).rejects.toThrow("deleted in Clerk, but could not be removed from the app");
    expect(await handler(ctx, { clerkUserId: "driver" })).toMatchObject({ success: true });
    expect(ctx.runMutation).toHaveBeenCalledTimes(2);
    expect(ctx.runMutation).toHaveBeenLastCalledWith(internal.users.deleteFromClerk, { clerkUserId: "driver" });
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test("webhook synchronization failures return 500 for retry; valid retries are idempotent", async () => {
  const { t, ids } = await setup();
  const secret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";
  vi.stubEnv("CLERK_WEBHOOK_SECRET", secret);
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  const data = { id: "webhook-driver", updated_at: 100, username: "webhook_driver", public_metadata: {
    role: "bus_driver", busNumber: 123, assignedCampuses: ["invalid-campus-id"],
  } };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })));
  const send = async () => {
    const body = JSON.stringify({ type: "user.created", data });
    const date = new Date();
    return t.fetch("/clerk-users-webhook", { method: "POST", body, headers: {
      "svix-id": "msg_test", "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": new Webhook(secret).sign("msg_test", date, body),
    } });
  };
  try {
    expect((await send()).status).toBe(500);
    data.public_metadata.assignedCampuses = [ids.campus];
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect(await t.run(ctx => ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", data.id)).collect())).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test("username-only Clerk webhooks preserve IDs, sync usernames and never invent email or store passwords", async () => {
  const { t, ids } = await setup();
  const data = {
    id: "username-only-driver", updated_at: 100, username: "driver_11", email_addresses: [],
    first_name: "Bus", last_name: "Driver", password: "must-not-be-stored",
    public_metadata: { role: "bus_driver", busNumber: 11, assignedCampuses: [ids.campus] },
  };
  await t.mutation(internal.users.upsertFromClerk, { data });
  const read = () => t.run((ctx) => ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", data.id)).unique());
  const before = await read();
  expect(before?.username).toBe("driver_11");
  expect(before).not.toHaveProperty("email");
  expect(before).not.toHaveProperty("password");
  await t.mutation(internal.users.upsertFromClerk, { data: { ...data, updated_at: 200, username: "driver_12" } });
  const after = await read();
  expect(after?._id).toBe(before?._id);
  expect(after?.username).toBe("driver_12");
});

test("normal vehicles still dispatch without a checklist and exclude confirmed early pickups", async () => {
  const { t, ids, operator, date } = await setup();
  await t.run((ctx) => ctx.db.patch(ids.driver, { isActive: false }));
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[0],
    status: "picked_up_early",
    collectedBy: "Parent",
    expectedRevision: 0,
  });
  const arrival = await operator.mutation(api.queue.addCar, {
    campus: "School",
    carNumber: "ABC-123",
    lane: "right",
  });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  expect(
    (await t.run((ctx) => ctx.db.query("dismissalHistory").collect()))[0],
  ).toMatchObject({ vehicleType: "car", studentIds: ids.students.slice(1) });
});

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const campus = await ctx.db.insert("campusSettings", {
      campusName: "School",
      timezone: "America/Bogota",
      allowMultipleStudentsPerCar: true,
      requireCarNumber: false,
      isActive: true,
      status: "active",
      createdAt: Date.now(),
    });
    const otherCampus = await ctx.db.insert("campusSettings", {
      campusName: "Other",
      timezone: "America/Bogota",
      allowMultipleStudentsPerCar: true,
      requireCarNumber: false,
      isActive: true,
      status: "active",
      createdAt: Date.now(),
    });
    const operator = await ctx.db.insert("users", {
      clerkId: "operator",
      role: "operator",
      assignedCampuses: [campus],
      isActive: true,
      fullName: "Operator",
      createdAt: Date.now(),
    });
    const driver = await ctx.db.insert("users", {
      clerkId: "driver",
      role: "bus_driver",
      busNumber: "ABC-123",
      assignedCampuses: [campus],
      isActive: true,
      fullName: "Driver",
      createdAt: Date.now(),
    });
    const students = [];
    for (const name of ["Sofia Martinez", "Ana Lopez", "Carlos Garcia"])
      students.push(
        await ctx.db.insert("students", {
          firstName: name.split(" ")[0],
          lastName: name.split(" ")[1],
          fullName: name,
          grade: "5th",
          campuses: [campus],
          birthday: "01/01/2015",
          carNumber: "ABC-123",
          isActive: true,
          createdAt: Date.now(),
        }),
      );
    const otherStudent = await ctx.db.insert("students", {
      firstName: "Other",
      lastName: "Student",
      fullName: "Other Student",
      grade: "5th",
      campuses: [otherCampus],
      birthday: "01/01/2015",
      carNumber: "ABC-123",
      isActive: true,
      createdAt: Date.now(),
    });
    return { campus, otherCampus, operator, driver, students, otherStudent };
  });
  const operator = t.withIdentity({ subject: "operator" });
  const driver = t.withIdentity({ subject: "driver" });
  const date = operationalDate();
  const rosterArgs = { campus: "School", carNumber: "ABC-123", date };
  return { t, ids, operator, driver, date, rosterArgs };
}

test("identifiers preserve numeric assignments and normalize plates without accepting invalid numbers", () => {
  expect(normalizeVehicleIdentifier(" 0011 ")).toBe(11);
  expect(normalizeVehicleIdentifier(" ab c-123 ")).toBe("ABC-123");
  expect(normalizeVehicleIdentifier("", true)).toBe(0);
  for (const invalid of ["", 0, -1, 1.2, Infinity, "AB/123", "A".repeat(21)])
    expect(() => normalizeVehicleIdentifier(invalid)).toThrow();
  expect(operationalDate(Date.UTC(2026, 8, 4, 2))).toBe(
    "2026-09-03",
  );
});

test("early pickup before arrival, shared roster, boarding, conflict detection and dispatch survive queue deletion", async () => {
  const { t, ids, operator, driver, date, rosterArgs } = await setup();
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[0],
    status: "picked_up_early",
    collectedBy: "Parent",
    expectedRevision: 0,
  });
  expect(
    (
      await driver.query(api.studentDismissals.getRoster, rosterArgs)
    ).students.map((s) => s.state?.status ?? "pending"),
  ).toEqual(["picked_up_early", "pending", "pending"]);
  expect(
    await t.run((ctx) => ctx.db.query("dismissalQueue").collect()),
  ).toHaveLength(0);
  await expect(
    driver.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[1],
      status: "boarded",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("not arrived");
  const arrival = await operator.mutation(api.queue.addCar, {
    campus: "School",
    carNumber: " abc-123 ",
    lane: "left",
  });
  expect(arrival.success).toBe(true);
  await expect(
    operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! }),
  ).rejects.toThrow("pending");
  await driver.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[1],
    status: "boarded",
    expectedRevision: 0,
  });
  await expect(
    operator.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[1],
      status: "not_traveling",
      reason: "Absent",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("someone else");
  await expect(
    driver.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[2],
      status: "not_traveling",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("reason");
  await driver.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[2],
    status: "not_traveling",
    reason: "Absent",
    expectedRevision: 0,
  });
  await operator.mutation(api.queue.removeCar, { queueId: arrival.queueId! });
  const roster = await driver.query(
    api.studentDismissals.getRoster,
    rosterArgs,
  );
  expect(roster.inQueue).toBe(false);
  expect(roster.students.map((s) => s.state?.status)).toEqual([
    "picked_up_early",
    "departed",
    "not_traveling",
  ]);
  const history = await t.run((ctx) =>
    ctx.db.query("dismissalHistory").collect(),
  );
  expect(history[0]).toMatchObject({
    vehicleType: "bus",
    carNumber: "ABC-123",
    studentIds: [ids.students[1]],
  });
  expect(
    (await t.run((ctx) => ctx.db.query("auditLogs").collect())).length,
  ).toBe(4);
});

test("drivers cannot read other buses/campuses, dispatch, modify profiles or register/correct early pickups", async () => {
  const { driver, operator, ids, date, rosterArgs } = await setup();
  await expect(
    driver.query(api.studentDismissals.getRoster, {
      ...rosterArgs,
      carNumber: "XYZ-999",
    }),
  ).rejects.toThrow("not your bus");
  await expect(
    driver.query(api.studentDismissals.getRoster, {
      ...rosterArgs,
      campus: "Other",
    }),
  ).rejects.toThrow("No access");
  await expect(
    driver.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.otherStudent,
      status: "not_traveling",
      reason: "Absent",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("campus");
  await expect(
    driver.mutation(api.queue.addCar, {
      campus: "School",
      carNumber: "ABC-123",
      lane: "left",
    }),
  ).rejects.toThrow();
  await expect(
    driver.mutation(api.students.deleteAvatar, { studentId: ids.students[0] }),
  ).rejects.toThrow();
  await expect(
    driver.action(api.users.updateClerkProfileImage, {
      clerkUserId: "operator",
      avatarStorageId: null,
    }),
  ).rejects.toThrow();
  await expect(
    driver.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[0],
      status: "picked_up_early",
      collectedBy: "Parent",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("staff");
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[0],
    status: "picked_up_early",
    collectedBy: "Parent",
    expectedRevision: 0,
  });
  await expect(
    driver.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[0],
      status: "pending",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("staff");
  await expect(
    operator.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date,
      studentId: ids.students[0],
      status: "pending",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("correction reason");
  await operator.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[0],
    status: "pending",
    reason: "Wrong student",
    expectedRevision: 1,
  });
  expect(
    (
      await operator.query(api.studentDismissals.listRecordedDepartures, {
        campus: "School",
        date,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toHaveLength(0);
});

test("manual queue clearing does not reset daily states, stale days are rejected, and removing a driver preserves history", async () => {
  const { t, ids, operator, driver, date, rosterArgs } = await setup();
  await expect(
    operator.mutation(api.studentDismissals.setStatus, {
      campus: "School",
      date: "2000-01-01",
      studentId: ids.students[0],
      status: "picked_up_early",
      collectedBy: "Parent",
      expectedRevision: 0,
    }),
  ).rejects.toThrow("day changed");
  await operator.mutation(api.queue.addCar, {
    campus: "School",
    carNumber: "ABC-123",
    lane: "left",
  });
  await driver.mutation(api.studentDismissals.setStatus, {
    campus: "School",
    date,
    studentId: ids.students[0],
    status: "boarded",
    expectedRevision: 0,
  });
  await operator.mutation(api.queue.clearAllCars, { campus: "School" });
  expect(
    (await driver.query(api.studentDismissals.getRoster, rosterArgs))
      .students[0].state?.status,
  ).toBe("boarded");
  expect(
    (
      await driver.query(api.studentDismissals.getRoster, {
        ...rosterArgs,
        date: "2099-01-01",
      })
    ).students.every((s) => s.state === null),
  ).toBe(true);
  await t.run((ctx) =>
    ctx.db.patch(ids.driver, { role: "viewer", busNumber: undefined }),
  );
  const arrival = await operator.mutation(api.queue.addCar, {
    campus: "School",
    carNumber: "ABC-123",
    lane: "left",
  });
  expect(
    (await t.run((ctx) => ctx.db.get(arrival.queueId!)))?.vehicleType,
  ).toBe("car");
  expect(
    (await t.run((ctx) => ctx.db.query("dismissalHistory").collect()))[0],
  ).toMatchObject({
    vehicleType: "bus",
    completionReason: "cleared",
    studentIds: [],
  });
});

test.each(["2026-01-01", "2026-09-04"])("queues and student states share the 05:00 UTC cutoff (%s)", async (day) => {
  vi.useFakeTimers();
  const cutoff = Date.parse(`${day}T05:00:00Z`);
  vi.setSystemTime(cutoff - 1);
  try {
    expect(DAILY_RESET_UTC).toEqual({ hourUTC: 5, minuteUTC: 0 });
    expect(nextOperationalDay()).toBe(cutoff);
    const { t, ids, operator, driver, date, rosterArgs } = await setup();
    await t.run(ctx => ctx.db.patch(ids.campus, { timezone: "America/New_York" }));
    await operator.mutation(api.studentDismissals.setStatus, {
      campus: "School", date, studentId: ids.students[0], status: "picked_up_early",
      collectedBy: "Parent", expectedRevision: 0,
    });
    const arrival = await operator.mutation(api.queue.addCar, {
      campus: "School", carNumber: "ABC-123", lane: "left",
    });
    await driver.mutation(api.studentDismissals.setStatus, {
      campus: "School", date, studentId: ids.students[1], status: "boarded", expectedRevision: 0,
    });
    expect((await driver.query(api.studentDismissals.getRoster, rosterArgs)).inQueue).toBe(true);
    const previousStates = await t.run(ctx => ctx.db.query("studentDismissals").collect());
    vi.setSystemTime(cutoff);
    expect(operationalDate()).toBe(day);
    expect(nextOperationalDay()).toBe(cutoff + 24 * 60 * 60 * 1000);
    const roster = await driver.query(api.studentDismissals.getRoster, { ...rosterArgs, date: day });
    expect(roster.inQueue).toBe(false);
    expect(roster.students.every(s => s.state === null)).toBe(true);
    expect((await operator.query(api.studentDismissals.searchPickupStudents, {
      campus: "School", date: day, search: "Sofia",
    })).students[0].state).toBeNull();
    await expect(operator.mutation(api.studentDismissals.setStatus, {
      campus: "School", date, studentId: ids.students[0], status: "pending",
      reason: "Old form", expectedRevision: 1,
    })).rejects.toThrow("day changed");
    // New-day arrivals must survive a delayed cron and its retries.
    await t.run(ctx => ctx.db.patch(ids.students[2], { carNumber: 99 }));
    const fresh = await operator.mutation(api.queue.addCar, { campus: "School", carNumber: 99, lane: "right" });
    expect(fresh.success).toBe(true);
    vi.setSystemTime(cutoff + 60_000);
    const reset = await t.mutation(internal.queue.scheduledClearAllQueues, {});
    expect(reset).toMatchObject({ totalCarsCleared: 1, processedDate: date });
    expect(await t.run(ctx => ctx.db.get(arrival.queueId!))).toBeNull();
    expect(await t.run(ctx => ctx.db.get(fresh.queueId!))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.query("studentDismissals").collect())).toEqual(previousStates);
    expect((await t.mutation(internal.queue.scheduledClearAllQueues, {})).totalCarsCleared).toBe(0);
    await operator.mutation(api.studentDismissals.setStatus, {
      campus: "School", date: day, studentId: ids.students[0], status: "picked_up_early",
      collectedBy: "Parent today", expectedRevision: 0,
    });
    expect((await driver.query(api.studentDismissals.getRoster, rosterArgs)).students[0].state?.collectedBy).toBe("Parent");
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    vi.useRealTimers();
  }
});

test("cutoff migration corrects live legacy dates without deleting records or rewriting older history", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-09-04T12:00:00Z"));
  try {
    const { t, ids, operator, date, rosterArgs } = await setup();
    await operator.mutation(api.studentDismissals.setStatus, {
      campus: "School", date, studentId: ids.students[0], status: "picked_up_early",
      collectedBy: "Parent", expectedRevision: 0,
    });
    const before = await t.run(async ctx => {
      const record = (await ctx.db.query("studentDismissals").collect())[0];
      await ctx.db.patch(record._id, { updatedAt: Date.parse("2026-09-04T04:08:03Z") });
      await ctx.db.insert("studentDismissals", {
        studentId: record.studentId, studentName: record.studentName,
        campusId: record.campusId, date: "2026-09-03", status: "picked_up_early",
        updatedAt: Date.parse("2026-09-03T12:00:00Z"), updatedBy: record.updatedBy,
        updatedByName: record.updatedByName, revision: 1, collectedBy: "Parent",
      });
      return ctx.db.get(record._id);
    });
    // A second record at the target date must stop the migration, not be overwritten.
    const duplicate = await t.run(async ctx =>
      (await ctx.db.query("studentDismissals").collect()).find(r => r._id !== before!._id)!._id,
    );
    await expect(t.mutation(internal.migrations.alignStudentDismissalDates, {
      dryRun: false, cursor: null,
    })).rejects.toThrow("conflicting dismissal dates");
    expect(await t.run(ctx => ctx.db.get(before!._id))).toEqual(before);
    await t.run(ctx => ctx.db.patch(duplicate, { date: "2026-08-01" }));
    const olderHistory = await t.run(ctx => ctx.db.get(duplicate));
    const audit = await t.run(ctx => ctx.db.query("auditLogs").collect());
    await t.mutation(internal.migrations.alignStudentDismissalDates, { dryRun: false, cursor: null });
    expect(await t.run(ctx => ctx.db.get(before!._id))).toEqual({ ...before, date: "2026-09-03" });
    expect(await t.run(ctx => ctx.db.get(duplicate))).toEqual(olderHistory);
    expect(await t.run(ctx => ctx.db.query("auditLogs").collect())).toEqual(audit);
    expect((await operator.query(api.studentDismissals.getRoster, rosterArgs)).students[0].state).toBeNull();
    // Re-running is safe.
    await t.mutation(internal.migrations.alignStudentDismissalDates, { dryRun: false, cursor: null });
    expect(await t.run(ctx => ctx.db.query("studentDismissals").collect())).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});

test("Clerk sync preserves the normalized bus assignment and clears it on role changes", async () => {
  const { t, ids } = await setup();
  const data = {
    id: "driver",
    updated_at: 100,
    email_addresses: [{ email_address: "driver@example.test" }],
    public_metadata: {
      role: "bus_driver",
      busNumber: " ab c-123 ",
      assignedCampuses: [ids.campus],
    },
  };
  await t.mutation(internal.users.upsertFromClerk, { data });
  expect((await t.run((ctx) => ctx.db.get(ids.driver)))?.busNumber).toBe(
    "ABC-123",
  );
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      ...data,
      updated_at: 200,
      public_metadata: { ...data.public_metadata, role: "viewer" },
    },
  });
  expect(
    (await t.run((ctx) => ctx.db.get(ids.driver)))?.busNumber,
  ).toBeUndefined();
});

test("numeric legacy records stay compatible and plate identifiers survive dashboard aggregation", async () => {
  const { t, ids, operator } = await setup();
  await t.run(async (ctx) => {
    const now = Date.now();
    const history = {
      campusLocation: "School",
      lane: "left" as const,
      studentIds: [ids.students[0]],
      studentNames: ["Sofia Martinez"],
      queuedAt: now - 60_000,
      completedAt: now,
      waitTimeSeconds: 60,
      addedBy: ids.operator,
      removedBy: ids.operator,
      date: new Date(now).toISOString().slice(0, 10),
    };
    await ctx.db.insert("dismissalHistory", { ...history, carNumber: 11 });
    await ctx.db.insert("dismissalHistory", {
      ...history,
      carNumber: "ABC-123",
      vehicleType: "bus",
    });
    const arrivals = await calculateTopArrivalsForMonth(
      ctx.db,
      "School",
      history.date.slice(0, 7),
    );
    expect(arrivals.map((a) => a.carNumber)).toEqual([11, "ABC-123"]);
    await ctx.db.insert("dismissalQueue", {
      carNumber: 11,
      campusLocation: "School",
      lane: "left",
      position: 1,
      students: [],
      carColor: "#fff",
      assignedTime: now,
      addedBy: ids.operator,
      status: "waiting",
    });
  });
  expect(
    (await operator.query(api.queue.getCurrentQueue, { campus: "School" }))
      .leftLane[0],
  ).toMatchObject({ carNumber: 11, vehicleType: "car" });
});
