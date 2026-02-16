import { GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import { DataModel } from "../_generated/dataModel";

// ============================================================================
// Data Validation Constants
// ============================================================================

export const DATA_VALIDATION = {
  MAX_WAIT_SECONDS: 7200, // 2 hours max
  MIN_WAIT_SECONDS: 0,    // No negative values
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export function isSameDayUTC(ts1: number, ts2: number): boolean {
  const date1 = new Date(ts1).toISOString().split("T")[0];
  const date2 = new Date(ts2).toISOString().split("T")[0];
  return date1 === date2;
}

// ============================================================================
// Data Validation Functions (Metric-Specific)
// ============================================================================

export interface DismissalRecord {
  _id: string;
  carNumber: number;
  campusLocation: string;
  queuedAt: number;
  completedAt: number;
  waitTimeSeconds: number;
  date: string;
  studentIds: string[];
  studentNames: string[];
  lane: "left" | "right";
  addedBy: string;
  removedBy: string;
}

/**
 * Validates record for wait time metrics.
 * Excludes: negative wait times, excessive wait times (> 2 hours), inverted timestamps
 */
export function isValidForWaitTime(record: DismissalRecord): boolean {
  if (
    record.waitTimeSeconds < DATA_VALIDATION.MIN_WAIT_SECONDS ||
    record.waitTimeSeconds > DATA_VALIDATION.MAX_WAIT_SECONDS
  ) {
    return false;
  }
  if (record.completedAt < record.queuedAt) {
    return false;
  }
  return true;
}

/**
 * Validates record for session duration metrics.
 * Excludes: cross-day records (queuedAt and completedAt on different days)
 */
export function isValidForSessionDuration(record: DismissalRecord): boolean {
  return isSameDayUTC(record.queuedAt, record.completedAt);
}

/**
 * Validates record for top arrivals.
 * Excludes: cross-day records
 */
export function isValidForTopArrivals(record: DismissalRecord): boolean {
  return isSameDayUTC(record.queuedAt, record.completedAt);
}

/**
 * Legacy function - validates all conditions.
 * Use metric-specific validators instead.
 */
export function isValidRecord(record: DismissalRecord): boolean {
  return isValidForWaitTime(record) && isValidForSessionDuration(record);
}

/**
 * Legacy function - filters using all conditions.
 * Use metric-specific filtering instead.
 */
export function filterValidRecords(records: DismissalRecord[]): {
  valid: DismissalRecord[];
  filteredCount: number;
} {
  const valid = records.filter(isValidRecord);
  return {
    valid,
    filteredCount: records.length - valid.length,
  };
}

// ============================================================================
// Interfaces
// ============================================================================

export interface DailyMetrics {
  byCampus: Record<string, CampusMetrics>;
  global: GlobalMetrics;
}

export interface CampusMetrics {
  // Activity metrics (all records count)
  totalEvents: number;
  // Wait time metrics (only records with valid wait times)
  totalWaitSeconds: number;
  validWaitTimeCount: number;
  // Session duration metrics (only same-day records)
  firstArrival: number;
  lastPickup: number;
}

export interface GlobalMetrics {
  // Activity metrics (all records count)
  totalEvents: number;
  // Wait time metrics (only records with valid wait times)
  totalWaitSeconds: number;
  validWaitTimeCount: number;
  // Session duration metrics (only same-day records)
  firstArrival: number;
  lastPickup: number;
}

export interface MetricUpdate {
  totalEvents?: number;
  totalWaitSeconds?: number;
  avgWaitSeconds?: number;
  totalSessionSeconds?: number;
  avgSessionSeconds?: number;
  daysCount?: number;
  recordCount: number;
}

/**
 * Calculates daily metrics with selective filtering per metric type:
 * - Activity: ALL records count (no filtering)
 * - Wait time: Only records with valid wait times
 * - Session duration: Only same-day records
 */
export function calculateDailyMetrics(records: any[]): DailyMetrics {
  const byCampus: Record<string, CampusMetrics> = {};
  
  let globalFirstArrival = Infinity;
  let globalLastPickup = 0;
  let globalTotalEvents = 0;
  let globalTotalWait = 0;
  let globalValidWaitCount = 0;

  let filteredWaitTimeCount = 0;
  let filteredSessionCount = 0;

  for (const record of records) {
    const campus = record.campusLocation;
    
    if (!byCampus[campus]) {
      byCampus[campus] = {
        totalEvents: 0,
        totalWaitSeconds: 0,
        validWaitTimeCount: 0,
        firstArrival: Infinity,
        lastPickup: 0,
      };
    }

    // ACTIVITY: Count ALL records (no filtering)
    byCampus[campus].totalEvents++;
    globalTotalEvents++;

    // WAIT TIME: Only add if valid for wait time metrics
    if (isValidForWaitTime(record)) {
      byCampus[campus].totalWaitSeconds += record.waitTimeSeconds;
      byCampus[campus].validWaitTimeCount++;
      globalTotalWait += record.waitTimeSeconds;
      globalValidWaitCount++;
    } else {
      filteredWaitTimeCount++;
    }

    // SESSION DURATION: Only track arrival/pickup for same-day records
    if (isValidForSessionDuration(record)) {
      byCampus[campus].firstArrival = Math.min(
        byCampus[campus].firstArrival,
        record.queuedAt
      );
      byCampus[campus].lastPickup = Math.max(
        byCampus[campus].lastPickup,
        record.completedAt
      );

      globalFirstArrival = Math.min(globalFirstArrival, record.queuedAt);
      globalLastPickup = Math.max(globalLastPickup, record.completedAt);
    } else {
      filteredSessionCount++;
    }
  }

  if (filteredWaitTimeCount > 0 || filteredSessionCount > 0) {
    console.log(
      `[Dashboard] Filtered: ${filteredWaitTimeCount} for wait time, ${filteredSessionCount} for session duration (from ${records.length} total)`
    );
  }

  return {
    byCampus,
    global: {
      totalEvents: globalTotalEvents,
      totalWaitSeconds: globalTotalWait,
      validWaitTimeCount: globalValidWaitCount,
      firstArrival: globalFirstArrival,
      lastPickup: globalLastPickup,
    },
  };
}

export function calculateSessionDuration(
  firstArrival: number,
  lastPickup: number
): number {
  if (firstArrival === Infinity || lastPickup === 0) {
    return 0;
  }
  return Math.floor((lastPickup - firstArrival) / 1000);
}

export function calculateAverage(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

export async function getExistingMetric(
  db: GenericDatabaseReader<DataModel>,
  metricType: string,
  campus?: string,
  month?: string
): Promise<any> {
  let results;
  
  if (campus && month) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_campus_month", (q) =>
        q
          .eq("metricType", metricType as any)
          .eq("campusLocation", campus)
          .eq("month", month)
      )
      .collect();
  } else if (campus) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_campus", (q) =>
        q.eq("metricType", metricType as any).eq("campusLocation", campus)
      )
      .filter((q) => q.eq(q.field("month"), undefined))
      .collect();
  } else if (month) {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type_month", (q) =>
        q.eq("metricType", metricType as any).eq("month", month)
      )
      .filter((q) => q.eq(q.field("campusLocation"), undefined))
      .collect();
  } else {
    results = await db
      .query("dashboardMetrics")
      .withIndex("by_type", (q) => q.eq("metricType", metricType as any))
      .filter((q) => 
        q.and(
          q.eq(q.field("campusLocation"), undefined),
          q.eq(q.field("month"), undefined)
        )
      )
      .collect();
  }

  return results[0] || null;
}

export async function upsertMetric(
  db: GenericDatabaseWriter<DataModel>,
  metricType: string,
  campus: string | undefined,
  month: string | undefined,
  updates: MetricUpdate
): Promise<void> {
  const existing = await getExistingMetric(db as any, metricType, campus, month);

  const data = {
    metricType: metricType as any,
    campusLocation: campus,
    month,
    ...updates,
    lastUpdatedAt: Date.now(),
  };

  if (existing) {
    await db.patch(existing._id, { ...updates, lastUpdatedAt: Date.now() });
  } else {
    await db.insert("dashboardMetrics", data);
  }
}

export async function calculateTopArrivalsForMonth(
  db: GenericDatabaseReader<DataModel>,
  campus: string,
  month: string
): Promise<any[]> {
  const records = await db
    .query("dismissalHistory")
    .withIndex("by_campus_date", (q) => q.eq("campusLocation", campus))
    .filter((q) => q.gte(q.field("date"), `${month}-01`))
    .filter((q) => q.lt(q.field("date"), getNextMonth(month)))
    .collect();

  // Filtrar solo registros válidos (misma fecha llegada/recogida)
  const validRecords = (records as DismissalRecord[]).filter(isValidForTopArrivals);

  // Agrupar por día
  const recordsByDate: Record<string, DismissalRecord[]> = {};
  for (const record of validRecords) {
    if (!recordsByDate[record.date]) recordsByDate[record.date] = [];
    recordsByDate[record.date].push(record);
  }

  // Contador de apariciones en top 5 diario
  const carStats: Record<number, { count: number; studentNames: string[]; firstQueuedAt: number }> = {};

  for (const date in recordsByDate) {
    const dayRecords = recordsByDate[date]
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .slice(0, 5);
    for (const record of dayRecords) {
      if (!carStats[record.carNumber]) {
        carStats[record.carNumber] = {
          count: 0,
          studentNames: record.studentNames,
          firstQueuedAt: record.queuedAt,
        };
      }
      carStats[record.carNumber].count++;
      // Guardar el primer queuedAt del mes para desempate
      if (record.queuedAt < carStats[record.carNumber].firstQueuedAt) {
        carStats[record.carNumber].firstQueuedAt = record.queuedAt;
      }
    }
  }

  // Convertir a array y ordenar por cantidad de apariciones (desc), luego por primer arrival (asc)
  const sorted = Object.entries(carStats)
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return a[1].firstQueuedAt - b[1].firstQueuedAt;
    })
    .slice(0, 5)
    .map(([carNumber, stat], index) => ({
      carNumber: Number(carNumber),
      studentNames: stat.studentNames,
      queuedAt: stat.firstQueuedAt, // Para cumplir con el validador del schema
      position: index + 1,
    }));

  return sorted;
}

export async function upsertTopArrivals(
  db: GenericDatabaseWriter<DataModel>,
  campus: string,
  month: string,
  topArrivals: any[]
): Promise<void> {
  const existing = await db
    .query("dashboardTopArrivals")
    .withIndex("by_campus_month", (q) =>
      q.eq("campusLocation", campus).eq("month", month)
    )
    .unique();

  const data = {
    campusLocation: campus,
    month,
    topArrivals,
    lastUpdatedAt: Date.now(),
  };

  if (existing) {
    await db.patch(existing._id, { topArrivals, lastUpdatedAt: Date.now() });
  } else {
    await db.insert("dashboardTopArrivals", data);
  }
}

function getNextMonth(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}
