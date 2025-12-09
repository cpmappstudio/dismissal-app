import Link from "next/link";
import { useLocale } from "next-intl";
import { Users } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { CampusSettingsOverview } from "@/lib/campus-settings/campus-settings-overview";
import { CampusHero } from "./campus-settings-hero";
import { CampusStatusBadge } from "./campus-settings-status-badge";
import { formatItemCount } from "./utils";

interface CampusSettingsCardProps {
    campus: CampusSettingsOverview;
}

export function CampusSettingsCard({ campus }: CampusSettingsCardProps) {
    const locale = useLocale();
    return (
        <Link href={`/${locale}/management/campuses/${campus.id}`}>
            <Card className="group pt-0 relative overflow-hidden border-border/60 bg-card shadow-sm cursor-pointer transition-all duration-200">
                <CampusHero 
                    hero={campus.hero} 
                    name={campus.name}
                    logoStorageId={campus.logoStorageId}
                />

                {campus.status ? (
                    <div className="absolute top-3 right-3 z-10">
                        <CampusStatusBadge status={campus.status} />
                    </div>
                ) : null}

                <CardHeader className="flex flex-col gap-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold text-foreground">
                                {campus.name}
                            </CardTitle>
                            {campus.description ? (
                                <CardDescription className="text-sm text-muted-foreground">
                                    {campus.description}
                                </CardDescription>
                            ) : null}
                        </div>
                    </div>
                </CardHeader>
                {/* <CardContent className="px-5 pt-0">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" aria-hidden />
                            {formatItemCount(campus.itemCount)}
                        </div>
                    </div>
                </CardContent> */}
            </Card>
        </Link>
    );
}
