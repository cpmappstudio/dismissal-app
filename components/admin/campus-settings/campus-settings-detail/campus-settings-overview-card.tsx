"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  MapPin,
  ImageIcon,
  Users,
  GraduationCap,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface CampusSettingsOverviewCardProps {
  campus: Doc<"campusSettings">;
  addressLabel?: string | null;
}

export function CampusSettingsOverviewCard({
  campus,
  addressLabel,
}: CampusSettingsOverviewCardProps) {
  // Get logo URL from storage
  const logoUrl = useQuery(
    api.campus.getLogoUrl,
    campus.logoStorageId ? { storageId: campus.logoStorageId } : "skip",
  );

  // const dismissalSchedule = campus.dismissalStartTime && campus.dismissalEndTime
  //     ? `${campus.dismissalStartTime} - ${campus.dismissalEndTime}`
  //     : "Not configured";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campus Overview</CardTitle>
        <CardDescription>Key information about this campus.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="w-20 h-20 flex-shrink-0">
          <AspectRatio ratio={1} className="bg-muted rounded-lg">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${campus.campusName} logo`}
                fill
                className="rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </AspectRatio>
        </div>

        {/* Campus Information */}
        <div className="space-y-4">
          {campus.description && (
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Description
                </p>
                <p className="text-sm text-muted-foreground">
                  {campus.description}
                </p>
              </div>
            </div>
          )}

          {addressLabel && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Address</p>
                <p className="text-sm text-muted-foreground">{addressLabel}</p>
              </div>
            </div>
          )}

          {/* <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Dismissal Schedule</p>
                            <p className="text-sm text-muted-foreground">{dismissalSchedule}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Timezone</p>
                            <p className="text-sm text-muted-foreground">{campus.timezone}</p>
                        </div>
                    </div> */}

          {campus.metrics && (
            <>
              <div className="flex items-start gap-3">
                <GraduationCap className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Students
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {campus.metrics.activeStudents} active /{" "}
                    {campus.metrics.totalStudents} total
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Staff</p>
                  <p className="text-sm text-muted-foreground">
                    {campus.metrics.activeStaff} active /{" "}
                    {campus.metrics.totalStaff} total
                  </p>
                </div>
              </div>
            </>
          )}

          {campus.availableGrades && campus.availableGrades.length > 0 && (
            <div className="flex items-start gap-3">
              <GraduationCap className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Available Grades
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {campus.availableGrades
                    .filter((g) => g.isActive)
                    .sort((a, b) => a.order - b.order)
                    .map((grade) => (
                      <span
                        key={grade.code}
                        className="px-2 py-1 text-xs bg-muted rounded-md"
                      >
                        {grade.name}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
