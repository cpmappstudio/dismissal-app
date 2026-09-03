import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DashboardFilters } from "@/lib/dashboard/types";

export function useCampusActivity(filters?: DashboardFilters) {
  return useQuery(api.dashboard.getCampusActivity, {
    campus: filters?.campus,
    month: filters?.month,
  });
}

export function useAverageWaitTime(filters?: DashboardFilters) {
  return useQuery(api.dashboard.getAverageWaitTime, {
    campus: filters?.campus,
    month: filters?.month,
  });
}

export function useSessionDuration(filters?: DashboardFilters) {
  return useQuery(api.dashboard.getSessionDuration, {
    campus: filters?.campus,
    month: filters?.month,
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
