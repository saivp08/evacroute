// Rail/notification "kind" markers are plain geometric shapes (CSS clip-path/border-radius),
// never emoji or illustrative icons — professional GIS symbology communicates category
// through shape and reserves color for status/severity (see app/globals.css .rail-shape-*).
import type { OperationalEventKind } from "./models";

export type EntityShape = "circle" | "square" | "square-outline" | "triangle" | "diamond";

export const VEHICLE_SHAPE: EntityShape = "circle";
export const INCIDENT_SHAPE: EntityShape = "triangle";
export const CLOSURE_SHAPE: EntityShape = "diamond";
export const SHELTER_SHAPE: EntityShape = "square";
export const ZONE_SHAPE: EntityShape = "square-outline";

export const EVENT_KIND_SHAPE: Record<OperationalEventKind, EntityShape> = {
  incident: "triangle",
  closure: "diamond",
  shelter: "square",
  vehicle: "circle",
};

export function shapeClassName(shape: EntityShape): string {
  return `entity-shape entity-shape-${shape}`;
}
