"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { BusRoster } from "@/components/dismissal/bus-roster";

export default function BusPage() {
  const t = useTranslations("transport");
  const context = useQuery(api.studentDismissals.getDriverContext);
  const [selectedCampus, setSelectedCampus] = useState("");
  if (!context) return <p role="status">{t("loading")}</p>;
  const campus =
    context.campuses.find((c) => c.name === selectedCampus) ??
    context.campuses[0];
  if (!campus || !context.busNumber) return <p>{t("noAssignment")}</p>;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      {context.campuses.length > 1 && (
        <label className="block">
          {t("campus")}
          <select
            className="mt-1 block w-full rounded border p-2"
            value={campus.name}
            onChange={(e) => setSelectedCampus(e.target.value)}
          >
            {context.campuses.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <BusRoster
        key={`${campus.name}-${context.busNumber}`}
        campus={campus.name}
        timezone={campus.timezone}
        carNumber={context.busNumber}
      />
    </div>
  );
}
