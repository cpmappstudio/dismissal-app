"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { useAllCampusActivity } from "@/hooks/use-dashboard-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import { School, Trophy, Medal, Award, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CampusActivityCardProps {
  month?: string;
}

export function CampusActivityCard({ month }: CampusActivityCardProps) {
  const metrics = useAllCampusActivity(month);

  if (metrics === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campus Activity</CardTitle>
          <CardDescription>Total pickups per campus</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const sortedMetrics = metrics.sort(
    (a, b) => (b.totalEvents || 0) - (a.totalEvents || 0),
  );

  const top3 = sortedMetrics.slice(0, 3);
  const rest = sortedMetrics.slice(3);

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
        <CardTitle className="text-2xl">Campus Activity Ranking</CardTitle>
        <CardDescription>Total pickup events per campus</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Podio Top 3 */}
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-4 pb-6">
            {podiumOrder.map((metric, displayIndex) => {
              const originalIndex = top3.indexOf(metric);
              const campusName = metric.campusLocation || "Unknown";
              const totalEvents = metric.totalEvents || 0;
              const initials = campusName
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
                  key={metric.campusLocation}
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
                      {campusName}
                    </p>
                    <p className="text-xl font-bold flex items-center gap-1 justify-center">
                      {totalEvents.toLocaleString()}
                    </p>
                  </div>
                  <div
                    className={`${heights} w-20 rounded-t-lg bg-gradient-to-tr from-american-blue to-yankees-blue border-2 text-accent flex items-center justify-center text-3xl font-bold transition-all`}
                  >
                    #{originalIndex + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista del resto con gráfico de barras */}
        {rest.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2 px-2">
              {rest.map((metric, index) => {
                const rank = index + 4;
                const campusName = metric.campusLocation || "Unknown";
                const totalEvents = metric.totalEvents || 0;

                return (
                  <div
                    key={metric.campusLocation}
                    className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl font-bold text-muted-foreground min-w-[2rem]">
                        #{rank}
                      </span>
                      <School className="h-8 w-8 text-american-blue" />
                      <span className="text-sm font-medium">{campusName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold">
                        {totalEvents.toLocaleString()}
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
