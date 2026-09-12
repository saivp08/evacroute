import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

export function centroid(points: LatLng[]): LatLng {
  const [sumLat, sumLon] = points.reduce(
    ([lat, lon], [pLat, pLon]) => [lat + pLat, lon + pLon],
    [0, 0]
  );
  return [sumLat / points.length, sumLon / points.length];
}

export function nearest<T>(from: LatLng, items: T[], getLocation: (item: T) => LatLng): T | undefined {
  let best: T | undefined;
  let bestDist = Infinity;
  for (const item of items) {
    const d = haversineKm(from, getLocation(item));
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}
