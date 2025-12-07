"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import {
  CampusSettingsDetailHeader,
  CampusSettingsOverviewCard,
} from "@/components/dashboard/campus-settings/campus-settings-detail";
import { formatAddress } from "@/lib/campus-settings/campus-settings-detail";
import { useCampusById } from "@/hooks/use-campus-data";
import type { Id } from "@/convex/_generated/dataModel";

interface CampusSettingsDetailPageProps {
  params: Promise<{ locale: string; campusId: string }>;
}

export default function CampusSettingsDetailPage({
  params,
}: CampusSettingsDetailPageProps) {
  const { locale, campusId } = use(params);

  const campus = useCampusById(campusId as Id<"campusSettings">);

  if (campus === null) {
    notFound();
  }

  if (campus === undefined) {
    return (
      <div className="relative flex flex-1 flex-col">
        <div className="relative z-10 flex flex-1 flex-col gap-6 pb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  const addressLabel = formatAddress(campus);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative z-10 flex flex-1 flex-col gap-6 pb-8">
        <CampusSettingsDetailHeader
          campus={campus}
          locale={locale}
          addressLabel={addressLabel}
        />
        <div className="grid gap-6 lg:grid-cols-1">
          <CampusSettingsOverviewCard
            campus={campus}
            addressLabel={addressLabel}
          />
        </div>
      </div>
    </div>
  );
}
