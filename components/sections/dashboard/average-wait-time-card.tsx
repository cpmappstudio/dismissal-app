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
      <Card className="bg-american-blue/40">
        <CardHeader className="flex flex-col justify-center items-center">
          {/* Título */}
          <Skeleton className="bg-muted h-7 w-48 sm:h-8 rounded-md mb-2" />
          {/* Descripción */}
          <Skeleton className="bg-muted h-4 w-64 rounded-md" />
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2">
          {/* Ícono del reloj */}
          <Skeleton className="bg-muted h-14 w-14 sm:h-18 sm:w-18 rounded-full" />
          <div className="grid grid-rows-2 items-center justify-center gap-1">
            {/* Número de minutos */}
            <Skeleton className="bg-muted h-10 w-20 sm:h-12 rounded-md" />
            {/* Texto "minutes" */}
            <Skeleton className="bg-muted h-6 w-20 sm:h-7 rounded-md" />
          </div>
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
          <p className="text-4xl sm:text-5xl text-accent font-bold">
            {avgMinutes}
          </p>
          <span className="text-xl sm:text-2xl text-accent">minutes</span>
        </div>
      </CardContent>
    </Card>
  );
}
