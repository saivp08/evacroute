// Client-side animation helper: interpolates a position (and heading) along a vehicle's
// existing `route` waypoints for a smooth moving-marker effect. This is display animation
// only — it does not compute or alter the route itself (no routing/pathfinding).
import type { LatLng } from "./models";

export interface RoutePoint {
  latitude: number;
  longitude: number;
  headingDeg: number;
}

// t is progress in [0, 1] along the whole route.
export function interpolateRoute(route: LatLng[], t: number): RoutePoint {
  if (route.length === 0) return { latitude: 0, longitude: 0, headingDeg: 0 };
  if (route.length === 1) return { ...route[0], headingDeg: 0 };

  const segments = route.length - 1;
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - index;
  const a = route[index];
  const b = route[index + 1];

  const latitude = a.latitude + (b.latitude - a.latitude) * localT;
  const longitude = a.longitude + (b.longitude - a.longitude) * localT;

  // Planar approximation of bearing — fine at the short distances these mock routes cover.
  const headingRad = Math.atan2(b.longitude - a.longitude, b.latitude - a.latitude);
  const headingDeg = (headingRad * 180) / Math.PI;

  return { latitude, longitude, headingDeg };
}

// Returns the portion of `coordinates` from the start up to `fraction` of the way along it
// (0 = just the first point, 1 = the whole path) — used to animate a route "drawing itself
// onto the map" during a simulated reroute. Purely a display truncation, not a real path
// computation.
export function truncateRoute(coordinates: LatLng[], fraction: number): LatLng[] {
  if (coordinates.length === 0) return [];
  const clamped = Math.min(Math.max(fraction, 0), 1);
  if (clamped >= 1) return coordinates;
  if (coordinates.length === 1) return coordinates;

  const segments = coordinates.length - 1;
  const scaled = clamped * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - index;
  const a = coordinates[index];
  const b = coordinates[index + 1];

  const partialPoint: LatLng = {
    latitude: a.latitude + (b.latitude - a.latitude) * localT,
    longitude: a.longitude + (b.longitude - a.longitude) * localT,
  };

  return [...coordinates.slice(0, index + 1), partialPoint];
}
