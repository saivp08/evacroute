"use client";

// Reusable 3D base map for EvacRoute — MapLibre GL JS (WebGL vector tiles) instead of the
// old Leaflet raster map. This is the ONLY file in the app that constructs the map/adds the
// terrain+sky layers; every layer component under components/map/ still just imports
// Source/Layer/Marker/Popup/useMap from react-map-gl/maplibre, so the rest of the
// application (OverviewScreen, the rails, the panels) never touches maplibre-gl directly —
// that boundary is the "map abstraction" the migration asked for.
//
// Tiles/style: OpenFreeMap's "Liberty" style — free, no API key, OpenMapTiles schema. Its
// `building-3d` layer already extrudes real OSM building height data above zoom 14, so no
// custom building layer is needed here. Terrain uses the public, keyless AWS "Terrarium"
// DEM tile set. Because both are vector/DEM tiles (not a fixed-zoom raster tile set), the
// map no longer runs out of tiles and shows "Map data not yet available" at high zoom —
// vector geometry over-zooms gracefully past its native zoom level.
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useRef, type ReactNode } from "react";
import Map, { MapProvider, NavigationControl, type MapRef } from "react-map-gl/maplibre";

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
const TERRAIN_SOURCE_ID = "evac-terrain-dem";

export default function BaseMap({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, className, children }: BaseMapProps) {
  const mapRef = useRef<MapRef | null>(null);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Real elevation data (not decorative) — subtle in Santa Rosa's terrain, but genuine.
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
      });
    }
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.3 });

    // Atmospheric sky so tilted/pitched views read as real geographic depth rather than a
    // flat plane tipped on its side.
    if (!map.getLayer("evac-sky")) {
      // Cast: the sky layer type is supported by the installed maplibre-gl (v6), but the
      // style-spec types bundled inside react-map-gl's maplibre adapter lag behind it.
      map.addLayer({
        id: "evac-sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun-intensity": 8,
        },
      } as unknown as Parameters<typeof map.addLayer>[0]);
    }
  }, []);

  return (
    <div className={className ?? "base-map"}>
      <MapProvider>
        <Map
          ref={mapRef}
          id="evac-map"
          onLoad={handleLoad}
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: center[1], latitude: center[0], zoom, pitch: 45, bearing: 0 }}
          minZoom={3}
          maxZoom={20}
          maxPitch={70}
          pitchWithRotate
          dragRotate
          style={{ width: "100%", height: "100%" }}
          attributionControl={{ compact: true }}
        >
          {/* Bottom-right so it never collides with the headline KPI overlay pinned to the
              top; visualizePitch adds a compass + pitch reset, the closest MapLibre
              equivalent to Leaflet's plain zoom control but genuinely useful for a tiltable
              3D map. */}
          <NavigationControl position="bottom-right" visualizePitch />
          {children}
        </Map>
      </MapProvider>
    </div>
  );
}
