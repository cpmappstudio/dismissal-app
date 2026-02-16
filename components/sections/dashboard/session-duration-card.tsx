"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSessionDuration } from "@/hooks/use-dashboard-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { Clock } from "lucide-react";

interface SessionDurationCardProps {
  filters?: DashboardFilters;
}

export function SessionDurationCard({ filters }: SessionDurationCardProps) {
  const metric = useSessionDuration(filters);

  if (metric === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Duration</CardTitle>
          <CardDescription>
            Average daily dismissal session time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metric) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Duration</CardTitle>
          <CardDescription>
            Average daily dismissal session time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const avgMinutes = Math.round((metric.avgSessionSeconds || 0) / 60);

  return (
    <Card className="bg-gradient-to-tr from-american-blue to-yankees-blue">
      <CardHeader className="flex flex-col justify-center items-center">
        <CardTitle className="text-xl sm:text-2xl text-accent">
          Dismissal Session Length
        </CardTitle>
        <CardDescription className="text-muted">
          Average daily dismissal session time
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2">
        <Clock className="h-14 w-14 sm:h-18 sm:w-18 text-secondary" />
        <div className="grid grid-rows-2 items-center justify-center">
          <p className="text-4xl sm:text-5xl text-accent font-bold">{avgMinutes}</p>
          <span className="text-xl sm:text-2xl text-accent">minutes</span>
        </div>
      </CardContent>
    </Card>
  );
}
