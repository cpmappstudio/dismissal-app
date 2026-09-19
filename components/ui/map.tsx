"use client";

// Core components adapted from shadcn-map (MIT), https://github.com/tonghohin/shadcn-map.
// ponytail: omit drawing, search and clustering plugins until a route editor needs them.
import {
  MapContainer,
  TileLayer,
  type MapContainerProps,
  type TileLayerProps,
} from "react-leaflet";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export function Map({
  className,
  zoom = 15,
  maxZoom = 18,
  ...props
}: Omit<MapContainerProps, "zoomControl">) {
  return (
    <MapContainer
      zoom={zoom}
      maxZoom={maxZoom}
      zoomControl={false}
      className={cn("relative z-0 size-full rounded-md", className)}
      {...props}
    />
  );
}

export function MapTileLayer({
  url,
  attribution,
  darkUrl,
  darkAttribution,
  ...props
}: Partial<TileLayerProps> & { darkUrl?: string; darkAttribution?: string }) {
  const { resolvedTheme } = useTheme();
  const resolvedUrl =
    resolvedTheme === "dark"
      ? (darkUrl ??
        url ??
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png")
      : (url ?? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png");
  return (
    <TileLayer
      url={resolvedUrl}
      attribution={
        (resolvedTheme === "dark" ? darkAttribution : undefined) ??
        attribution ??
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
      {...props}
    />
  );
}
