"use client"

import { useEffect, useState } from "react";
import { CampusSettingsOverview } from "@/components/dashboard/campus-settings/campus-settings-overview";
import { useCampusData } from "@/hooks/use-campus-data";
import {
    mapCampusSettingsDocToOverview,
} from "@/lib/campus-settings/campus-settings-overview";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampusSettingsPage() {
    const campusSettings = useCampusData({ isActive: true });
    const [hasLoaded, setHasLoaded] = useState(false);

    // Track when data has actually loaded to prevent showing empty state prematurely
    useEffect(() => {
        if (campusSettings !== undefined) {
            // Add a small delay to ensure we don't flash between states
            const timer = setTimeout(() => setHasLoaded(true), 100);
            return () => clearTimeout(timer);
        }
    }, [campusSettings]);

    // Show loading state while data is being fetched
    const isLoading = campusSettings === undefined || !hasLoaded;
    
    if (isLoading) {
        return (
            <div className="flex-1 space-y-6">
                {/* Header skeleton */}
                <div className="space-y-4">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-4">
                        <Skeleton className="h-10 flex-1 max-w-sm" />
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                
                {/* Grid skeleton */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="space-y-4 rounded-lg border p-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                                <Skeleton className="h-5 w-20" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-9 flex-1" />
                                <Skeleton className="h-9 flex-1" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const mappedSettings = campusSettings?.map(mapCampusSettingsDocToOverview) || [];

    return (
        <div className="flex-1">
            <CampusSettingsOverview campusSettings={mappedSettings} />
        </div>
    );
}
