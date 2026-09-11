import type { Doc } from "@/convex/_generated/dataModel";
import { DetailHeader } from "@/components/dashboard/detail-header";
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
  return (
    <DetailHeader title={campus.campusName} backHref={`/${locale}/management/campuses`}
      backLabel="Back to campuses" action={<CampusSettingsDialog campus={campus} />} />
  );
}
