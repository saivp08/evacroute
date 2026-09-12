// Shared marker icon language for map layers: a small square badge, a letter identifying
// the asset TYPE, and a colored ring identifying its STATUS — so every layer (this one and
// future ones) reads consistently rather than inventing its own marker style.
import L from "leaflet";
import type { FacilityStatus, ShelterStatus, VehicleStatus, VehicleType } from "@/lib/models";

const STATUS_COLOR: Record<FacilityStatus, string> = {
  operational: "var(--status-safe)",
  limited: "var(--status-caution)",
  offline: "var(--status-critical)",
};

const SHELTER_STATUS_COLOR: Record<ShelterStatus, string> = {
  open: "var(--status-safe)",
  full: "var(--status-warning)",
  closed: "var(--status-inactive)",
};

// Fixed infrastructure uses a square outline badge (type = letter, status = ring color).
function badgeIcon(letter: string, ringColor: string) {
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="marker-badge" style="border-color:${ringColor}">${letter}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

const VEHICLE_LETTER: Record<VehicleType, string> = {
  ambulance: "A",
  fire_engine: "E",
  police_vehicle: "V",
};

const VEHICLE_STATUS_COLOR: Record<VehicleStatus, string> = {
  available: "var(--status-safe)",
  en_route: "var(--status-response)",
  on_scene: "var(--status-response)",
  returning: "var(--status-caution)",
  out_of_service: "var(--status-inactive)",
};

// Mobile vehicles use a filled circular badge instead of a square, so they read as a
// distinct category from fixed infrastructure at a glance even though both use letters.
// Actively moving vehicles (en route / on scene) get a subtle pulse so the map reads as
// live rather than a static snapshot; the selected vehicle is enlarged with an accent ring.
function vehicleBadgeIcon(letter: string, fillColor: string, selected: boolean, active: boolean) {
  const size = selected ? 34 : 26;
  const classes = [
    "marker-vehicle-badge",
    selected ? "marker-vehicle-badge-selected" : "",
    active ? "marker-vehicle-badge-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="${classes}" style="background:${fillColor}">${letter}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function hospitalIcon(status: FacilityStatus) {
  return badgeIcon("H", STATUS_COLOR[status]);
}

export function shelterIcon(status: ShelterStatus) {
  return badgeIcon("S", SHELTER_STATUS_COLOR[status]);
}

export function fireStationIcon(status: FacilityStatus) {
  return badgeIcon("F", STATUS_COLOR[status]);
}

export function policeStationIcon(status: FacilityStatus) {
  return badgeIcon("P", STATUS_COLOR[status]);
}

export function vehicleIcon(type: VehicleType, status: VehicleStatus, selected = false) {
  const active = status === "en_route" || status === "on_scene";
  return vehicleBadgeIcon(VEHICLE_LETTER[type], VEHICLE_STATUS_COLOR[status], selected, active);
}
