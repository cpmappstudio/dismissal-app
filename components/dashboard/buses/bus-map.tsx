"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { Map, MapTileLayer } from "@/components/ui/map";
import { campusMapZoom, type CampusMapPoint } from "@/lib/campus-map";

function MapFrame({ points }: { points: CampusMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const frame = () => {
      map.invalidateSize({ pan: false });
      const positions: LatLngTuple[] = points.map((p) => [
        p.latitude,
        p.longitude,
      ]);
      const maxZoom = Math.min(
        ...points.map((p) => campusMapZoom[p.precision]),
      );
      if (positions.length === 1)
        map.setView(positions[0], maxZoom, { animate: false });
      else
        map.fitBounds(positions, {
          padding: [24, 24],
          maxZoom,
          animate: false,
        });
    };
    const observer = new ResizeObserver(frame);
    observer.observe(map.getContainer());
    frame();
    return () => observer.disconnect();
  }, [map, points]);
  return null;
}

export default function BusMap({
  points,
  unavailableLabel,
}: {
  points: CampusMapPoint[];
  unavailableLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Map
        center={[points[0].latitude, points[0].longitude]}
        zoom={campusMapZoom[points[0].precision]}
        className="!absolute inset-0 rounded-none"
        maxZoom={16}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomAnimation={false}
        fadeAnimation={false}
      >
        <MapTileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; National Geographic, Esri, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, increment P Corp."
          maxNativeZoom={16}
          keepBuffer={0}
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        <MapFrame points={points} />
      </Map>
      {failed && (
        <span
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground"
        >
          {unavailableLabel}
        </span>
      )}
    </>
  );
}
