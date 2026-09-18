"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const minutes = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function DurationMetricCard({ metric, trend }: {
  metric: "wait" | "session";
  trend: FunctionReturnType<typeof api.dashboard.getDurationTrends> | undefined;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const isWait = metric === "wait";
  const title = isWait ? "Pickup Wait Time" : "Dismissal Session Length";
  const dataKey = isWait ? "waitMinutes" : "sessionMinutes";
  const average = isWait ? trend?.avgWaitMinutes : trend?.avgSessionMinutes;
  const config = {
    [dataKey]: { label: "Minutes", color: isWait ? "var(--chart-1)" : "var(--chart-2)" },
  } satisfies ChartConfig;
  const color = `var(--color-${dataKey})`;
  const hasData = average !== null && average !== undefined;

  return (
    <Card className="min-w-0 gap-4">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        <CardDescription>
          {isWait ? "Average time from arrival to student pickup" : "Average daily dismissal session time"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trend === undefined ? (
          <div className="flex min-h-40 items-center gap-6" role="status" aria-label={`Loading ${title}`}>
            <Skeleton className="h-20 w-24 shrink-0" />
            <Skeleton className="h-36 min-w-0 flex-1" />
          </div>
        ) : trend?.limitReached ? (
          <p className="flex min-h-40 items-center text-sm text-muted-foreground" role="status">
            Too many records to chart this period. No partial averages are shown.
          </p>
        ) : !hasData ? (
          <p className="flex min-h-40 items-center text-sm text-muted-foreground">No pickup data for this period</p>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
            <div className="shrink-0">
              <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{minutes.format(average!)}</p>
              <p className="text-sm text-muted-foreground">minutes</p>
            </div>
            <ChartContainer config={config} className="h-40 min-w-40 flex-1 basis-40 aspect-auto" aria-label={`${title} by day, in minutes`}>
              <AreaChart accessibilityLayer data={trend!.points} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28}
                  tickFormatter={date => shortDate.format(new Date(`${date}T00:00:00Z`))} />
                <YAxis hide domain={[0, "auto"]} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent
                  labelFormatter={date => String(date)}
                  formatter={value => <span className="font-medium tabular-nums">{minutes.format(Number(value))} min</span>}
                />} />
                <defs>
                  <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area dataKey={dataKey} type="monotone" fill={`url(#fill-${id})`} stroke={color}
                  fillOpacity={0.4} strokeWidth={2} connectNulls dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>{title} — daily records in minutes</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Minutes</th></tr></thead>
              <tbody>{trend!.points.filter(point => point[dataKey] !== null).map(point => (
                <tr key={point.date}><th scope="row">{point.date}</th><td>{minutes.format(point[dataKey]!)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </CardContent>
      {trend && trend.points.length > 0 && (
        <CardFooter className="flex-wrap justify-between gap-1 text-xs text-muted-foreground">
          <span>{trend.startDate} – {trend.endDate}</span>
          <span>Completed days · Road pickups</span>
        </CardFooter>
      )}
    </Card>
  );
}
