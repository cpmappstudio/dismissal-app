import { v } from "convex/values";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  calculateDailyMetrics,
  calculateSessionDuration,
  calculateAverage,
  getExistingMetric,
  upsertMetric,
  calculateTopArrivalsForMonth,
  upsertTopArrivals,
} from "./lib/dashboard_utils";

const DASHBOARD_ALLOWED_ROLES = new Set(["superadmin"]);

type DashboardAccessCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

interface DashboardTopArrivalRecord {
  topArrivals?: Array<{
    carNumber: number;
    queuedAt: number;
    studentNames?: string[];
    appearances?: number;
  }>;
}

type DailyMetrics = ReturnType<typeof calculateDailyMetrics>;
type DashboardDb = MutationCtx["db"];

type DashboardAccess = {
  user: Doc<"users">;
  role: string;
  isGlobal: boolean;
  allowedCampuses: Set<string>;
};

async function resolveAllowedCampusNames(
  ctx: DashboardAccessCtx,
  user: Doc<"users">
): Promise<Set<string>> {
  const campusDocs = await Promise.all(
    (user.assignedCampuses || []).map((campusId) => ctx.db.get(campusId))
  );

  return new Set(
    campusDocs
      .filter((campus): campus is NonNullable<typeof campus> => campus !== null)
      .map((campus) => campus.campusName)
  );
}

async function getDashboardAccess(ctx: DashboardAccessCtx): Promise<DashboardAccess | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || !user.isActive || !user.role) {
    return null;
  }

  if (!DASHBOARD_ALLOWED_ROLES.has(user.role)) {
    return null;
  }

  const isGlobal = user.role === "superadmin";
  const allowedCampuses = isGlobal
    ? new Set<string>()
    : await resolveAllowedCampusNames(ctx, user);

  return {
    user,
    role: user.role,
    isGlobal,
    allowedCampuses,
  };
}

function isCampusAllowed(access: DashboardAccess, campus: string): boolean {
  return access.isGlobal || access.allowedCampuses.has(campus);
}

function filterByCampusScope<T extends { campusLocation?: string }>(
  access: DashboardAccess,
  rows: T[]
): T[] {
  if (access.isGlobal) return rows;
  if (access.allowedCampuses.size === 0) return [];
  return rows.filter(
    (row) => !!row.campusLocation && access.allowedCampuses.has(row.campusLocation)
  );
}

function getLastUpdatedAt(rows: Array<{ lastUpdatedAt?: number }>): number {
  if (rows.length === 0) return Date.now();
  return Math.max(...rows.map((row) => row.lastUpdatedAt || 0));
}

function aggregateCampusActivityMetrics(
  rows: Array<{
    totalEvents?: number;
    recordCount: number;
    lastUpdatedAt?: number;
  }>,
  month?: string
) {
  if (rows.length === 0) return null;

  const totalEvents = rows.reduce((sum, row) => sum + (row.totalEvents || 0), 0);
  const recordCount = rows.reduce((sum, row) => sum + row.recordCount, 0);

  return {
    metricType: "campus_activity" as const,
    month,
    totalEvents,
    recordCount,
    lastUpdatedAt: getLastUpdatedAt(rows),
  };
}

function aggregateWaitTimeMetrics(
  rows: Array<{
    totalWaitSeconds?: number;
    recordCount: number;
    lastUpdatedAt?: number;
  }>,
  month?: string
) {
  if (rows.length === 0) return null;

  const totalWaitSeconds = rows.reduce(
    (sum, row) => sum + (row.totalWaitSeconds || 0),
    0
  );
  const recordCount = rows.reduce((sum, row) => sum + row.recordCount, 0);

  return {
    metricType: "avg_wait_time" as const,
    month,
    totalWaitSeconds,
    recordCount,
    avgWaitSeconds: calculateAverage(totalWaitSeconds, recordCount),
    lastUpdatedAt: getLastUpdatedAt(rows),
  };
}

function aggregateSessionDurationMetrics(
  rows: Array<{
    totalSessionSeconds?: number;
    daysCount?: number;
    recordCount: number;
    lastUpdatedAt?: number;
  }>,
  month?: string
) {
  if (rows.length === 0) return null;

  const totalSessionSeconds = rows.reduce(
    (sum, row) => sum + (row.totalSessionSeconds || 0),
    0
  );
  const daysCount = rows.reduce((sum, row) => sum + (row.daysCount || 0), 0);
  const recordCount = rows.reduce((sum, row) => sum + row.recordCount, 0);

  return {
    metricType: "session_duration" as const,
    month,
    totalSessionSeconds,
    daysCount,
    recordCount,
    avgSessionSeconds: calculateAverage(totalSessionSeconds, daysCount),
    lastUpdatedAt: getLastUpdatedAt(rows),
  };
}

function getCurrentMonthKey(): string {
  return new Date().toISOString().substring(0, 7);
}

function aggregateGlobalTopArrivals(records: DashboardTopArrivalRecord[]) {
  const byCar: Record<
    number,
    {
      carNumber: number;
      queuedAt: number;
      studentNames: string[];
      appearances: number;
    }
  > = {};

  for (const record of records) {
    for (const arrival of record.topArrivals ?? []) {
      const appearances =
        typeof arrival.appearances === "number" ? arrival.appearances : 1;
      const current = byCar[arrival.carNumber];

      if (!current) {
        byCar[arrival.carNumber] = {
          carNumber: arrival.carNumber,
          queuedAt: arrival.queuedAt,
          studentNames: arrival.studentNames ?? [],
          appearances,
        };
        continue;
      }

      current.appearances += appearances;
      if (arrival.queuedAt < current.queuedAt) {
        current.queuedAt = arrival.queuedAt;
      }
      if (current.studentNames.length === 0 && arrival.studentNames?.length) {
        current.studentNames = arrival.studentNames;
      }
    }
  }

  return Object.values(byCar)
    .sort((a, b) => {
      if (b.appearances !== a.appearances) {
        return b.appearances - a.appearances;
      }
      return a.queuedAt - b.queuedAt;
    })
    .slice(0, 5)
    .map((arrival, index) => ({
      ...arrival,
      position: index + 1,
    }));
}

export const updateDashboardMetrics = internalMutation({
  args: {
    date: v.string(),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    const alreadyProcessed = await ctx.db
      .query("dashboardProcessedDates")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    if (alreadyProcessed.length > 0) {
      console.log(`[Dashboard] Date ${args.date} already processed. Skipping.`);
      return {
        success: true,
        skipped: true,
        date: args.date,
      };
    }

    const records = await ctx.db
      .query("dismissalHistory")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    if (records.length === 0) {
      console.log(`[Dashboard] No records for ${args.date}`);
      return {
        success: false,
        skipped: false,
        date: args.date,
      };
    }

    const dailyMetrics = calculateDailyMetrics(records);
    const campuses = Object.keys(dailyMetrics.byCampus);

    await updateGlobalMetrics(ctx.db, dailyMetrics, args.month);

    for (const campus of campuses) {
      await updateCampusMetrics(ctx.db, campus, dailyMetrics, args.month);
    }

    await updateGlobalSessionDuration(ctx.db, dailyMetrics.global, args.month);

    await updateAllTopArrivals(ctx.db, campuses, args.month);

    await ctx.db.insert("dashboardProcessedDates", {
      date: args.date,
      month: args.month,
      processedAt: Date.now(),
    });

    console.log(`[Dashboard] Updated metrics for ${args.date}`);
    return {
      success: true,
      skipped: false,
      date: args.date,
      campusesProcessed: campuses.length,
      recordsProcessed: records.length,
    };
  },
});

async function updateGlobalMetrics(
  db: DashboardDb,
  dailyMetrics: DailyMetrics,
  month: string
) {
  const globalData = dailyMetrics.global;

  const allTimeCampusActivity = await getExistingMetric(
    db,
    "campus_activity",
    undefined,
    undefined
  );
  await upsertMetric(db, "campus_activity", undefined, undefined, {
    totalEvents:
      (allTimeCampusActivity?.totalEvents || 0) + globalData.totalEvents,
    recordCount:
      (allTimeCampusActivity?.recordCount || 0) + globalData.totalEvents,
  });

  const monthlyCampusActivity = await getExistingMetric(
    db,
    "campus_activity",
    undefined,
    month
  );
  await upsertMetric(db, "campus_activity", undefined, month, {
    totalEvents:
      (monthlyCampusActivity?.totalEvents || 0) + globalData.totalEvents,
    recordCount:
      (monthlyCampusActivity?.recordCount || 0) + globalData.totalEvents,
  });

  const allTimeWaitTime = await getExistingMetric(
    db,
    "avg_wait_time",
    undefined,
    undefined
  );
  const newAllTimeTotalWait =
    (allTimeWaitTime?.totalWaitSeconds || 0) + globalData.totalWaitSeconds;
  const newAllTimeCount =
    (allTimeWaitTime?.recordCount || 0) + globalData.validWaitTimeCount;
  await upsertMetric(db, "avg_wait_time", undefined, undefined, {
    totalWaitSeconds: newAllTimeTotalWait,
    avgWaitSeconds: calculateAverage(newAllTimeTotalWait, newAllTimeCount),
    recordCount: newAllTimeCount,
  });

  const monthlyWaitTime = await getExistingMetric(
    db,
    "avg_wait_time",
    undefined,
    month
  );
  const newMonthlyTotalWait =
    (monthlyWaitTime?.totalWaitSeconds || 0) + globalData.totalWaitSeconds;
  const newMonthlyCount =
    (monthlyWaitTime?.recordCount || 0) + globalData.validWaitTimeCount;
  await upsertMetric(db, "avg_wait_time", undefined, month, {
    totalWaitSeconds: newMonthlyTotalWait,
    avgWaitSeconds: calculateAverage(newMonthlyTotalWait, newMonthlyCount),
    recordCount: newMonthlyCount,
  });
}

async function updateCampusMetrics(
  db: DashboardDb,
  campus: string,
  dailyMetrics: DailyMetrics,
  month: string
) {
  const campusData = dailyMetrics.byCampus[campus];

  const allTimeCampusActivity = await getExistingMetric(
    db,
    "campus_activity",
    campus,
    undefined
  );
  await upsertMetric(db, "campus_activity", campus, undefined, {
    totalEvents:
      (allTimeCampusActivity?.totalEvents || 0) + campusData.totalEvents,
    recordCount:
      (allTimeCampusActivity?.recordCount || 0) + campusData.totalEvents,
  });

  const monthlyCampusActivity = await getExistingMetric(
    db,
    "campus_activity",
    campus,
    month
  );
  await upsertMetric(db, "campus_activity", campus, month, {
    totalEvents:
      (monthlyCampusActivity?.totalEvents || 0) + campusData.totalEvents,
    recordCount:
      (monthlyCampusActivity?.recordCount || 0) + campusData.totalEvents,
  });

  const allTimeWaitTime = await getExistingMetric(
    db,
    "avg_wait_time",
    campus,
    undefined
  );
  const newAllTimeTotalWait =
    (allTimeWaitTime?.totalWaitSeconds || 0) + campusData.totalWaitSeconds;
  const newAllTimeCount =
    (allTimeWaitTime?.recordCount || 0) + campusData.validWaitTimeCount;
  await upsertMetric(db, "avg_wait_time", campus, undefined, {
    totalWaitSeconds: newAllTimeTotalWait,
    avgWaitSeconds: calculateAverage(newAllTimeTotalWait, newAllTimeCount),
    recordCount: newAllTimeCount,
  });

  const monthlyWaitTime = await getExistingMetric(
    db,
    "avg_wait_time",
    campus,
    month
  );
  const newMonthlyTotalWait =
    (monthlyWaitTime?.totalWaitSeconds || 0) + campusData.totalWaitSeconds;
  const newMonthlyCount =
    (monthlyWaitTime?.recordCount || 0) + campusData.validWaitTimeCount;
  await upsertMetric(db, "avg_wait_time", campus, month, {
    totalWaitSeconds: newMonthlyTotalWait,
    avgWaitSeconds: calculateAverage(newMonthlyTotalWait, newMonthlyCount),
    recordCount: newMonthlyCount,
  });

  const campusSessionDuration = calculateSessionDuration(
    campusData.firstArrival,
    campusData.lastPickup
  );
  const daysIncrement = campusSessionDuration > 0 ? 1 : 0;

  const allTimeSession = await getExistingMetric(
    db,
    "session_duration",
    campus,
    undefined
  );
  const newAllTimeSessionTotal =
    (allTimeSession?.totalSessionSeconds || 0) + campusSessionDuration;
  const newAllTimeDaysCount = (allTimeSession?.daysCount || 0) + daysIncrement;
  await upsertMetric(db, "session_duration", campus, undefined, {
    totalSessionSeconds: newAllTimeSessionTotal,
    avgSessionSeconds: calculateAverage(
      newAllTimeSessionTotal,
      newAllTimeDaysCount
    ),
    daysCount: newAllTimeDaysCount,
    recordCount: (allTimeSession?.recordCount || 0) + campusData.totalEvents,
  });

  const monthlySession = await getExistingMetric(
    db,
    "session_duration",
    campus,
    month
  );
  const newMonthlySessionTotal =
    (monthlySession?.totalSessionSeconds || 0) + campusSessionDuration;
  const newMonthlyDaysCount = (monthlySession?.daysCount || 0) + daysIncrement;
  await upsertMetric(db, "session_duration", campus, month, {
    totalSessionSeconds: newMonthlySessionTotal,
    avgSessionSeconds: calculateAverage(
      newMonthlySessionTotal,
      newMonthlyDaysCount
    ),
    daysCount: newMonthlyDaysCount,
    recordCount: (monthlySession?.recordCount || 0) + campusData.totalEvents,
  });
}

async function updateAllTopArrivals(
  db: DashboardDb,
  campuses: string[],
  month: string
) {
  for (const campus of campuses) {
    const topArrivals = await calculateTopArrivalsForMonth(db, campus, month);
    await upsertTopArrivals(db, campus, month, topArrivals);
  }
}

async function updateGlobalSessionDuration(
  db: DashboardDb,
  globalData: DailyMetrics["global"],
  month: string
) {
  const dailySessionSeconds = calculateSessionDuration(
    globalData.firstArrival,
    globalData.lastPickup
  );

  if (dailySessionSeconds === 0) {
    return;
  }

  const allTimeSession = await getExistingMetric(
    db,
    "session_duration",
    undefined,
    undefined
  );
  const newAllTimeTotalSeconds = (allTimeSession?.totalSessionSeconds || 0) + dailySessionSeconds;
  const newAllTimeDaysCount = (allTimeSession?.daysCount || 0) + 1;

  await upsertMetric(db, "session_duration", undefined, undefined, {
    totalSessionSeconds: newAllTimeTotalSeconds,
    avgSessionSeconds: calculateAverage(newAllTimeTotalSeconds, newAllTimeDaysCount),
    daysCount: newAllTimeDaysCount,
    recordCount: (allTimeSession?.recordCount || 0) + globalData.totalEvents,
  });

  const monthlySession = await getExistingMetric(
    db,
    "session_duration",
    undefined,
    month
  );
  const newMonthlyTotalSeconds = (monthlySession?.totalSessionSeconds || 0) + dailySessionSeconds;
  const newMonthlyDaysCount = (monthlySession?.daysCount || 0) + 1;

  await upsertMetric(db, "session_duration", undefined, month, {
    totalSessionSeconds: newMonthlyTotalSeconds,
    avgSessionSeconds: calculateAverage(newMonthlyTotalSeconds, newMonthlyDaysCount),
    daysCount: newMonthlyDaysCount,
    recordCount: (monthlySession?.recordCount || 0) + globalData.totalEvents,
  });
}

export const getCampusActivity = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getDashboardAccess(ctx);
    if (!access) {
      return null;
    }

    if (args.campus && !isCampusAllowed(access, args.campus)) {
      return null;
    }

    // Campus-specific metric
    if (args.campus && args.month) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus_month", (q) =>
            q
              .eq("metricType", "campus_activity")
              .eq("campusLocation", args.campus!)
              .eq("month", args.month!)
          )
          .unique()) ?? null
      );
    }

    if (args.campus) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus", (q) =>
            q.eq("metricType", "campus_activity").eq("campusLocation", args.campus!)
          )
          .filter((q) => q.eq(q.field("month"), undefined))
          .unique()) ?? null
      );
    }

    // Global behavior for superadmin
    if (access.isGlobal) {
      if (args.month) {
        return (
          (await ctx.db
            .query("dashboardMetrics")
            .withIndex("by_type_month", (q) =>
              q.eq("metricType", "campus_activity").eq("month", args.month!)
            )
            .filter((q) => q.eq(q.field("campusLocation"), undefined))
            .unique()) ?? null
        );
      }

      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "campus_activity"))
          .filter((q) =>
            q.and(
              q.eq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .unique()) ?? null
      );
    }

    // Scoped aggregate for principal/admin
    const campusMetrics = args.month
      ? await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_month", (q) =>
            q.eq("metricType", "campus_activity").eq("month", args.month!)
          )
          .filter((q) => q.neq(q.field("campusLocation"), undefined))
          .collect()
      : await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "campus_activity"))
          .filter((q) =>
            q.and(
              q.neq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .collect();

    const scoped = filterByCampusScope(access, campusMetrics);
    return aggregateCampusActivityMetrics(scoped, args.month);
  },
});

export const getAverageWaitTime = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getDashboardAccess(ctx);
    if (!access) {
      return null;
    }

    if (args.campus && !isCampusAllowed(access, args.campus)) {
      return null;
    }

    if (args.campus && args.month) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus_month", (q) =>
            q
              .eq("metricType", "avg_wait_time")
              .eq("campusLocation", args.campus!)
              .eq("month", args.month!)
          )
          .unique()) ?? null
      );
    }

    if (args.campus) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus", (q) =>
            q.eq("metricType", "avg_wait_time").eq("campusLocation", args.campus!)
          )
          .filter((q) => q.eq(q.field("month"), undefined))
          .unique()) ?? null
      );
    }

    if (access.isGlobal) {
      if (args.month) {
        return (
          (await ctx.db
            .query("dashboardMetrics")
            .withIndex("by_type_month", (q) =>
              q.eq("metricType", "avg_wait_time").eq("month", args.month!)
            )
            .filter((q) => q.eq(q.field("campusLocation"), undefined))
            .unique()) ?? null
        );
      }

      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "avg_wait_time"))
          .filter((q) =>
            q.and(
              q.eq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .unique()) ?? null
      );
    }

    const campusMetrics = args.month
      ? await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_month", (q) =>
            q.eq("metricType", "avg_wait_time").eq("month", args.month!)
          )
          .filter((q) => q.neq(q.field("campusLocation"), undefined))
          .collect()
      : await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "avg_wait_time"))
          .filter((q) =>
            q.and(
              q.neq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .collect();

    const scoped = filterByCampusScope(access, campusMetrics);
    return aggregateWaitTimeMetrics(scoped, args.month);
  },
});

export const getSessionDuration = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getDashboardAccess(ctx);
    if (!access) {
      return null;
    }

    if (args.campus && !isCampusAllowed(access, args.campus)) {
      return null;
    }

    if (args.campus && args.month) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus_month", (q) =>
            q
              .eq("metricType", "session_duration")
              .eq("campusLocation", args.campus!)
              .eq("month", args.month!)
          )
          .unique()) ?? null
      );
    }

    if (args.campus) {
      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_campus", (q) =>
            q.eq("metricType", "session_duration").eq("campusLocation", args.campus!)
          )
          .filter((q) => q.eq(q.field("month"), undefined))
          .unique()) ?? null
      );
    }

    if (access.isGlobal) {
      if (args.month) {
        return (
          (await ctx.db
            .query("dashboardMetrics")
            .withIndex("by_type_month", (q) =>
              q.eq("metricType", "session_duration").eq("month", args.month!)
            )
            .filter((q) => q.eq(q.field("campusLocation"), undefined))
            .unique()) ?? null
        );
      }

      return (
        (await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "session_duration"))
          .filter((q) =>
            q.and(
              q.eq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .unique()) ?? null
      );
    }

    const campusMetrics = args.month
      ? await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type_month", (q) =>
            q.eq("metricType", "session_duration").eq("month", args.month!)
          )
          .filter((q) => q.neq(q.field("campusLocation"), undefined))
          .collect()
      : await ctx.db
          .query("dashboardMetrics")
          .withIndex("by_type", (q) => q.eq("metricType", "session_duration"))
          .filter((q) =>
            q.and(
              q.neq(q.field("campusLocation"), undefined),
              q.eq(q.field("month"), undefined)
            )
          )
          .collect();

    const scoped = filterByCampusScope(access, campusMetrics);
    return aggregateSessionDurationMetrics(scoped, args.month);
  },
});

export const getTopArrivals = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getDashboardAccess(ctx);
    if (!access) {
      return [];
    }

    const { campus, month } = args;
    const targetMonth = month ?? getCurrentMonthKey();

    // Both campus and month provided - return single record
    if (campus && month) {
      if (!isCampusAllowed(access, campus)) {
        return [];
      }
      const topArrivals = await ctx.db
        .query("dashboardTopArrivals")
        .withIndex("by_campus_month", (q) =>
          q.eq("campusLocation", campus).eq("month", month)
        )
        .unique();
      return topArrivals ? [topArrivals] : [];
    }

    // Campus provided without month - use current month by default
    if (campus) {
      if (!isCampusAllowed(access, campus)) {
        return [];
      }
      const topArrivals = await ctx.db
        .query("dashboardTopArrivals")
        .withIndex("by_campus_month", (q) =>
          q.eq("campusLocation", campus).eq("month", targetMonth)
        )
        .collect();

      return topArrivals;
    }

    // Global mode (month optional): aggregate all campuses for the target month
    const recordsForMonth = await ctx.db
      .query("dashboardTopArrivals")
      .withIndex("by_month", (q) => q.eq("month", targetMonth))
      .collect();

    const scopedRecords = filterByCampusScope(access, recordsForMonth);

    if (scopedRecords.length === 0) {
      return [];
    }

    const aggregatedTopArrivals = aggregateGlobalTopArrivals(scopedRecords);
    if (aggregatedTopArrivals.length === 0) {
      return [];
    }

    const lastUpdatedAt = Math.max(
      ...scopedRecords.map((record) => record.lastUpdatedAt || 0)
    );

    return [
      {
        campusLocation: "GLOBAL",
        month: targetMonth,
        topArrivals: aggregatedTopArrivals,
        lastUpdatedAt,
      },
    ];
  },
});

export const getAllCampusActivity = query({
  args: {
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getDashboardAccess(ctx);
    if (!access) {
      return [];
    }

    let metrics;

    if (args.month) {
      metrics = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_month", (q) =>
          q.eq("metricType", "campus_activity").eq("month", args.month!)
        )
        .filter((q) => q.neq(q.field("campusLocation"), undefined))
        .collect();
    }
    else {
      metrics = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type", (q) => q.eq("metricType", "campus_activity"))
        .filter((q) => 
          q.and(
            q.neq(q.field("campusLocation"), undefined),
            q.eq(q.field("month"), undefined)
          )
        )
        .collect();
    }

    return filterByCampusScope(access, metrics);
  },
});
