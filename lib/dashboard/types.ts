export interface DashboardMetric {
  metricType: "campus_activity" | "avg_wait_time" | "session_duration";
  campusLocation?: string;
  month?: string;
  totalEvents?: number;
  totalWaitSeconds?: number;
  avgWaitSeconds?: number;
  totalSessionSeconds?: number;
  avgSessionSeconds?: number;
  daysCount?: number;
  recordCount: number;
  lastUpdatedAt: number;
}

export interface TopArrival {
  carNumber: number;
  queuedAt: number;
  studentNames: string[];
  position: number;
}

export interface DashboardTopArrivals {
  campusLocation: string;
  month: string;
  topArrivals: TopArrival[];
  lastUpdatedAt: number;
}

export interface DashboardFilters {
  campus?: string;
  month?: string;
}

export interface CampusActivityData {
  campus: string;
  events: number;
}
