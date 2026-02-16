import { internalQuery } from "./_generated/server";

// ============================================================================
// PHASE 1: Data Inventory
// ============================================================================

/**
 * Get complete inventory of dismissalHistory data
 * Returns counts by campus, date range, and monthly breakdown
 */
export const getDataInventory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRecords = await ctx.db.query("dismissalHistory").collect();

    const inventory = {
      totalRecords: allRecords.length,
      dateRange: { earliest: "", latest: "" },
      byCampus: {} as Record<
        string,
        {
          count: number;
          dateRange: { earliest: string; latest: string };
          months: string[];
        }
      >,
      byMonth: {} as Record<string, { count: number; campuses: string[] }>,
      campusNameVariations: [] as string[],
    };

    if (allRecords.length === 0) {
      return inventory;
    }

    const allDates: string[] = [];
    const campusNames = new Set<string>();

    for (const record of allRecords) {
      const campus = record.campusLocation;
      const date = record.date;
      const month = date?.substring(0, 7) || "unknown";

      campusNames.add(campus);
      if (date) allDates.push(date);

      // By campus
      if (!inventory.byCampus[campus]) {
        inventory.byCampus[campus] = {
          count: 0,
          dateRange: { earliest: date || "", latest: date || "" },
          months: [],
        };
      }
      inventory.byCampus[campus].count++;
      if (date && date < inventory.byCampus[campus].dateRange.earliest) {
        inventory.byCampus[campus].dateRange.earliest = date;
      }
      if (date && date > inventory.byCampus[campus].dateRange.latest) {
        inventory.byCampus[campus].dateRange.latest = date;
      }

      // By month
      if (!inventory.byMonth[month]) {
        inventory.byMonth[month] = { count: 0, campuses: [] };
      }
      inventory.byMonth[month].count++;
      if (!inventory.byMonth[month].campuses.includes(campus)) {
        inventory.byMonth[month].campuses.push(campus);
      }
    }

    // Set global date range
    const sortedDates = allDates.sort();
    inventory.dateRange.earliest = sortedDates[0] || "";
    inventory.dateRange.latest = sortedDates[sortedDates.length - 1] || "";

    // Set months per campus
    for (const campus of Object.keys(inventory.byCampus)) {
      const campusMonths = new Set<string>();
      for (const record of allRecords) {
        if (record.campusLocation === campus && record.date) {
          campusMonths.add(record.date.substring(0, 7));
        }
      }
      inventory.byCampus[campus].months = Array.from(campusMonths).sort();
    }

    // Detect campus name variations (similar names with different casing/spacing)
    const normalizedNames = new Map<string, string[]>();
    for (const name of campusNames) {
      const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
      if (!normalizedNames.has(normalized)) {
        normalizedNames.set(normalized, []);
      }
      normalizedNames.get(normalized)!.push(name);
    }
    for (const [, variations] of normalizedNames) {
      if (variations.length > 1) {
        inventory.campusNameVariations.push(...variations);
      }
    }

    return inventory;
  },
});

// ============================================================================
// PHASE 2: Field Integrity Validation
// ============================================================================

interface FieldIssue {
  _id: string;
  field: string;
  issue: string;
  value: unknown;
  date: string;
  campusLocation: string;
}

/**
 * Validate all fields in dismissalHistory for integrity issues
 * Returns categorized issues by field
 */
export const validateFieldIntegrity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRecords = await ctx.db.query("dismissalHistory").collect();

    const issues: FieldIssue[] = [];
    const summary = {
      totalRecords: allRecords.length,
      recordsWithIssues: 0,
      issuesByField: {} as Record<string, number>,
      issuesByType: {} as Record<string, number>,
    };

    for (const record of allRecords) {
      const recordIssues: FieldIssue[] = [];

      // 2.1 waitTimeSeconds validation
      if (record.waitTimeSeconds < 0) {
        recordIssues.push({
          _id: record._id,
          field: "waitTimeSeconds",
          issue: "NEGATIVE_VALUE",
          value: record.waitTimeSeconds,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      } else if (record.waitTimeSeconds === 0) {
        recordIssues.push({
          _id: record._id,
          field: "waitTimeSeconds",
          issue: "ZERO_VALUE",
          value: record.waitTimeSeconds,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      } else if (record.waitTimeSeconds > 7200) {
        recordIssues.push({
          _id: record._id,
          field: "waitTimeSeconds",
          issue: "EXCEEDS_2_HOURS",
          value: record.waitTimeSeconds,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // 2.2 queuedAt / completedAt validation
      if (record.completedAt < record.queuedAt) {
        recordIssues.push({
          _id: record._id,
          field: "timestamps",
          issue: "COMPLETED_BEFORE_QUEUED",
          value: { queuedAt: record.queuedAt, completedAt: record.completedAt },
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      const queuedDate = new Date(record.queuedAt).toISOString().split("T")[0];
      const completedDate = new Date(record.completedAt)
        .toISOString()
        .split("T")[0];
      if (queuedDate !== completedDate) {
        recordIssues.push({
          _id: record._id,
          field: "timestamps",
          issue: "CROSS_DAY_RECORD",
          value: { queuedDate, completedDate },
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // Verify waitTimeSeconds matches calculation
      const calculatedWait = Math.floor(
        (record.completedAt - record.queuedAt) / 1000
      );
      const diff = Math.abs(record.waitTimeSeconds - calculatedWait);
      if (diff > 1) {
        recordIssues.push({
          _id: record._id,
          field: "waitTimeSeconds",
          issue: "CALCULATION_MISMATCH",
          value: {
            stored: record.waitTimeSeconds,
            calculated: calculatedWait,
            diff,
          },
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // 2.3 date format validation
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(record.date)) {
        recordIssues.push({
          _id: record._id,
          field: "date",
          issue: "INVALID_FORMAT",
          value: record.date,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // Check date matches completedAt
      if (record.date !== completedDate) {
        recordIssues.push({
          _id: record._id,
          field: "date",
          issue: "DATE_MISMATCH_WITH_COMPLETED",
          value: { storedDate: record.date, calculatedDate: completedDate },
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // 2.4 campusLocation validation
      if (!record.campusLocation || record.campusLocation.trim() === "") {
        recordIssues.push({
          _id: record._id,
          field: "campusLocation",
          issue: "EMPTY_VALUE",
          value: record.campusLocation,
          date: record.date,
          campusLocation: record.campusLocation || "(empty)",
        });
      }

      // 2.5 carNumber validation
      if (record.carNumber <= 0) {
        recordIssues.push({
          _id: record._id,
          field: "carNumber",
          issue: "INVALID_CAR_NUMBER",
          value: record.carNumber,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      } else if (record.carNumber > 9999) {
        recordIssues.push({
          _id: record._id,
          field: "carNumber",
          issue: "SUSPICIOUS_HIGH_CAR_NUMBER",
          value: record.carNumber,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // 2.6 studentIds / studentNames validation
      if (!record.studentIds || record.studentIds.length === 0) {
        recordIssues.push({
          _id: record._id,
          field: "studentIds",
          issue: "EMPTY_ARRAY",
          value: record.studentIds,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      if (!record.studentNames || record.studentNames.length === 0) {
        recordIssues.push({
          _id: record._id,
          field: "studentNames",
          issue: "EMPTY_ARRAY",
          value: record.studentNames,
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      if (
        record.studentIds &&
        record.studentNames &&
        record.studentIds.length !== record.studentNames.length
      ) {
        recordIssues.push({
          _id: record._id,
          field: "students",
          issue: "IDS_NAMES_LENGTH_MISMATCH",
          value: {
            idsCount: record.studentIds.length,
            namesCount: record.studentNames.length,
          },
          date: record.date,
          campusLocation: record.campusLocation,
        });
      }

      // Track issues
      if (recordIssues.length > 0) {
        summary.recordsWithIssues++;
        issues.push(...recordIssues);
      }

      for (const issue of recordIssues) {
        summary.issuesByField[issue.field] =
          (summary.issuesByField[issue.field] || 0) + 1;
        summary.issuesByType[issue.issue] =
          (summary.issuesByType[issue.issue] || 0) + 1;
      }
    }

    return {
      summary,
      issues: issues.slice(0, 100), // Limit to first 100 for readability
      totalIssues: issues.length,
    };
  },
});

// ============================================================================
// PHASE 3: Outlier Detection
// ============================================================================

/**
 * Detect statistical outliers in the data
 */
export const detectOutliers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRecords = await ctx.db.query("dismissalHistory").collect();

    // Calculate wait time statistics
    const waitTimes = allRecords.map((r) => r.waitTimeSeconds);
    const waitStats = calculateStats(waitTimes);

    // Calculate events per day per campus
    const eventsByDayCampus: Record<string, Record<string, number>> = {};
    for (const record of allRecords) {
      if (!eventsByDayCampus[record.date]) {
        eventsByDayCampus[record.date] = {};
      }
      if (!eventsByDayCampus[record.date][record.campusLocation]) {
        eventsByDayCampus[record.date][record.campusLocation] = 0;
      }
      eventsByDayCampus[record.date][record.campusLocation]++;
    }

    // Flatten to array for stats
    const eventsPerDayCampus: number[] = [];
    for (const date of Object.keys(eventsByDayCampus)) {
      for (const campus of Object.keys(eventsByDayCampus[date])) {
        eventsPerDayCampus.push(eventsByDayCampus[date][campus]);
      }
    }
    const eventsStats = calculateStats(eventsPerDayCampus);

    // Calculate session durations per day per campus
    const sessionsByDayCampus: Record<
      string,
      Record<string, { first: number; last: number }>
    > = {};
    for (const record of allRecords) {
      const key = `${record.date}-${record.campusLocation}`;
      if (!sessionsByDayCampus[record.date]) {
        sessionsByDayCampus[record.date] = {};
      }
      if (!sessionsByDayCampus[record.date][record.campusLocation]) {
        sessionsByDayCampus[record.date][record.campusLocation] = {
          first: Infinity,
          last: 0,
        };
      }
      const session = sessionsByDayCampus[record.date][record.campusLocation];
      session.first = Math.min(session.first, record.queuedAt);
      session.last = Math.max(session.last, record.completedAt);
    }

    const sessionDurations: number[] = [];
    for (const date of Object.keys(sessionsByDayCampus)) {
      for (const campus of Object.keys(sessionsByDayCampus[date])) {
        const session = sessionsByDayCampus[date][campus];
        if (session.first !== Infinity && session.last !== 0) {
          const duration = (session.last - session.first) / 1000;
          if (duration > 0) sessionDurations.push(duration);
        }
      }
    }
    const sessionStats = calculateStats(sessionDurations);

    // Identify outliers
    const outliers = {
      waitTime: {
        stats: waitStats,
        thresholds: {
          tooShort: 30, // < 30 seconds
          tooLong: 7200, // > 2 hours
          statisticalHigh: waitStats.mean + 3 * waitStats.stdDev,
        },
        samples: {
          tooShort: [] as Array<{
            _id: string;
            value: number;
            date: string;
            campus: string;
          }>,
          tooLong: [] as Array<{
            _id: string;
            value: number;
            date: string;
            campus: string;
          }>,
          statisticalOutliers: [] as Array<{
            _id: string;
            value: number;
            date: string;
            campus: string;
          }>,
        },
      },
      eventsPerDay: {
        stats: eventsStats,
        thresholds: {
          tooFew: 5,
          tooMany: 500,
        },
        samples: {
          tooFew: [] as Array<{ date: string; campus: string; count: number }>,
          tooMany: [] as Array<{ date: string; campus: string; count: number }>,
        },
      },
      sessionDuration: {
        stats: sessionStats,
        thresholds: {
          tooShort: 300, // < 5 minutes
          tooLong: 28800, // > 8 hours
        },
        samples: {
          tooShort: [] as Array<{
            date: string;
            campus: string;
            duration: number;
          }>,
          tooLong: [] as Array<{
            date: string;
            campus: string;
            duration: number;
          }>,
        },
      },
    };

    // Populate wait time outliers (limit samples)
    for (const record of allRecords) {
      if (
        record.waitTimeSeconds < outliers.waitTime.thresholds.tooShort &&
        outliers.waitTime.samples.tooShort.length < 10
      ) {
        outliers.waitTime.samples.tooShort.push({
          _id: record._id,
          value: record.waitTimeSeconds,
          date: record.date,
          campus: record.campusLocation,
        });
      }
      if (
        record.waitTimeSeconds > outliers.waitTime.thresholds.tooLong &&
        outliers.waitTime.samples.tooLong.length < 10
      ) {
        outliers.waitTime.samples.tooLong.push({
          _id: record._id,
          value: record.waitTimeSeconds,
          date: record.date,
          campus: record.campusLocation,
        });
      }
      if (
        record.waitTimeSeconds > outliers.waitTime.thresholds.statisticalHigh &&
        outliers.waitTime.samples.statisticalOutliers.length < 10
      ) {
        outliers.waitTime.samples.statisticalOutliers.push({
          _id: record._id,
          value: record.waitTimeSeconds,
          date: record.date,
          campus: record.campusLocation,
        });
      }
    }

    // Populate events per day outliers
    for (const date of Object.keys(eventsByDayCampus)) {
      for (const campus of Object.keys(eventsByDayCampus[date])) {
        const count = eventsByDayCampus[date][campus];
        if (
          count < outliers.eventsPerDay.thresholds.tooFew &&
          outliers.eventsPerDay.samples.tooFew.length < 10
        ) {
          outliers.eventsPerDay.samples.tooFew.push({ date, campus, count });
        }
        if (
          count > outliers.eventsPerDay.thresholds.tooMany &&
          outliers.eventsPerDay.samples.tooMany.length < 10
        ) {
          outliers.eventsPerDay.samples.tooMany.push({ date, campus, count });
        }
      }
    }

    // Populate session duration outliers
    for (const date of Object.keys(sessionsByDayCampus)) {
      for (const campus of Object.keys(sessionsByDayCampus[date])) {
        const session = sessionsByDayCampus[date][campus];
        const duration = (session.last - session.first) / 1000;
        if (
          duration > 0 &&
          duration < outliers.sessionDuration.thresholds.tooShort &&
          outliers.sessionDuration.samples.tooShort.length < 10
        ) {
          outliers.sessionDuration.samples.tooShort.push({
            date,
            campus,
            duration,
          });
        }
        if (
          duration > outliers.sessionDuration.thresholds.tooLong &&
          outliers.sessionDuration.samples.tooLong.length < 10
        ) {
          outliers.sessionDuration.samples.tooLong.push({
            date,
            campus,
            duration,
          });
        }
      }
    }

    return outliers;
  },
});

// ============================================================================
// PHASE 4: Data Health Summary
// ============================================================================

/**
 * Generate a comprehensive data health report
 */
export const getDataHealthReport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRecords = await ctx.db.query("dismissalHistory").collect();

    if (allRecords.length === 0) {
      return {
        status: "NO_DATA",
        totalRecords: 0,
        healthScore: 0,
        issues: [],
      };
    }

    const issues: Array<{
      severity: "critical" | "warning" | "info";
      category: string;
      message: string;
      count: number;
      percentage: number;
    }> = [];

    let criticalCount = 0;
    let warningCount = 0;

    // Check for negative wait times
    const negativeWaits = allRecords.filter((r) => r.waitTimeSeconds < 0);
    if (negativeWaits.length > 0) {
      criticalCount += negativeWaits.length;
      issues.push({
        severity: "critical",
        category: "waitTimeSeconds",
        message: "Records with negative wait time",
        count: negativeWaits.length,
        percentage: (negativeWaits.length / allRecords.length) * 100,
      });
    }

    // Check for zero wait times
    const zeroWaits = allRecords.filter((r) => r.waitTimeSeconds === 0);
    if (zeroWaits.length > 0) {
      warningCount += zeroWaits.length;
      issues.push({
        severity: "warning",
        category: "waitTimeSeconds",
        message: "Records with zero wait time",
        count: zeroWaits.length,
        percentage: (zeroWaits.length / allRecords.length) * 100,
      });
    }

    // Check for excessive wait times (> 2 hours)
    const excessiveWaits = allRecords.filter((r) => r.waitTimeSeconds > 7200);
    if (excessiveWaits.length > 0) {
      warningCount += excessiveWaits.length;
      issues.push({
        severity: "warning",
        category: "waitTimeSeconds",
        message: "Records with wait time > 2 hours",
        count: excessiveWaits.length,
        percentage: (excessiveWaits.length / allRecords.length) * 100,
      });
    }

    // Check for inverted timestamps
    const invertedTimestamps = allRecords.filter(
      (r) => r.completedAt < r.queuedAt
    );
    if (invertedTimestamps.length > 0) {
      criticalCount += invertedTimestamps.length;
      issues.push({
        severity: "critical",
        category: "timestamps",
        message: "Records where completedAt < queuedAt",
        count: invertedTimestamps.length,
        percentage: (invertedTimestamps.length / allRecords.length) * 100,
      });
    }

    // Check for cross-day records
    const crossDayRecords = allRecords.filter((r) => {
      const qDate = new Date(r.queuedAt).toISOString().split("T")[0];
      const cDate = new Date(r.completedAt).toISOString().split("T")[0];
      return qDate !== cDate;
    });
    if (crossDayRecords.length > 0) {
      warningCount += crossDayRecords.length;
      issues.push({
        severity: "warning",
        category: "timestamps",
        message: "Records spanning multiple days",
        count: crossDayRecords.length,
        percentage: (crossDayRecords.length / allRecords.length) * 100,
      });
    }

    // Check for wait time calculation mismatches
    const mismatchedWaits = allRecords.filter((r) => {
      const calculated = Math.floor((r.completedAt - r.queuedAt) / 1000);
      return Math.abs(r.waitTimeSeconds - calculated) > 1;
    });
    if (mismatchedWaits.length > 0) {
      criticalCount += mismatchedWaits.length;
      issues.push({
        severity: "critical",
        category: "waitTimeSeconds",
        message: "Records where stored wait time != calculated",
        count: mismatchedWaits.length,
        percentage: (mismatchedWaits.length / allRecords.length) * 100,
      });
    }

    // Check for empty student arrays
    const emptyStudents = allRecords.filter(
      (r) => !r.studentIds || r.studentIds.length === 0
    );
    if (emptyStudents.length > 0) {
      warningCount += emptyStudents.length;
      issues.push({
        severity: "warning",
        category: "students",
        message: "Records with empty studentIds",
        count: emptyStudents.length,
        percentage: (emptyStudents.length / allRecords.length) * 100,
      });
    }

    // Check for invalid car numbers
    const invalidCarNumbers = allRecords.filter((r) => r.carNumber <= 0);
    if (invalidCarNumbers.length > 0) {
      criticalCount += invalidCarNumbers.length;
      issues.push({
        severity: "critical",
        category: "carNumber",
        message: "Records with invalid car number (<= 0)",
        count: invalidCarNumbers.length,
        percentage: (invalidCarNumbers.length / allRecords.length) * 100,
      });
    }

    // Check for campus name variations
    const campusNames = new Set(allRecords.map((r) => r.campusLocation));
    const normalizedMap = new Map<string, string[]>();
    for (const name of campusNames) {
      const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
      if (!normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, []);
      }
      normalizedMap.get(normalized)!.push(name);
    }
    const variations = Array.from(normalizedMap.values()).filter(
      (v) => v.length > 1
    );
    if (variations.length > 0) {
      const varCount = variations.flat().length;
      issues.push({
        severity: "warning",
        category: "campusLocation",
        message: `Campus name variations detected: ${variations.map((v) => v.join(" vs ")).join("; ")}`,
        count: varCount,
        percentage: 0,
      });
    }

    // Calculate health score (0-100)
    const totalRecords = allRecords.length;
    const corruptPercentage =
      ((criticalCount + warningCount * 0.5) / totalRecords) * 100;
    const healthScore = Math.max(0, Math.round(100 - corruptPercentage));

    // Sort issues by severity
    issues.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    return {
      status: healthScore >= 90 ? "HEALTHY" : healthScore >= 70 ? "WARNING" : "CRITICAL",
      totalRecords,
      healthScore,
      summary: {
        criticalIssues: criticalCount,
        warningIssues: warningCount,
        cleanRecords: totalRecords - criticalCount - warningCount,
      },
      issues,
      recommendations: generateRecommendations(issues),
    };
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStats(values: number[]): {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
    count,
    min: Math.round(min),
    max: Math.round(max),
    mean: Math.round(mean),
    median: Math.round(median),
    stdDev: Math.round(stdDev),
  };
}

function generateRecommendations(
  issues: Array<{ severity: string; category: string; message: string }>
): string[] {
  const recommendations: string[] = [];

  const categories = new Set(issues.map((i) => i.category));

  if (categories.has("waitTimeSeconds")) {
    recommendations.push(
      "Run migration to recalculate waitTimeSeconds from timestamps"
    );
    recommendations.push(
      "Add filter in dashboard queries to exclude records with waitTimeSeconds < 0 or > 7200"
    );
  }

  if (categories.has("timestamps")) {
    recommendations.push(
      "Review cross-day records and consider excluding from session duration calculations"
    );
    recommendations.push(
      "Fix inverted timestamps or mark records as invalid"
    );
  }

  if (categories.has("students")) {
    recommendations.push(
      "Review records with empty student arrays - may need to be excluded from metrics"
    );
  }

  if (categories.has("campusLocation")) {
    recommendations.push(
      "Run campus name normalization migration to standardize naming"
    );
  }

  if (categories.has("carNumber")) {
    recommendations.push(
      "Review and fix records with invalid car numbers"
    );
  }

  return recommendations;
}
