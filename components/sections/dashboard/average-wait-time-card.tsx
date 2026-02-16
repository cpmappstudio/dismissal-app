"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAverageWaitTime } from "@/hooks/use-dashboard-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { Clock } from "lucide-react";

interface AverageWaitTimeCardProps {
  filters?: DashboardFilters;
}

export function AverageWaitTimeCard({ filters }: AverageWaitTimeCardProps) {
  const metric = useAverageWaitTime(filters);

  if (metric === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pickup Wait Time</CardTitle>
          <CardDescription>
            Average time from arrival to student pickup
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
          <CardTitle>Pickup Wait Time</CardTitle>
          <CardDescription>
            Average time from arrival to student pickup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const avgMinutes = Math.round((metric.avgWaitSeconds || 0) / 60);

  return (
    <Card className="bg-gradient-to-tr from-american-blue to-yankees-blue">
      <CardHeader className="flex flex-col justify-center items-center">
          <CardTitle className="text-xl sm:text-2xl text-accent">
            Pickup Wait Time
          </CardTitle>
        <CardDescription className="text-muted">
          Average time from arrival to student pickup
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
