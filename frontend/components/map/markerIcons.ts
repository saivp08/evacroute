// Shared marker icon language for map layers: a small square badge, a letter identifying
// the asset TYPE, and a colored ring identifying its STATUS — so every layer (this one and
// future ones) reads consistently rather than inventing its own marker style.
import L from "leaflet";
import type { FacilityStatus, ShelterAllocationStatus, ShelterStatus, VehicleStatus, VehicleType } from "@/lib/models";

const STATUS_COLOR: Record<FacilityStatus, string> = {
  operational: "var(--success)",
  limited: "var(--caution)",
  offline: "var(--danger)",
};

const SHELTER_STATUS_COLOR: Record<ShelterStatus, string> = {
  open: "var(--success)",
  full: "var(--warning)",
  closed: "var(--text-muted)",
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
  rescue_team: "R",
};

const VEHICLE_STATUS_COLOR: Record<VehicleStatus, string> = {
  available: "var(--success)",
  en_route: "var(--emergency)",
  on_scene: "var(--emergency)",
  returning: "var(--caution)",
  out_of_service: "var(--text-muted)",
};

// Mobile vehicles use a filled circular badge instead of a square, so they read as a
// distinct category from fixed infrastructure at a glance even though both use letters.
// Actively moving vehicles (en route / on scene) get a subtle pulse so the map reads as
// live rather than a static snapshot; the selected vehicle is enlarged with an accent ring.
// A heading pointer rotates around the badge to show travel direction while the letter
// itself stays upright and readable.
function vehicleBadgeIcon(letter: string, fillColor: string, selected: boolean, active: boolean, headingDeg: number | null) {
  const size = selected ? 34 : 26;
  const classes = [
    "marker-vehicle-badge",
    selected ? "marker-vehicle-badge-selected" : "",
    active ? "marker-vehicle-badge-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const heading =
    headingDeg !== null
      ? `<div class="marker-vehicle-heading" style="transform:rotate(${headingDeg}deg)"></div>`
      : "";
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="marker-vehicle-icon-root">${heading}<div class="${classes}" style="background:${fillColor}">${letter}</div></div>`,
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

export function vehicleIcon(
  type: VehicleType,
  status: VehicleStatus,
  selected = false,
  headingDeg: number | null = null
) {
  const active = status === "en_route" || status === "on_scene";
  return vehicleBadgeIcon(VEHICLE_LETTER[type], VEHICLE_STATUS_COLOR[status], selected, active, active ? headingDeg : null);
}

// Marks the two ends of a selected vehicle's route: a small hollow ring at the origin, a
// solid pin at the destination — distinct from each other and from every other marker type
// on the map, both in the route's own --active color.
export function routeEndpointIcon(kind: "origin" | "destination") {
  if (kind === "origin") {
    return L.divIcon({
      className: "marker-badge-icon",
      html: `<div class="route-origin-marker"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="route-destination-marker"></div>`,
    iconSize: [22, 30],
    iconAnchor: [11, 28],
    popupAnchor: [0, -26],
  });
}

// Road closure event: a diamond (distinct from infrastructure's square and vehicles'
// circle) in the fixed --danger color, since a closure is always a danger-tier event.
// Enlarged and brightened when selected from the Road Closures panel.
export function roadClosureIcon(selected: boolean) {
  const size = selected ? 26 : 20;
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="road-closure-marker${selected ? " road-closure-marker-selected" : ""}"><span>!</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const SHELTER_ALLOCATION_STATUS_COLOR: Record<ShelterAllocationStatus, string> = {
  available: "var(--success)",
  filling: "var(--caution)",
  near_capacity: "var(--warning)",
  full: "var(--danger)",
};

// Shelter Allocation page marker: same square-badge language as the infrastructure icons
// above, but sized up (and ring-brightened) when selected, matching the road-closure and
// vehicle icons' selected treatment.
export function shelterAllocationIcon(status: ShelterAllocationStatus, selected: boolean) {
  const size = selected ? 32 : 26;
  return L.divIcon({
    className: "marker-badge-icon",
    html: `<div class="marker-badge${selected ? " marker-badge-selected" : ""}" style="border-color:${SHELTER_ALLOCATION_STATUS_COLOR[status]};width:${size}px;height:${size}px">S</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
