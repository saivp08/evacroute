"use client";

// Reusable base map for EvacRoute — MapLibre GL JS instead of the old Leaflet raster map.
// This is the ONLY file in the app that constructs the map; every layer component under
// components/map/ still just imports Source/Layer/Marker/Popup/useMap from
// react-map-gl/maplibre, so the rest of the application (OverviewScreen, the rails, the
// panels) never touches maplibre-gl directly — that boundary is the "map abstraction" the
// migration asked for.
//
// Tiles/style: OpenStreetMap's standard raster tiles — no API key, real street-level detail
// confirmed all the way to z19 over Santa Rosa (building footprints, street names, POIs).
// Two other keyless options were tried and ruled out first, both verified directly against
// their tile endpoints rather than assumed:
//   - OpenFreeMap's "Liberty" VECTOR style: style.json and the TileJSON it points to both
//     resolve fine over HTTP, but the actual .pbf vector tile fetches (issued from
//     MapLibre's tile worker, not the main thread) never completed in this app — verified
//     with Playwright/CDP: zero tile network activity, no console errors, at any zoom, so
//     the basemap stayed blank while marker overlays (plain DOM, unrelated to tile loading)
//     kept rendering fine.
//   - Esri's "World_Light_Gray_Base" (the ORIGINAL pre-migration basemap) — real data at
//     low/medium zoom, but its own tile server literally returns a "Map data not yet
//     available" placeholder image past z16-17 for this area (confirmed by fetching the
//     tile directly), which is the original bug the very first basemap report described.
// CARTO's hosted basemaps.cartocdn.com (tried between those two) now requires an API key —
// every tile came back watermarked "API KEY REQUIRED" rather than 4xx, which is why the
// earlier version of this fix looked like it worked from HTTP status codes alone but didn't
// hold up once actually screenshotted.
//
// Raster tiles are a deliberately simpler pipeline than vector tiles (a plain image fetch +
// decode, the same mechanism the old Leaflet map used) — that's what's actually reliable
// here. OSM's standard style only comes in one (light) palette, so dark mode gets there via
// a CSS filter on the map container (see .base-map-dark in globals.css) rather than a second
// unreliable tile source.
//
// Deliberately flat/2D (pitch 0, no terrain, no rotation): a still-earlier pass added a 45°
// default pitch + real elevation-DEM terrain, which was its own separate bug (the tilted
// terrain mesh pushing the ground plane out of the camera's frustum at some zoom levels).
// Removed outright rather than reintroduced, since 3D isn't wanted yet anyway.
import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";
import type { StyleSpecification } from "maplibre-gl";
import Map, { MapProvider, NavigationControl } from "react-map-gl/maplibre";
import { useTheme } from "@/lib/theme";

export interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
}

// Santa Rosa, CA — the live backend's scenario area (see backend/app/models/scenario.py).
const DEFAULT_CENTER: [number, number] = [38.4404, -122.7141];
const DEFAULT_ZOOM = 14;
const OSM_MAX_ZOOM = 19;

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.openstreetmap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: OSM_MAX_ZOOM,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};

export default function BaseMap({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, className, children }: BaseMapProps) {
  const { theme } = useTheme();

  return (
    <div className={`${className ?? "base-map"} ${theme === "dark" ? "base-map-dark" : ""}`}>
      <MapProvider>
        <Map
          id="evac-map"
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: center[1], latitude: center[0], zoom, pitch: 0, bearing: 0 }}
          minZoom={3}
          maxZoom={OSM_MAX_ZOOM}
          maxPitch={0}
          dragRotate={false}
          style={{ width: "100%", height: "100%" }}
          attributionControl={{ compact: true }}
        >
          {/* Bottom-right so it never collides with the headline KPI overlay pinned to the
              top. */}
          <NavigationControl position="bottom-right" showCompass={false} />
          {children}
        </Map>
      </MapProvider>
    </div>
  );
}
