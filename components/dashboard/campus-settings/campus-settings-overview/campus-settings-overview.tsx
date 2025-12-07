"use client";

import { useMemo, useState } from "react";
import type { CampusSettingsOverview } from "@/lib/campus-settings/campus-settings-overview";
import type { CampusStatus } from "@/lib/campus-settings/campus-settings-overview";
import { CampusSettingsHeader } from "./campus-settings-header";
import { CampusSettingsGrid } from "./campus-settings-grid";

interface CampusSettingsOverviewProps {
    campusSettings: CampusSettingsOverview[];
}

export function CampusSettingsOverview({ campusSettings }: CampusSettingsOverviewProps) {
    const [query, setQuery] = useState("");
    const [isGridView, setIsGridView] = useState(true);
    const [statusFilter, setStatusFilter] = useState<CampusStatus | "all">("all");

    const filteredCampusSettings = useMemo(() => {
        let filtered = campusSettings;

        // Filter by status
        if (statusFilter !== "all") {
            filtered = filtered.filter((campus) => campus.status === statusFilter);
        }

        // Filter by search query
        const normalized = query.trim().toLowerCase();
        if (normalized) {
            filtered = filtered.filter(({ name }) =>
                (name ?? "").toLowerCase().includes(normalized)
            );
        }

        return filtered;
    }, [campusSettings, query, statusFilter]);

    return (
        <div className="flex-1 space-y-6">
            <CampusSettingsHeader
                query={query}
                setQuery={setQuery}
                isGridView={isGridView}
                setIsGridView={setIsGridView}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
            />
            <CampusSettingsGrid campusSettings={filteredCampusSettings} isGridView={isGridView} />
        </div>
    );
}
