"use client";

import { useDurationTrends } from "@/hooks/use-dashboard-metrics";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { DurationMetricCard } from "./duration-metric-card";

export function AverageWaitTimeCard({ filters }: { filters?: DashboardFilters }) {
  return <DurationMetricCard metric="wait" trend={useDurationTrends(filters)} />;
}
