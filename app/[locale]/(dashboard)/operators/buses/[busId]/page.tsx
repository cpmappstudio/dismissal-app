"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DetailHeader } from "@/components/dashboard/detail-header";
import { BusDialog } from "@/components/dashboard/buses/bus-dialog";
import { BusHero } from "@/components/dashboard/buses/bus-hero";
import { BusRosterPanel } from "@/components/dismissal/bus-roster-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BusDetailPage({
  params,
}: {
  params: Promise<{ locale: string; busId: string }>;
}) {
  const { locale, busId } = use(params);
  const t = useTranslations("buses");
  const transport = useTranslations("transport");
  const { isAuthenticated } = useConvexAuth();
  const bus = useQuery(
    api.buses.get,
    isAuthenticated ? { busId: busId as Id<"buses"> } : "skip",
  );
  if (bus === undefined) return <p role="status">{transport("loading")}</p>;
  if (bus === null) notFound();
  return (
    <div className="flex flex-1 flex-col gap-6 pb-8">
      <DetailHeader
        title={bus.name}
        backHref={`/${locale}/operators/buses`}
        backLabel={t("back")}
        action={bus.canEdit ? <BusDialog bus={bus} /> : undefined}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="gap-3 overflow-hidden pt-0">
          <BusHero />
          <CardHeader>
            <CardTitle>
              {transport("bus")} · {bus.identifier}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <h2 className="font-medium">{transport("drivers")}</h2>
            {bus.drivers.length ? (
              <ul className="space-y-2">
                {bus.drivers.map((driver) => (
                  <li key={driver.id}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span>{driver.name}</span>
                      {driver.username && (
                        <span className="text-sm text-muted-foreground">
                          @{driver.username}
                        </span>
                      )}
                    </p>
                    {driver.phone && (
                      <p className="text-sm text-muted-foreground">
                        {driver.phone}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noDriver")}</p>
            )}
          </CardContent>
        </Card>
        <BusRosterPanel
          key={bus.identifier}
          campuses={bus.campuses}
          carNumber={bus.identifier}
        />
      </div>
    </div>
  );
}
