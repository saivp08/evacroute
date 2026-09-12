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
  evacuationZones: "Evacuation Zones",
  shelters: "Shelters",
  hospitals: "Hospitals",
  fleet: "Fleet",
  hazards: "Hazards",
};

export type MapLayerVisibility = Record<MapLayerKey, boolean>;

// Matches the Overview map's behavior before Phase 10 existed: closures/routes/shelters/
// hospitals/fleet were already always shown, so they default on; Traffic, Evacuation Zones,
// and Hazards are new additive overlays and default off so the map looks unchanged until a
// user opts in.
export const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  traffic: false,
  roadClosures: true,
  emergencyRoutes: true,
  evacuationZones: false,
  shelters: true,
  hospitals: true,
  fleet: true,
  hazards: false,
};
