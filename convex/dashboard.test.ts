/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { calculateDurationTrend } from "./lib/dashboard_utils";

const modules = import.meta.glob("./**/*.ts");

test("duration trends use real pickups, weighted waits and operational days with gaps", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", {
    clerkId: "dashboard-admin", role: "superadmin", assignedCampuses: [], isActive: true, createdAt: 0,
  }));
  await t.run(async ctx => {
    const studentId = await ctx.db.insert("students", {
      firstName: "Test", lastName: "Student", fullName: "Test Student", grade: "4th", campuses: [],
      birthday: "January 01", carNumber: 1, isActive: true, createdAt: 0,
    });
    const insert = (at: string, wait: number, patch: Partial<Doc<"dismissalHistory">> = {}) => ctx.db.insert("dismissalHistory", {
      carNumber: 1, campusLocation: "School A", lane: "left", studentIds: [studentId], studentNames: ["Test Student"],
      queuedAt: Date.parse(at) - wait * 1000, completedAt: Date.parse(at), waitTimeSeconds: wait,
      date: at.slice(0, 10), addedBy: userId, removedBy: userId, completionReason: "dispatched", ...patch,
    });
    await insert("2026-01-01T23:50:00Z", 600);
    // Different UTC date, same operational day. The daily session spans midnight.
    await insert("2026-01-02T00:10:00Z", 1200, { completionReason: undefined });
    await insert("2026-01-03T16:00:00Z", 1800);
    // True zero must not become an empty day.
    await insert("2026-01-04T16:00:00Z", 0);
    await insert("2026-01-03T18:00:00Z", 60, { completionReason: "cleared" });
    await insert("2026-01-03T18:00:00Z", 60, { studentIds: [], studentNames: [] });
    await insert("2026-01-03T18:00:00Z", -60);
    await insert("2026-01-03T18:00:00Z", NaN, { queuedAt: NaN });
    // Included only in the global series.
    await insert("2026-01-03T17:00:00Z", 600, { campusLocation: "School B" });
    // The closing UTC date is fetched, but 05:00 begins the next operational day.
    await insert("2026-01-05T04:59:00Z", 60);
    await insert("2026-01-05T05:00:00Z", 0);
    await insert("2025-12-31T16:00:00Z", 60);
  });
  const admin = t.withIdentity({ subject: "dashboard-admin" });
  const args = { month: "2026-01", throughDate: "2026-01-05", campus: "School A" };
  const trend = (await admin.query(api.dashboard.getDurationTrends, args))!;
  expect(trend.startDate).toBe("2026-01-01");
  expect(trend.endDate).toBe("2026-01-04");
  expect(trend.points).toEqual([
    { date: "2026-01-01", waitMinutes: 15, sessionMinutes: 30 },
    { date: "2026-01-02", waitMinutes: null, sessionMinutes: null },
    { date: "2026-01-03", waitMinutes: 30, sessionMinutes: 30 },
    { date: "2026-01-04", waitMinutes: 0.5, sessionMinutes: 779 },
  ]);
  expect(trend.avgWaitMinutes).toBeCloseTo(12.2); // 61 minutes / 5 pickups, not an average of daily averages.
  expect(trend.avgSessionMinutes).toBeCloseTo(839 / 3);
  const global = (await admin.query(api.dashboard.getDurationTrends, { ...args, campus: undefined }))!;
  expect(global.points[2].sessionMinutes).toBe(90);
  const empty = (await admin.query(api.dashboard.getDurationTrends, { ...args, campus: "Empty" }))!;
  expect(empty.avgWaitMinutes).toBeNull();
  expect(empty.avgSessionMinutes).toBeNull();
  const defaultPeriod = (await admin.query(api.dashboard.getDurationTrends, { throughDate: "2026-01-05" }))!;
  expect(defaultPeriod.points).toHaveLength(30);
  await expect(admin.query(api.dashboard.getDurationTrends, { ...args, month: "2026-13" })).rejects.toThrow("Invalid reporting month");
  await expect(admin.query(api.dashboard.getDurationTrends, { throughDate: "2026-02-30" })).rejects.toThrow("Invalid reporting date");
  expect(await t.query(api.dashboard.getDurationTrends, args)).toBeNull();
  await t.run(ctx => ctx.db.patch(userId, { role: "principal" }));
  expect(await admin.query(api.dashboard.getDurationTrends, args)).toBeNull();
  await t.run(ctx => ctx.db.patch(userId, { role: "superadmin", isActive: false }));
  expect(await admin.query(api.dashboard.getDurationTrends, args)).toBeNull();
});

test("zero waits are data, excessive waits and cross-operational-day sessions are excluded independently", () => {
  const record = {
    studentIds: ["student"], completionReason: "dispatched", queuedAt: Date.parse("2026-01-02T16:00:00Z"),
    completedAt: Date.parse("2026-01-02T16:00:00Z"), waitTimeSeconds: 0,
  } as Doc<"dismissalHistory">;
  const zero = calculateDurationTrend([record], "2026-01-02", "2026-01-03");
  expect(zero.avgWaitMinutes).toBe(0);
  expect(zero.avgSessionMinutes).toBe(0);
  const long = calculateDurationTrend([{ ...record, queuedAt: record.queuedAt - 10800000, waitTimeSeconds: 10800 }], "2026-01-02", "2026-01-03");
  expect(long.avgWaitMinutes).toBeNull();
  expect(long.avgSessionMinutes).toBe(180);
  const crossDay = calculateDurationTrend([{
    ...record, queuedAt: Date.parse("2026-01-02T04:59:00Z"), completedAt: Date.parse("2026-01-02T05:01:00Z"), waitTimeSeconds: 120,
  }], "2026-01-02", "2026-01-03");
  expect(crossDay.avgWaitMinutes).toBe(2);
  expect(crossDay.avgSessionMinutes).toBeNull();
});
