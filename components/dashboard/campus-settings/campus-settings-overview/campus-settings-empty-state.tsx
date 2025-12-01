import { Building2 } from "lucide-react";
import { CampusSettingsDialog } from "../campus-settings-dialog";

export function CampusSettingsEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No campus found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Get started by creating your first campus. You can add details and manage them later.
            </p>
            <CampusSettingsDialog />
        </div>
    );
}
