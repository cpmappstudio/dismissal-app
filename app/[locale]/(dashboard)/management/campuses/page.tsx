"use client"

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CampusSettingsOverview } from "@/components/dashboard/campus-settings/campus-settings-overview";
import { useCampusData } from "@/hooks/use-campus-data";
import {
    mapCampusSettingsDocToOverview,
} from "@/lib/campus-settings/campus-settings-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

function DeletedCampusAlert() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const t = useTranslations("campusManagement");

    const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [alert, setAlert] = useState<{
        show: boolean;
        title: string;
        message: string;
    }>({
        show: false,
        title: "",
        message: "",
    });

    const hideAlert = useCallback(() => {
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
            alertTimeoutRef.current = null;
        }
        setAlert((prev) => ({ ...prev, show: false }));
    }, []);

    useEffect(() => {
        const deletedCampusName = searchParams.get("deleted");
        if (deletedCampusName) {
            setAlert({
                show: true,
                title: t("alerts.deleteSuccess.title"),
                message: t("alerts.deleteSuccess.message", { name: decodeURIComponent(deletedCampusName) }),
            });

            router.replace("/management/campuses", { scroll: false });

            alertTimeoutRef.current = setTimeout(() => {
                setAlert((prev) => ({ ...prev, show: false }));
                alertTimeoutRef.current = null;
            }, 5000);
        }

        return () => {
            if (alertTimeoutRef.current) {
                clearTimeout(alertTimeoutRef.current);
            }
        };
    }, [searchParams, router, t]);

    if (!alert.show) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
            <Alert
                variant="default"
                className="max-w-sm w-auto bg-white shadow-lg cursor-pointer border-2 transition-all hover:shadow-xl"
                onClick={hideAlert}
            >
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                <AlertDescription className="text-sm mt-1">
                    {alert.message}
                    <div className="text-xs text-muted-foreground mt-1">
                        {t("alerts.tapToDismiss")}
                    </div>
                </AlertDescription>
            </Alert>
        </div>
    );
}

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
        <>
            <div className="flex-1">
                <CampusSettingsOverview campusSettings={mappedSettings} />
            </div>

            <Suspense fallback={null}>
                <DeletedCampusAlert />
            </Suspense>
        </>
    );
}
