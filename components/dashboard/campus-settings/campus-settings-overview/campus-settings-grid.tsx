import Link from "next/link";
import { useLocale } from "next-intl";
import { Users } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { CampusSettingsOverview } from "@/lib/campus-settings/campus-settings-overview";
import { CampusSettingsCard } from "./campus-settings-card";
import { CampusHeroSmall } from "./campus-settings-hero";
import { CampusStatusBadge } from "./campus-settings-status-badge";
import { CampusSettingsEmptyState } from "./campus-settings-empty-state";
import { formatItemCount } from "./utils";

interface CampusSettingsGridProps {
    campusSettings: CampusSettingsOverview[];
    isGridView: boolean;
}

interface CampusListItemProps {
    campus: CampusSettingsOverview;
}

function CampusListItem({ campus }: CampusListItemProps) {
    const locale = useLocale();
    return (
        <Link href={`/${locale}/management/campuses/${campus.id}`}>
            <Card className="group relative py-0 overflow-hidden border-border/60 bg-card shadow-sm cursor-pointer">
                <div className="flex items-center py-5 px-2">
                    {/* Small hero thumbnail */}
                    <div className="mr-4 h-16 w-24 flex-shrink-0 overflow-hidden rounded-sm">
                        <CampusHeroSmall
                            hero={campus.hero}
                            name={campus.name}
                            logoStorageId={campus.logoStorageId}
                        />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-semibold text-foreground">
                                    {campus.name}
                                </CardTitle>
                                {campus.description ? (
                                    <CardDescription className="text-sm text-muted-foreground">
                                        {campus.description}
                                    </CardDescription>
                                ) : null}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4" aria-hidden />
                                    {formatItemCount(campus.itemCount)}
                                </div>
                            </div>

                            {/* Badge positioned on the right */}
                            {campus.status ? (
                                <div className="ml-4">
                                    <CampusStatusBadge status={campus.status} />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}

export function CampusSettingsGrid({ campusSettings, isGridView }: CampusSettingsGridProps) {
    if (!campusSettings.length) {
        return <CampusSettingsEmptyState />;
    }

    if (isGridView) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {campusSettings.map((campus) => (
                    <CampusSettingsCard key={campus.id} campus={campus} />
                ))}
            </div>
        );
    }

    // List view
    return (
        <div className="space-y-3">
            {campusSettings.map((campus) => (
                <CampusListItem key={campus.id} campus={campus} />
            ))}
        </div>
    );
}
