import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import {
  calculateDailyMetrics,
  calculateSessionDuration,
  calculateAverage,
  getExistingMetric,
  upsertMetric,
  calculateTopArrivalsForMonth,
  upsertTopArrivals,
} from "./lib/dashboard_utils";

export const updateDashboardMetrics = internalMutation({
  args: {
    date: v.string(),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("dismissalHistory")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    if (records.length === 0) {
      console.log(`[Dashboard] No records for ${args.date}`);
      return;
    }

    const dailyMetrics = calculateDailyMetrics(records);
    const campuses = Object.keys(dailyMetrics.byCampus);

    await updateGlobalMetrics(ctx.db, dailyMetrics, args.month);

    for (const campus of campuses) {
      await updateCampusMetrics(ctx.db, campus, dailyMetrics, args.month);
    }

    await updateGlobalSessionDuration(ctx.db, dailyMetrics.global, args.month);

    await updateAllTopArrivals(ctx.db, campuses, args.month);

    console.log(`[Dashboard] Updated metrics for ${args.date}`);
  },
});

async function updateGlobalMetrics(db: any, dailyMetrics: any, month: string) {
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
  db: any,
  campus: string,
  dailyMetrics: any,
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
  db: any,
  campuses: string[],
  month: string
) {
  for (const campus of campuses) {
    const topArrivals = await calculateTopArrivalsForMonth(db, campus, month);
    await upsertTopArrivals(db, campus, month, topArrivals);
  }
}

async function updateGlobalSessionDuration(db: any, globalData: any, month: string) {
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
    let metric;

    if (args.campus && args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus_month", (q) =>
          q
            .eq("metricType", "campus_activity")
            .eq("campusLocation", args.campus!)
            .eq("month", args.month!)
        )
        .unique();
    } else if (args.campus) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus", (q) =>
          q.eq("metricType", "campus_activity").eq("campusLocation", args.campus!)
        )
        .filter((q) => q.eq(q.field("month"), undefined))
        .unique();
    } else if (args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_month", (q) =>
          q.eq("metricType", "campus_activity").eq("month", args.month!)
        )
        .filter((q) => q.eq(q.field("campusLocation"), undefined))
        .unique();
    } else {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type", (q) => q.eq("metricType", "campus_activity"))
        .filter((q) => 
          q.and(
            q.eq(q.field("campusLocation"), undefined),
            q.eq(q.field("month"), undefined)
          )
        )
        .unique();
    }

    return metric ?? null;
  },
});

export const getAverageWaitTime = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let metric;

    if (args.campus && args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus_month", (q) =>
          q
            .eq("metricType", "avg_wait_time")
            .eq("campusLocation", args.campus!)
            .eq("month", args.month!)
        )
        .unique();
    } else if (args.campus) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus", (q) =>
          q.eq("metricType", "avg_wait_time").eq("campusLocation", args.campus!)
        )
        .filter((q) => q.eq(q.field("month"), undefined))
        .unique();
    } else if (args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_month", (q) =>
          q.eq("metricType", "avg_wait_time").eq("month", args.month!)
        )
        .filter((q) => q.eq(q.field("campusLocation"), undefined))
        .unique();
    } else {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type", (q) => q.eq("metricType", "avg_wait_time"))
        .filter((q) => 
          q.and(
            q.eq(q.field("campusLocation"), undefined),
            q.eq(q.field("month"), undefined)
          )
        )
        .unique();
    }

    return metric ?? null;
  },
});

export const getSessionDuration = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let metric;

    if (args.campus && args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus_month", (q) =>
          q
            .eq("metricType", "session_duration")
            .eq("campusLocation", args.campus!)
            .eq("month", args.month!)
        )
        .unique();
    } else if (args.campus) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_campus", (q) =>
          q.eq("metricType", "session_duration").eq("campusLocation", args.campus!)
        )
        .filter((q) => q.eq(q.field("month"), undefined))
        .unique();
    } else if (args.month) {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_month", (q) =>
          q.eq("metricType", "session_duration").eq("month", args.month!)
        )
        .filter((q) => q.eq(q.field("campusLocation"), undefined))
        .unique();
    } else {
      metric = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type", (q) => q.eq("metricType", "session_duration"))
        .filter((q) => 
          q.and(
            q.eq(q.field("campusLocation"), undefined),
            q.eq(q.field("month"), undefined)
          )
        )
        .unique();
    }

    return metric ?? null;
  },
});

export const getTopArrivals = query({
  args: {
    campus: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { campus, month } = args;

    // Both campus and month provided - return single record
    if (campus && month) {
      const topArrivals = await ctx.db
        .query("dashboardTopArrivals")
        .withIndex("by_campus_month", (q) =>
          q.eq("campusLocation", campus).eq("month", month)
        )
        .unique();
      return topArrivals ? [topArrivals] : [];
    }

    // Only campus provided - return all months for that campus
    if (campus) {
      return await ctx.db
        .query("dashboardTopArrivals")
        .withIndex("by_campus_month", (q) => q.eq("campusLocation", campus))
        .collect();
    }

    // Only month provided - filter by month
    if (month) {
      return await ctx.db
        .query("dashboardTopArrivals")
        .filter((q) => q.eq(q.field("month"), month))
        .collect();
    }

    // No filters - return all records
    return await ctx.db.query("dashboardTopArrivals").collect();
  },
});

export const getAllCampusActivity = query({
  args: {
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let metrics;

    if (args.month) {
      metrics = await ctx.db
        .query("dashboardMetrics")
        .withIndex("by_type_month", (q) =>
          q.eq("metricType", "campus_activity").eq("month", args.month!)
        )
        .filter((q) => q.neq(q.field("campusLocation"), undefined))
        .collect();
    } else {
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

    return metrics;
  },
});
