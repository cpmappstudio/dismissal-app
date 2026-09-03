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
  Expand,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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

  // Dynamic queries for students and staff counts
  // const activeStudents = useQuery(api.campus.getStudentsByCampus, {
  //   campusId: campus._id,
  //   isActive: true,
  // });
  // const allStudents = useQuery(api.campus.getStudentsByCampus, {
  //   campusId: campus._id,
  // });
  // const activeStaff = useQuery(api.campus.getStaffByCampus, {
  //   campusId: campus._id,
  //   isActive: true,
  // });
  // const allStaff = useQuery(api.campus.getStaffByCampus, {
  //   campusId: campus._id,
  // });

  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // const dismissalSchedule = campus.dismissalStartTime && campus.dismissalEndTime
  //     ? `${campus.dismissalStartTime} - ${campus.dismissalEndTime}`
  //     : "Not configured";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Campus Overview</CardTitle>
            <CardDescription>Key information about this campus</CardDescription>
          </div>
          <div className="w-16 h-16 flex-shrink-0">
            <AspectRatio
              ratio={1}
              className="bg-muted rounded-lg overflow-hidden"
            >
              {logoUrl ? (
                <div
                  className="relative h-full w-full group cursor-pointer"
                  onClick={() => setIsImageExpanded(true)}
                >
                  <Image
                    src={logoUrl}
                    alt={`${campus.campusName} logo`}
                    fill
                    className="object-cover transition-all group-hover:brightness-75"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Expand className="h-5 w-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </AspectRatio>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Campus Information */}
        <div className="space-y-5">
          {campus.description && (
            <div className="flex items-start gap-3.5">
              <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Description
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {campus.description}
                </p>
              </div>
            </div>
          )}

          {addressLabel && (
            <div className="flex items-start gap-3.5">
              <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">Address</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {addressLabel}
                </p>
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

          {/* Dynamic Student and Staff Counts */}
          {/* <div className="flex items-start gap-3">
            <GraduationCap className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Students
              </p>
              <p className="text-sm text-muted-foreground">
                {activeStudents?.length ?? 0} active /{" "}
                {allStudents?.length ?? 0} total
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Staff</p>
              <p className="text-sm text-muted-foreground">
                {activeStaff?.length ?? 0} active /{" "}
                {allStaff?.length ?? 0} total
              </p>
            </div>
          </div> */}

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

      {/* Image Expanded Dialog */}
      <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-0">
          <DialogTitle className="sr-only">{`${campus.campusName} logo`}</DialogTitle>
          {logoUrl && (
            <AspectRatio ratio={16 / 9} className="bg-muted">
              <Image
                src={logoUrl}
                alt={`${campus.campusName} logo`}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
              />
            </AspectRatio>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
