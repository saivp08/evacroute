// Mirrors the two theme palettes defined in app/globals.css (:root and
// :root[data-theme="light"]). MapLibre paint/icon properties need concrete color values —
// it renders via WebGL, not the DOM, so CSS custom properties (which every other component
// in the app reads via var(--x)) can't be referenced directly here. This is the one
// deliberate, minimal duplication the map migration required; keep both in sync with
// globals.css if either palette changes.
import type { ThemeMode } from "./theme";
import type { VehicleType } from "./models";

export interface MapPalette {
  danger: string;
  warning: string;
  caution: string;
  success: string;
  emergency: string;
  active: string;
  textMuted: string;
}

const DARK: MapPalette = {
  danger: "#ff4f52",
  warning: "#ffc857",
  caution: "#f4d35e",
  success: "#54d68b",
  emergency: "#42afff",
  active: "#59e1ff",
  textMuted: "#647589",
};

const LIGHT: MapPalette = {
  danger: "#d5352f",
  warning: "#c4650a",
  caution: "#97790a",
  success: "#17875a",
  emergency: "#1c68c9",
  active: "#0891b2",
  textMuted: "#7c8ba0",
};

export function getMapPalette(theme: ThemeMode): MapPalette {
  return theme === "light" ? LIGHT : DARK;
}

// Vehicle markers are plain glowing dots with no interior icon — category is read from this
// color alone (not a shape/pictogram), so each type gets a fixed, distinct hue rather than
// the shared status colors above.
const VEHICLE_TYPE_COLOR_DARK: Record<VehicleType, string> = {
  ambulance: "#22d3ee",
  fire_engine: "#fb7a3c",
  police_vehicle: "#8b7cf6",
  rescue_team: "#2dd4a7",
};

const VEHICLE_TYPE_COLOR_LIGHT: Record<VehicleType, string> = {
  ambulance: "#0e93a8",
  fire_engine: "#c1591f",
  police_vehicle: "#5b4fc4",
  rescue_team: "#188066",
};

export function getVehicleTypeColor(theme: ThemeMode, type: VehicleType): string {
  return (theme === "light" ? VEHICLE_TYPE_COLOR_LIGHT : VEHICLE_TYPE_COLOR_DARK)[type];
}
