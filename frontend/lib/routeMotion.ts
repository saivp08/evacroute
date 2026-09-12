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

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeLengthMiles(coordinates: LatLng[]): number {
  let meters = 0;
  for (let i = 1; i < coordinates.length; i++) {
    meters += haversineMeters(coordinates[i - 1], coordinates[i]);
  }
  return meters / 1609.34;
}

export interface Detour {
  closurePoint: LatLng;
  coordinates: LatLng[];
}

// Builds a deterministic "detour around a closure" out of an existing route: the middle
// third of the path is replaced with a single point offset to one side, so the drawn line
// visibly jogs around an obstacle instead of just being a straight substitute. This is a
// fixed geometric transform of the route's own waypoints — not pathfinding, and not random
// (the same route always produces the same detour).
export function buildDetour(coordinates: LatLng[]): Detour | null {
  if (coordinates.length < 3) return null;

  const last = coordinates.length - 1;
  const startIndex = Math.max(1, Math.floor(last * 0.3));
  const endIndex = Math.min(last - 1, Math.ceil(last * 0.7));
  if (startIndex >= endIndex) return null;

  const start = coordinates[startIndex];
  const end = coordinates[endIndex];
  const midIndex = Math.floor((startIndex + endIndex) / 2);
  const mid = coordinates[midIndex];

  // Perpendicular to the start->end direction, scaled to a fixed real-world offset so the
  // bulge reads clearly regardless of the route's own scale.
  const dx = end.longitude - start.longitude;
  const dy = end.latitude - start.latitude;
  const length = Math.hypot(dx, dy) || 1;
  const OFFSET_DEG = 0.0035;
  const perpLat = -(dx / length) * OFFSET_DEG;
  const perpLng = (dy / length) * OFFSET_DEG;

  const detourPoint: LatLng = {
    latitude: mid.latitude + perpLat,
    longitude: mid.longitude + perpLng,
  };

  return {
    closurePoint: start,
    coordinates: [...coordinates.slice(0, startIndex + 1), detourPoint, ...coordinates.slice(endIndex)],
  };
}
