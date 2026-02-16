import { internalQuery } from "./_generated/server";
import { isSameDayUTC, calculateSessionDuration } from "./lib/dashboard_utils";

export const getCampusStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRecords = await ctx.db.query("dismissalHistory").collect();

    const campusStats: Record<string, { count: number; months: Set<string> }> =
      {};

    for (const record of allRecords) {
      const campus = record.campusLocation;
      const month = record.date?.substring(0, 7);

      if (!campusStats[campus]) {
        campusStats[campus] = { count: 0, months: new Set() };
      }

      campusStats[campus].count++;
      if (month) {
        campusStats[campus].months.add(month);
      }
    }

    const result: Record<string, { count: number; months: string[] }> = {};
    for (const [campus, stats] of Object.entries(campusStats)) {
      result[campus] = {
        count: stats.count,
        months: Array.from(stats.months).sort(),
      };
    }

    return {
      totalRecords: allRecords.length,
      campuses: result,
    };
  },
});

export const verifyMetrics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("dismissalHistory")
      .collect();

    const dashboardMetrics = await ctx.db.query("dashboardMetrics").collect();

    const rawStats = {
      global: {
        totalRecords: records.length,
        totalWaitSeconds: 0,
        avgWaitSeconds: 0,
        byDate: {} as Record<string, { firstArrival: number; lastPickup: number; count: number }>,
        totalSessionSeconds: 0,
        daysCount: 0,
        avgSessionSeconds: 0,
      },
      byCampus: {} as Record<string, {
        totalRecords: number;
        totalWaitSeconds: number;
        avgWaitSeconds: number;
        byDate: Record<string, { firstArrival: number; lastPickup: number; count: number }>;
        totalSessionSeconds: number;
        daysCount: number;
        avgSessionSeconds: number;
      }>,
      byMonth: {} as Record<string, {
        totalRecords: number;
        totalWaitSeconds: number;
        avgWaitSeconds: number;
        byDate: Record<string, { firstArrival: number; lastPickup: number; count: number }>;
        totalSessionSeconds: number;
        daysCount: number;
        avgSessionSeconds: number;
      }>,
    };

    for (const record of records) {
      const campus = record.campusLocation;
      const date = record.date;
      const month = date.substring(0, 7);

      rawStats.global.totalWaitSeconds += record.waitTimeSeconds;

      const sameDay = isSameDayUTC(record.queuedAt, record.completedAt);

      if (!rawStats.global.byDate[date]) {
        rawStats.global.byDate[date] = { firstArrival: Infinity, lastPickup: 0, count: 0 };
      }
      if (sameDay) {
        rawStats.global.byDate[date].firstArrival = Math.min(rawStats.global.byDate[date].firstArrival, record.queuedAt);
        rawStats.global.byDate[date].lastPickup = Math.max(rawStats.global.byDate[date].lastPickup, record.completedAt);
      }
      rawStats.global.byDate[date].count++;

      if (!rawStats.byCampus[campus]) {
        rawStats.byCampus[campus] = {
          totalRecords: 0,
          totalWaitSeconds: 0,
          avgWaitSeconds: 0,
          byDate: {},
          totalSessionSeconds: 0,
          daysCount: 0,
          avgSessionSeconds: 0,
        };
      }
      rawStats.byCampus[campus].totalRecords++;
      rawStats.byCampus[campus].totalWaitSeconds += record.waitTimeSeconds;

      if (!rawStats.byCampus[campus].byDate[date]) {
        rawStats.byCampus[campus].byDate[date] = { firstArrival: Infinity, lastPickup: 0, count: 0 };
      }
      if (sameDay) {
        rawStats.byCampus[campus].byDate[date].firstArrival = Math.min(
          rawStats.byCampus[campus].byDate[date].firstArrival,
          record.queuedAt
        );
        rawStats.byCampus[campus].byDate[date].lastPickup = Math.max(
          rawStats.byCampus[campus].byDate[date].lastPickup,
          record.completedAt
        );
      }

      if (!rawStats.byMonth[month]) {
        rawStats.byMonth[month] = {
          totalRecords: 0,
          totalWaitSeconds: 0,
          avgWaitSeconds: 0,
          byDate: {},
          totalSessionSeconds: 0,
          daysCount: 0,
          avgSessionSeconds: 0,
        };
      }
      rawStats.byMonth[month].totalRecords++;
      rawStats.byMonth[month].totalWaitSeconds += record.waitTimeSeconds;

      if (!rawStats.byMonth[month].byDate[date]) {
        rawStats.byMonth[month].byDate[date] = { firstArrival: Infinity, lastPickup: 0, count: 0 };
      }
      if (sameDay) {
        rawStats.byMonth[month].byDate[date].firstArrival = Math.min(
          rawStats.byMonth[month].byDate[date].firstArrival,
          record.queuedAt
        );
        rawStats.byMonth[month].byDate[date].lastPickup = Math.max(
          rawStats.byMonth[month].byDate[date].lastPickup,
          record.completedAt
        );
      }
    }

    rawStats.global.avgWaitSeconds = Math.round(rawStats.global.totalWaitSeconds / rawStats.global.totalRecords);

    for (const [date, data] of Object.entries(rawStats.global.byDate)) {
      const sessionSec = calculateSessionDuration(data.firstArrival, data.lastPickup);
      if (sessionSec > 0) {
        rawStats.global.totalSessionSeconds += sessionSec;
        rawStats.global.daysCount++;
      }
    }
    rawStats.global.avgSessionSeconds = rawStats.global.daysCount > 0
      ? Math.round(rawStats.global.totalSessionSeconds / rawStats.global.daysCount)
      : 0;

    for (const campus of Object.keys(rawStats.byCampus)) {
      rawStats.byCampus[campus].avgWaitSeconds = Math.round(
        rawStats.byCampus[campus].totalWaitSeconds / rawStats.byCampus[campus].totalRecords
      );
      for (const [date, data] of Object.entries(rawStats.byCampus[campus].byDate)) {
        const sessionSec = calculateSessionDuration(data.firstArrival, data.lastPickup);
        if (sessionSec > 0) {
          rawStats.byCampus[campus].totalSessionSeconds += sessionSec;
          rawStats.byCampus[campus].daysCount++;
        }
      }
      rawStats.byCampus[campus].avgSessionSeconds = rawStats.byCampus[campus].daysCount > 0
        ? Math.round(
          rawStats.byCampus[campus].totalSessionSeconds / rawStats.byCampus[campus].daysCount
        )
        : 0;
    }

    for (const month of Object.keys(rawStats.byMonth)) {
      rawStats.byMonth[month].avgWaitSeconds = Math.round(
        rawStats.byMonth[month].totalWaitSeconds / rawStats.byMonth[month].totalRecords
      );
      for (const [date, data] of Object.entries(rawStats.byMonth[month].byDate)) {
        const sessionSec = calculateSessionDuration(data.firstArrival, data.lastPickup);
        if (sessionSec > 0) {
          rawStats.byMonth[month].totalSessionSeconds += sessionSec;
          rawStats.byMonth[month].daysCount++;
        }
      }
      rawStats.byMonth[month].avgSessionSeconds = rawStats.byMonth[month].daysCount > 0
        ? Math.round(
          rawStats.byMonth[month].totalSessionSeconds / rawStats.byMonth[month].daysCount
        )
        : 0;
    }

    const globalActivity = dashboardMetrics.find(
      (m) => m.metricType === "campus_activity" && !m.campusLocation && !m.month
    );
    const globalWaitTime = dashboardMetrics.find(
      (m) => m.metricType === "avg_wait_time" && !m.campusLocation && !m.month
    );
    const globalSession = dashboardMetrics.find(
      (m) => m.metricType === "session_duration" && !m.campusLocation && !m.month
    );

    const comparison = {
      global: {
        campusActivity: {
          raw: rawStats.global.totalRecords,
          dashboard: globalActivity?.totalEvents,
          match: rawStats.global.totalRecords === globalActivity?.totalEvents,
        },
        avgWaitTime: {
          raw: rawStats.global.avgWaitSeconds,
          dashboard: globalWaitTime?.avgWaitSeconds,
          match: rawStats.global.avgWaitSeconds === globalWaitTime?.avgWaitSeconds,
        },
        totalWaitSeconds: {
          raw: rawStats.global.totalWaitSeconds,
          dashboard: globalWaitTime?.totalWaitSeconds,
          match: rawStats.global.totalWaitSeconds === globalWaitTime?.totalWaitSeconds,
        },
        sessionDuration: {
          raw: rawStats.global.avgSessionSeconds,
          dashboard: globalSession?.avgSessionSeconds,
          rawTotal: rawStats.global.totalSessionSeconds,
          dashboardTotal: globalSession?.totalSessionSeconds,
          rawDays: rawStats.global.daysCount,
          dashboardDays: globalSession?.daysCount,
        },
      },
      byCampus: {} as Record<string, any>,
      byMonth: {} as Record<string, any>,
    };

    for (const [campus, stats] of Object.entries(rawStats.byCampus)) {
      const campusActivity = dashboardMetrics.find(
        (m) => m.metricType === "campus_activity" && m.campusLocation === campus && !m.month
      );
      const campusWaitTime = dashboardMetrics.find(
        (m) => m.metricType === "avg_wait_time" && m.campusLocation === campus && !m.month
      );
      const campusSession = dashboardMetrics.find(
        (m) => m.metricType === "session_duration" && m.campusLocation === campus && !m.month
      );

      comparison.byCampus[campus] = {
        activity: { raw: stats.totalRecords, dashboard: campusActivity?.totalEvents, match: stats.totalRecords === campusActivity?.totalEvents },
        avgWait: { raw: stats.avgWaitSeconds, dashboard: campusWaitTime?.avgWaitSeconds, match: stats.avgWaitSeconds === campusWaitTime?.avgWaitSeconds },
        avgSession: { raw: stats.avgSessionSeconds, dashboard: campusSession?.avgSessionSeconds, match: stats.avgSessionSeconds === campusSession?.avgSessionSeconds },
        days: { raw: stats.daysCount, dashboard: campusSession?.daysCount, match: stats.daysCount === campusSession?.daysCount },
      };
    }

    for (const [month, stats] of Object.entries(rawStats.byMonth)) {
      const monthActivity = dashboardMetrics.find(
        (m) => m.metricType === "campus_activity" && !m.campusLocation && m.month === month
      );
      const monthWaitTime = dashboardMetrics.find(
        (m) => m.metricType === "avg_wait_time" && !m.campusLocation && m.month === month
      );
      const monthSession = dashboardMetrics.find(
        (m) => m.metricType === "session_duration" && !m.campusLocation && m.month === month
      );

      comparison.byMonth[month] = {
        activity: { raw: stats.totalRecords, dashboard: monthActivity?.totalEvents, match: stats.totalRecords === monthActivity?.totalEvents },
        avgWait: { raw: stats.avgWaitSeconds, dashboard: monthWaitTime?.avgWaitSeconds, match: stats.avgWaitSeconds === monthWaitTime?.avgWaitSeconds },
        avgSession: { raw: stats.avgSessionSeconds, dashboard: monthSession?.avgSessionSeconds },
        days: { raw: stats.daysCount, dashboard: monthSession?.daysCount, match: stats.daysCount === monthSession?.daysCount },
      };
    }

    return {
      comparison,
    };
  },
});

/**
 * Sample recent dismissalHistory records to check wait time data quality
 */
export const sampleWaitTimes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("dismissalHistory")
      .order("desc")
      .take(20);

    return records.map((record) => {
      const calculatedWaitSeconds = Math.floor(
        (record.completedAt - record.queuedAt) / 1000
      );
      const waitMinutes = Math.round(record.waitTimeSeconds / 60);
      const calculatedMinutes = Math.round(calculatedWaitSeconds / 60);

      let issue = "OK";
      const diff = Math.abs(record.waitTimeSeconds - calculatedWaitSeconds);
      
      if (diff > 1) {
        issue = `MISMATCH: Stored ${record.waitTimeSeconds}s (${waitMinutes}min) but calculated ${calculatedWaitSeconds}s (${calculatedMinutes}min)`;
      } else if (record.waitTimeSeconds > 7200) {
        issue = `SUSPICIOUS: ${record.waitTimeSeconds}s = ${waitMinutes} minutes (over 2 hours!)`;
      } else if (record.waitTimeSeconds < 0) {
        issue = `ERROR: Negative wait time`;
      }

      return {
        _id: record._id,
        carNumber: record.carNumber,
        campusLocation: record.campusLocation,
        date: record.date,
        queuedAt: new Date(record.queuedAt).toISOString(),
        completedAt: new Date(record.completedAt).toISOString(),
        storedWaitSeconds: record.waitTimeSeconds,
        calculatedWaitSeconds,
        storedMinutes: waitMinutes,
        calculatedMinutes,
        issue,
      };
    });
  },
});
