// Ephemeral UI-only state for the Overview map's layer-visibility toggles (Phase 10) — NOT
// a backend-mirrored model or mock data; this never leaves the browser. See
// components/overview/LayerControlPanel.tsx and OverviewScreen.tsx.
export type MapLayerKey =
  | "traffic"
  | "roadClosures"
  | "emergencyRoutes"
  | "evacuationZones"
  | "shelters"
  | "hospitals"
  | "fleet"
  | "hazards";

export const MAP_LAYER_ORDER: MapLayerKey[] = [
  "traffic",
  "roadClosures",
  "emergencyRoutes",
  "evacuationZones",
  "shelters",
  "hospitals",
  "fleet",
  "hazards",
];

export const MAP_LAYER_LABELS: Record<MapLayerKey, string> = {
  traffic: "Traffic",
  roadClosures: "Road Closures",
  emergencyRoutes: "Emergency Routes",
  evacuationZones: "Evacuation",
  shelters: "Shelters",
  hospitals: "Hospitals",
  fleet: "Fleet",
  hazards: "Hazards",
};

export type MapLayerVisibility = Record<MapLayerKey, boolean>;

// "traffic" gates the real, backend-derived road-status layer (RoadLayer) — every road's
// actual open/closed status, not a fabricated congestion simulation. Closures/routes/
// shelters/hospitals/fleet/roads default on since that was already the map's baseline
// state; Evacuation Zones and Hazards default off as opt-in overlays.
export const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  traffic: true,
  roadClosures: true,
  emergencyRoutes: true,
  evacuationZones: false,
  shelters: true,
  hospitals: true,
  fleet: true,
  hazards: false,
};
