// Mirrors the two theme palettes defined in app/globals.css (:root and
// :root[data-theme="light"]). MapLibre paint/icon properties need concrete color values —
// it renders via WebGL, not the DOM, so CSS custom properties (which every other component
// in the app reads via var(--x)) can't be referenced directly here. This is the one
// deliberate, minimal duplication the map migration required; keep both in sync with
// globals.css if either palette changes.
import type { ThemeMode } from "./theme";

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
  danger: "#ff4d4d",
  warning: "#ff9f43",
  caution: "#f4d35e",
  success: "#43d17a",
  emergency: "#38a8ff",
  active: "#54e0ff",
  textMuted: "#71869a",
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
