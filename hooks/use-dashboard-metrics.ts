import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { useOperationalDate } from "@/hooks/use-operational-date";

export function useCampusActivity(filters?: DashboardFilters) {
  return useQuery(api.dashboard.getCampusActivity, {
    campus: filters?.campus,
    month: filters?.month,
  });
}

export function useDurationTrends(filters?: DashboardFilters) {
  const throughDate = useOperationalDate();
  return useQuery(api.dashboard.getDurationTrends, {
    campus: filters?.campus,
    month: filters?.month,
    throughDate,
  });
}

export function useTopArrivals(filters?: DashboardFilters) {
  return useQuery(api.dashboard.getTopArrivals, {
    campus: filters?.campus,
    month: filters?.month,
  });
}

export function useAllCampusActivity(month?: string) {
  return useQuery(api.dashboard.getAllCampusActivity, {
    month,
  });
}
