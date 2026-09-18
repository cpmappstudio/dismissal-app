"use client";

import { useDurationTrends } from "@/hooks/use-dashboard-metrics";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { DurationMetricCard } from "./duration-metric-card";

export function SessionDurationCard({ filters }: { filters?: DashboardFilters }) {
  return <DurationMetricCard metric="session" trend={useDurationTrends(filters)} />;
}
