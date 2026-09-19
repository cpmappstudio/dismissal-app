"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const BusMap = dynamic(() => import("./bus-map"), { ssr: false });

export function BusHero({
  busId,
  campuses = [],
}: {
  busId: Id<"buses">;
  campuses: {
    id: Id<"campusSettings">;
    name: string;
    mapLocation?: Doc<"campusSettings">["mapLocation"];
  }[];
}) {
  const t = useTranslations("buses");
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const ensure = useMutation(api.campusMaps.ensureForBus);
  const needsLocation = campuses.some((c) => !c.mapLocation);
  const campusIds = campuses.map((c) => c.id).join(",");
  const points = campuses.flatMap((c) =>
    c.mapLocation?.status === "ready" && c.mapLocation.point
      ? [c.mapLocation.point]
      : [],
  );
  const loading =
    needsLocation || campuses.some((c) => c.mapLocation?.status === "pending");
  const failed =
    requestFailed || campuses.some((c) => c.mapLocation?.status === "error");

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (visible) void ensure({ busId }).catch(() => setRequestFailed(true));
  }, [busId, visible, campusIds, ensure]);

  return (
    <div
      ref={container}
      className="relative aspect-[16/9] overflow-hidden bg-muted"
    >
      <div
        role="img"
        aria-label={t("mapArea", {
          campuses: campuses.map((c) => c.name).join(", "),
        })}
        className="pointer-events-none absolute inset-0"
      >
        {visible && points.length ? (
          <BusMap points={points} unavailableLabel={t("mapUnavailable")} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="size-8" />
            <span>
              {t(
                failed
                  ? "mapUnavailable"
                  : loading
                    ? "mapLoading"
                    : "mapMissing",
              )}
            </span>
          </div>
        )}
      </div>
      {!!points.length && (
        <>
          {points.length < campuses.length && (
            <span className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-card/95 px-3 py-1 text-xs text-card-foreground shadow-sm">
              {t("mapPartial")}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-primary px-2 py-1 text-[10px] leading-tight text-primary-foreground">
            Tiles ©{" "}
            <a
              href="https://www.arcgis.com/home/item.html?id=b9b1b422198944fbbd5250b3241691b6"
              target="_blank"
              rel="noreferrer"
            >
              Esri / National Geographic &amp; contributors
            </a>
            {" · "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              Geocoding © OpenStreetMap
            </a>
          </div>
        </>
      )}
    </div>
  );
}
