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
import { formatTimestamp } from "@/lib/dashboard/utils";

interface TopArrivalsCardProps {
  campus: string;
  month: string;
}

export function TopArrivalsCard({ campus, month }: TopArrivalsCardProps) {
  const data = useTopArrivals(campus, month);


  if (data === undefined) {
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


  // Unificar todos los topArrivals de todos los registros devueltos

  // Unificar todos los topArrivals de todos los registros devueltos
  const allTopArrivals = (data ?? [])
    .flatMap((record) =>
      (record.topArrivals ?? []).map((arrival) => ({
        ...arrival,
        campusLocation: record.campusLocation,
        month: record.month,
      }))
    );

  // Calcular apariciones por carNumber en todos los días del mes
  // 1. Obtener todos los días del mes
  const days = Array.from(new Set((data ?? []).flatMap(record => record.topArrivals?.map(a => {
    // Extraer día a partir de queuedAt (YYYY-MM-DD)
    const d = new Date(a.queuedAt);
    return d.toISOString().split("T")[0];
  }) ?? [])));

  // 2. Mapear carNumber a cantidad de apariciones en el top 5 diario
  const carAppearances: Record<number, number> = {};
  (data ?? []).forEach(record => {
    (record.topArrivals ?? []).forEach(arrival => {
      carAppearances[arrival.carNumber] = (carAppearances[arrival.carNumber] || 0) + 1;
    });
  });

  if (!data || data.length === 0 || allTopArrivals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Fastest Arrivals</CardTitle>
          <CardDescription>
            {campus} - {month}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }


  // Ordenar por posición ascendente (1 es el más frecuente)
  // y agregar la cantidad de apariciones
  const sortedArrivals = allTopArrivals
    .map(a => ({ ...a, appearances: carAppearances[a.carNumber] || 0 }))
    .sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return a.position - b.position;
    });
  const top3 = sortedArrivals.slice(0, 3);
  const rest = sortedArrivals.slice(3);

  // Podio: 1° al centro, 2° izq, 3° der
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
        <CardTitle className="text-2xl">Top 5 Most Frequent Early Arrivals</CardTitle>
        <CardDescription>Cars that appeared most often in the daily top 5 this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Podio Top 3 */}
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-4 pb-6">
            {podiumOrder.map((arrival, displayIndex) => {
              const originalIndex = top3.indexOf(arrival);
              const carLabel = `Car #${arrival.carNumber}`;
              const students = arrival.studentNames.join(", ");
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
                        {arrival.carNumber}
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
                    <p className="text-xs text-muted-foreground">
                      {students}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {arrival.appearances} appearances in daily top 5
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

        {/* Lista del resto */}
        {rest.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2 px-2">
              {rest.map((arrival, index) => {
                const rank = arrival.position;
                const carLabel = `Car #${arrival.carNumber}`;
                const students = arrival.studentNames.join(", ");
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
                      <span className="text-sm font-medium">{carLabel}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {students}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {arrival.appearances} appearances in daily top 5
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
