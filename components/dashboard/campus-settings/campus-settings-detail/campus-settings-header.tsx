import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CampusSettingsDialog } from "../campus-settings-dialog";

interface CampusSettingsHeaderProps {
  campus: Doc<"campusSettings">;
  locale: string;
  addressLabel?: string | null;
}

export function CampusSettingsDetailHeader({
  campus,
  locale,
}: CampusSettingsHeaderProps) {
  // Default to management/campuses, but allow override
  const defaultBackPath = `/${locale}/management/campuses`;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between ">
      <div className="space-y-1.5">
        <h1 className={`text-3xl font-semibold tracking-tight`}>
          {campus.campusName}
        </h1>
      </div>
      <div className="flex items-center gap-3 pt-1 md:pt-0">
        <Button variant="outline" className="gap-2" asChild>
          <Link href={defaultBackPath}>
            <ArrowLeft className="h-4 w-4" />
            Back to campuses
          </Link>
        </Button>
        <CampusSettingsDialog campus={campus} />
      </div>
    </div>
  );
}
