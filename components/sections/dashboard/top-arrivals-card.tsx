"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTopArrivals } from "@/hooks/use-dashboard-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Car } from "lucide-react";
import type { DashboardFilters } from "@/lib/dashboard/types";

interface TopArrivalsCardProps {
  filters?: DashboardFilters;
}

export function TopArrivalsCard({ filters }: TopArrivalsCardProps) {
  const data = useTopArrivals(filters);
  const formatStudentFragments = (studentNames: string[]) => {
    const unique = new Set(
      studentNames
        .map((fullName) => {
          const parts = fullName.trim().split(/\s+/);
          return parts[parts.length - 1] ?? fullName;
        })
        .filter((part) => part.length > 0),
    );
    return Array.from(unique).join(", ");
  };

  if (data === undefined) {
    return (
      <Card className="bg-card">
        <CardHeader className="flex flex-col justify-center items-center">
          <Skeleton className="bg-american-blue/40 h-8 w-64 rounded-md mb-2" />
          <Skeleton className="bg-american-blue/40 h-4 w-48 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Podio Top 3 */}
          <div className="flex items-end justify-center gap-4 pb-6">
            {[
              { height: "h-32", order: 0 },
              { height: "h-40", order: 1 },
              { height: "h-24", order: 2 },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2"
                style={{ order: item.order }}
              >
                <div className="relative">
                  <Skeleton className="bg-american-blue/40 h-16 w-16 rounded-full" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="bg-american-blue/40 h-3 w-16 rounded-md" />
                  <Skeleton className="bg-american-blue/40 h-6 w-10 rounded-md" />
                </div>

                <Skeleton
                  className={`bg-american-blue/40 ${item.height} w-20 rounded-t-lg`}
                />
              </div>
            ))}
          </div>

          {/* Lista resto de campuses */}
          <div className="space-y-3">
            <div className="space-y-2 px-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="bg-american-blue/40 h-6 w-8 rounded-md" />
                    <Skeleton className="bg-american-blue/40 h-8 w-8 rounded-md" />
                    <Skeleton className="bg-american-blue/40 h-4 w-32 rounded-md" />
                  </div>
                  <Skeleton className="bg-american-blue/40 h-6 w-12 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allTopArrivals = (data ?? []).flatMap((record) =>
    (record.topArrivals ?? []).map((arrival) => ({
      carNumber: arrival.carNumber,
      queuedAt: arrival.queuedAt,
      studentNames: arrival.studentNames ?? [],
      appearances:
        typeof arrival.appearances === "number" ? arrival.appearances : 1,
      position: arrival.position,
    })),
  );

  if (!data || data.length === 0 || allTopArrivals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Most Frequent Early Arrivals</CardTitle>
          <CardDescription>
            No data available for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const sortedArrivals = allTopArrivals
    .sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (a.position !== b.position) return a.position - b.position;
      return a.queuedAt - b.queuedAt;
    })
    .slice(0, 5)
    .map((arrival, index) => ({
      ...arrival,
      position: index + 1,
    }));

  const top3 = sortedArrivals.slice(0, 3);
  const rest = sortedArrivals.slice(3);

  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const getPodiumIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Trophy className="h-6 w-6 text-amber-700" />;
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col justify-center items-center">
        <CardTitle className="text-2xl">
          Top 5 Most Frequent Early Arrivals
        </CardTitle>
        <CardDescription>
          Based on the number of appearances in the top 5 early arrivals in the
          current month
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-4 pb-6">
            {podiumOrder.map((arrival, displayIndex) => {
              const originalIndex = top3.indexOf(arrival);
              const carLabel = `Car #${arrival.carNumber}`;
              const students = formatStudentFragments(arrival.studentNames);
              const initials = students
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const heights =
                displayIndex === 1
                  ? "h-40"
                  : displayIndex === 0
                    ? "h-32"
                    : "h-24";
              return (
                <div
                  key={`${arrival.carNumber}-${arrival.position}-${displayIndex}`}
                  className="flex flex-col items-center gap-2"
                  style={{ order: displayIndex }}
                >
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-border">
                      <AvatarFallback className="bg-gradient-to-br from-american-blue to-yankees-blue text-accent text-lg font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                      {getPodiumIcon(originalIndex)}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">
                      {carLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">{students}</p>
                    <p className="text-sm font-bold flex items-center gap-1 justify-center">
                      {arrival.appearances}
                    </p>
                  </div>
                  <div
                    className={`${heights} w-20 rounded-t-lg bg-gradient-to-tr from-american-blue to-yankees-blue border-2 text-accent flex items-center justify-center text-3xl font-bold transition-all`}
                  >
                    #{arrival.position}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rest.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2 px-2">
              {rest.map((arrival, index) => {
                const rank = arrival.position;
                const carLabel = `Car #${arrival.carNumber}`;
                const students = formatStudentFragments(arrival.studentNames);
                return (
                  <div
                    key={`${arrival.carNumber}-${arrival.position}-${index}`}
                    className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl font-bold text-muted-foreground min-w-[2rem]">
                        #{rank}
                      </span>
                      <Car className="h-8 w-8 text-american-blue" />
                      <div className="fle flex-row">
                        <p className="text-sm font-medium">{carLabel}</p>
                        <span className="text-xs text-muted-foreground">
                          {students}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold">
                        {arrival.appearances}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
