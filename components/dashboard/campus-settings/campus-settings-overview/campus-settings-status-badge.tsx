import { Badge } from "@/components/ui/badge";
import type { CampusStatus } from "@/lib/campus-settings/campus-settings-overview";

interface CampusStatusBadgeProps {
    status: CampusStatus;
}

export function CampusStatusBadge({ status }: CampusStatusBadgeProps) {
    const styles: Record<CampusStatus, string> = {
        active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        inactive: "bg-gray-500/15 text-gray-700 border-gray-500/20",
        maintenance: "bg-amber-500/15 text-amber-700 border-amber-500/20",
    };

    const labels: Record<CampusStatus, string> = {
        active: "Active",
        inactive: "Inactive",
        maintenance: "Maintenance",
    };

    return (
        <Badge
            variant="outline"
            className={`rounded-full px-3 py-0.5 text-xs font-medium ${styles[status] ?? styles.inactive}`}
        >
            {labels[status] ?? status}
        </Badge>
    );
}
