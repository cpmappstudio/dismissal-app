"use client";

import { CampusActivityCard } from "./campus-activity-card";
import { AverageWaitTimeCard } from "./average-wait-time-card";
import { SessionDurationCard } from "./session-duration-card";
import { TopArrivalsCard } from "./top-arrivals-card";
import { Card } from "@/components/ui/card";

export function DismissalDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex-1 grid gap-4 md:grid-cols-2">
        <AverageWaitTimeCard />
        <SessionDurationCard />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-px bg-border [&>section]:bg-card">
          <CampusActivityCard />
          <TopArrivalsCard />
        </div>
      </Card>
    </div>
  );
}
