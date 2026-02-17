"use client";

import { CampusActivityCard } from "./campus-activity-card";
import { AverageWaitTimeCard } from "./average-wait-time-card";
import { SessionDurationCard } from "./session-duration-card";
import { TopArrivalsCard } from "./top-arrivals-card";

export function DismissalDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex-1 grid gap-4 md:grid-cols-2">
        <AverageWaitTimeCard />
        <SessionDurationCard />
      </div>
      <div className="flex-1 grid gap-4 grid-cols-1">
        <CampusActivityCard />
      </div>

      <div className="flex-1 grid gap-4 grid-cols-1">
        <TopArrivalsCard />
      </div>
    </div>
  );
}
