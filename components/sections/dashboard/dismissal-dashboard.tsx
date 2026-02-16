"use client";

import { useState } from "react";
import { CampusActivityCard } from "./campus-activity-card";
import { AverageWaitTimeCard } from "./average-wait-time-card";
import { SessionDurationCard } from "./session-duration-card";
import { TopArrivalsCard } from "./top-arrivals-card";

export function DismissalDashboard() {
  const [selectedCampus, setSelectedCampus] = useState<string | undefined>(
    undefined,
  );
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex-1 grid gap-4 md:grid-cols-2">
        <AverageWaitTimeCard
          filters={{
            campus: selectedCampus,
            month: selectedMonth,
          }}
        />

        <SessionDurationCard
          filters={{
            campus: selectedCampus,
            month: selectedMonth,
          }}
        />
      </div>
      <div className="flex-1 grid gap-4 grid-cols-1">
        <CampusActivityCard month={selectedMonth} />
      </div>

      <div className="flex-1 grid gap-4 grid-cols-1">
          <TopArrivalsCard campus={selectedCampus ?? ""} month={selectedMonth ?? ""} />
      </div>
    </div>
  );
}
