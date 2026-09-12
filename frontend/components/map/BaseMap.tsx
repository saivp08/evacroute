"use client";

// Reusable base map for EvacRoute — MapLibre GL JS (WebGL vector tiles) instead of the old
// Leaflet raster map. This is the ONLY file in the app that constructs the map; every layer
// component under components/map/ still just imports Source/Layer/Marker/Popup/useMap from
// react-map-gl/maplibre, so the rest of the application (OverviewScreen, the rails, the
// panels) never touches maplibre-gl directly — that boundary is the "map abstraction" the
// migration asked for.
//
// Tiles/style: OpenFreeMap's "Liberty" style — free, no API key, OpenMapTiles schema.
// Vector tiles (not a fixed-zoom raster tile set), so the map doesn't run out of tiles and
// show "Map data not yet available" at high zoom — geometry over-zooms gracefully past its
// native zoom level.
//
// Deliberately flat/2D (pitch 0, no terrain): an earlier pass added a 45° default pitch +
// real elevation-DEM terrain here, which caused a real bug — the tilted terrain mesh could
// push the visible ground plane out of the camera's view at some zoom levels over Santa
// Rosa, rendering as blank/white while screen-space overlay markers kept rendering fine
// (they don't sit on the terrain mesh). Removed rather than debugged further, since 3D
// wasn't wanted yet anyway.
import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";
import Map, { MapProvider, NavigationControl } from "react-map-gl/maplibre";

export interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
}

// Santa Rosa, CA — the live backend's scenario area (see backend/app/models/scenario.py).
const DEFAULT_CENTER: [number, number] = [38.4404, -122.7141];
const DEFAULT_ZOOM = 14;
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function BaseMap({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, className, children }: BaseMapProps) {
  return (
    <div className={className ?? "base-map"}>
      <MapProvider>
        <Map
          id="evac-map"
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: center[1], latitude: center[0], zoom, pitch: 0, bearing: 0 }}
          minZoom={3}
          maxZoom={20}
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
