"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { BusRosterPanel } from "@/components/dismissal/bus-roster-panel";

export default function BusPage() {
  const t = useTranslations("transport");
  const { isAuthenticated } = useConvexAuth();
  const context = useQuery(api.studentDismissals.getDriverContext, isAuthenticated ? {} : "skip");
  if (!context) return <p role="status">{t("loading")}</p>;
  if (!context.busNumber) return <p>{t("noAssignment")}</p>;
  return (
    <div className="w-full min-w-0 pb-8">
      <BusRosterPanel
        key={context.busNumber}
        campuses={context.campuses}
        carNumber={context.busNumber}
      />
    </div>
  );
}
