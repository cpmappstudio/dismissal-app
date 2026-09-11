"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BusRoster } from "./bus-roster";

export function BusRosterPanel({
  campuses,
  carNumber,
}: {
  campuses: { name: string; timezone: string }[];
  carNumber: number | string;
}) {
  const t = useTranslations("transport");
  const [selectedCampus, setSelectedCampus] = useState("");
  const campus = campuses.find((c) => c.name === selectedCampus) ?? campuses[0];

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {campus ? (
        <>
          <ScrollArea className="w-full min-w-0 max-w-full">
            <div
              role="group"
              aria-label={t("campus")}
              className="flex w-max gap-2 px-1 pt-1 pb-3"
            >
              {campuses.map((c) => (
                <Badge
                  key={c.name}
                  asChild
                  variant={c.name === campus.name ? "secondary" : "outline"}
                  className="shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-sm hover:bg-secondary/80"
                >
                  <button
                    type="button"
                    aria-pressed={c.name === campus.name}
                    onClick={() => setSelectedCampus(c.name)}
                  >
                    {c.name}
                  </button>
                </Badge>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <BusRoster
            key={`${carNumber}-${campus.name}`}
            campus={campus.name}
            timezone={campus.timezone}
            carNumber={carNumber}
            showDate
          />
        </>
      ) : (
        <p>{t("noAssignment")}</p>
      )}
    </div>
  );
}
