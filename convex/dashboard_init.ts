import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  calculateDailyMetrics,
  upsertMetric,
  calculateAverage,
  calculateSessionDuration,
  upsertTopArrivals,
  calculateTopArrivalsForMonth,
  isSameDayUTC,
} from "./lib/dashboard_utils";

export const initializeDashboardMetrics = internalMutation({
  args: {
    skipTopArrivals: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allRecords = await ctx.db
      .query("dismissalHistory")
      .collect();

    if (allRecords.length === 0) {
      console.log("[Dashboard Init] No records found");
      return { success: false, message: "No historical records" };
    }

    const recordsByDate = allRecords.reduce((acc, record) => {
      if (!acc[record.date]) {
        acc[record.date] = [];
      }
      acc[record.date].push(record);
      return acc;
    }, {} as Record<string, any[]>);

    const dates = Object.keys(recordsByDate).sort();
    let processedDates = 0;

    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthsProcessed = new Set<string>();
    const allMonths = new Set<string>();

    for (const date of dates) {
      const records = recordsByDate[date];
      const month = date.substring(0, 7);
      allMonths.add(month);

      const dailyMetrics = calculateDailyMetrics(records);
      const campuses = Object.keys(dailyMetrics.byCampus);

      await updateGlobalMetrics(ctx.db, dailyMetrics, month, date);

      for (const campus of campuses) {
        await updateCampusMetrics(ctx.db, campus, dailyMetrics, month, date);
      }

      if (!args.skipTopArrivals && month === currentMonth && !monthsProcessed.has(month)) {
        await updateAllTopArrivals(ctx.db, campuses, month);
        monthsProcessed.add(month);
      }

      processedDates++;
    }

    await calculateGlobalSessionDurations(ctx.db, Array.from(allMonths));

    console.log(
      `[Dashboard Init] Processed ${processedDates} dates with ${allRecords.length} records`
    );

    return {
      success: true,
      processedDates,
      totalRecords: allRecords.length,
      monthsWithTopArrivals: monthsProcessed.size,
    };
  },
});

async function updateGlobalMetrics(
  db: any,
  dailyMetrics: any,
  month: string,
  date: string
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
  db: any,
  campus: string,
  dailyMetrics: any,
  month: string,
  date: string
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

async function calculateGlobalSessionDurations(
  db: any,
  months: string[]
) {
  const allRecords = await db
    .query("dismissalHistory")
    .collect();

  const byDate: Record<string, { firstArrival: number; lastPickup: number; count: number }> = {};
  const byMonthDate: Record<string, Record<string, { firstArrival: number; lastPickup: number; count: number }>> = {};

  for (const record of allRecords) {
    const date = record.date;
    const month = date.substring(0, 7);
    const sameDay = isSameDayUTC(record.queuedAt, record.completedAt);

    if (!byDate[date]) {
      byDate[date] = { firstArrival: Infinity, lastPickup: 0, count: 0 };
    }
    if (sameDay) {
      byDate[date].firstArrival = Math.min(byDate[date].firstArrival, record.queuedAt);
      byDate[date].lastPickup = Math.max(byDate[date].lastPickup, record.completedAt);
    }
    byDate[date].count++;

    if (!byMonthDate[month]) {
      byMonthDate[month] = {};
    }
    if (!byMonthDate[month][date]) {
      byMonthDate[month][date] = { firstArrival: Infinity, lastPickup: 0, count: 0 };
    }
    if (sameDay) {
      byMonthDate[month][date].firstArrival = Math.min(byMonthDate[month][date].firstArrival, record.queuedAt);
      byMonthDate[month][date].lastPickup = Math.max(byMonthDate[month][date].lastPickup, record.completedAt);
    }
    byMonthDate[month][date].count++;
  }

  let allTimeTotalSeconds = 0;
  let allTimeDaysCount = 0;
  let allTimeRecordCount = 0;

  for (const [date, data] of Object.entries(byDate)) {
    const sessionSeconds = calculateSessionDuration(data.firstArrival, data.lastPickup);
    if (sessionSeconds > 0) {
      allTimeTotalSeconds += sessionSeconds;
      allTimeDaysCount++;
    }
    allTimeRecordCount += data.count;
  }

  if (allTimeDaysCount > 0) {
    await upsertMetric(db, "session_duration", undefined, undefined, {
      totalSessionSeconds: allTimeTotalSeconds,
      avgSessionSeconds: calculateAverage(allTimeTotalSeconds, allTimeDaysCount),
      daysCount: allTimeDaysCount,
      recordCount: allTimeRecordCount,
    });
  }

  for (const month of months) {
    const monthDates = byMonthDate[month] || {};
    let monthlyTotalSeconds = 0;
    let monthlyDaysCount = 0;
    let monthlyRecordCount = 0;

    for (const [date, data] of Object.entries(monthDates)) {
      const sessionSeconds = calculateSessionDuration(data.firstArrival, data.lastPickup);
      if (sessionSeconds > 0) {
        monthlyTotalSeconds += sessionSeconds;
        monthlyDaysCount++;
      }
      monthlyRecordCount += data.count;
    }

    if (monthlyDaysCount > 0) {
      await upsertMetric(db, "session_duration", undefined, month, {
        totalSessionSeconds: monthlyTotalSeconds,
        avgSessionSeconds: calculateAverage(monthlyTotalSeconds, monthlyDaysCount),
        daysCount: monthlyDaysCount,
        recordCount: monthlyRecordCount,
      });
    }
  }
}

async function getExistingMetric(
  db: any,
  metricType: string,
  campus?: string,
  month?: string
): Promise<any> {
  let results;
  
  if (campus && month) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_campus_month", (q: any) =>
        q
          .eq("metricType", metricType)
          .eq("campusLocation", campus)
          .eq("month", month)
      )
      .collect();
  } else if (campus) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_campus", (q: any) =>
        q.eq("metricType", metricType).eq("campusLocation", campus)
      )
      .filter((q: any) => q.eq(q.field("month"), undefined))
      .collect();
  } else if (month) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_month", (q: any) =>
        q.eq("metricType", metricType).eq("month", month)
      )
      .filter((q: any) => q.eq(q.field("campusLocation"), undefined))
      .collect();
  } else {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type", (q: any) => q.eq("metricType", metricType))
      .filter((q: any) => 
        q.and(
          q.eq(q.field("campusLocation"), undefined),
          q.eq(q.field("month"), undefined)
        )
      )
      .collect();
  }

  if (results.length > 1) {
    for (let i = 1; i < results.length; i++) {
      await db.delete(results[i]._id);
    }
  }

  return results[0] || null;
}

export const initializeTopArrivalsForMonth = internalMutation({
  args: {
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const month = args.month ?? new Date().toISOString().substring(0, 7);

    const records = await ctx.db
      .query("dismissalHistory")
      .collect();

    const monthRecords = records.filter((r) => r.date.startsWith(month));

    if (monthRecords.length === 0) {
      console.log(`[Dashboard Init] No records found for month ${month}`);
      return { success: false, message: `No records for ${month}` };
    }

    const campuses = [...new Set(monthRecords.map((r) => r.campusLocation))];

    for (const campus of campuses) {
      const topArrivals = await calculateTopArrivalsForMonth(ctx.db, campus, month);
      await upsertTopArrivals(ctx.db, campus, month, topArrivals);
    }

    console.log(
      `[Dashboard Init] Initialized topArrivals for ${month} with ${campuses.length} campuses`
    );

    return {
      success: true,
      month,
      campusesProcessed: campuses.length,
      totalRecords: monthRecords.length,
    };
  },
});
