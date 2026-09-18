import { Badge } from "@/components/ui/badge";
import type { CampusStatus } from "@/lib/campus-settings/campus-settings-overview";

interface CampusStatusBadgeProps {
    status: CampusStatus;
}

export function CampusStatusBadge({ status }: CampusStatusBadgeProps) {
    const styles: Record<CampusStatus, string> = {
        active: "text-success",
        inactive: "text-muted-foreground",
        maintenance: "text-amber-700 dark:text-amber-400",
    };

    const labels: Record<CampusStatus, string> = {
        active: "Active",
        inactive: "Inactive",
        maintenance: "Maintenance",
    };

    return (
        <Badge
            variant="outline"
            className={`rounded-full border-border bg-card px-3 py-0.5 text-xs font-medium shadow-sm ${styles[status] ?? styles.inactive}`}
        >
            {labels[status] ?? status}
        </Badge>
    );
}
