// Ephemeral UI-only selection state for the Overview command center — NOT a backend-mirrored
// model; this never leaves the browser. A single selection at a time drives the map's
// highlight/fly-to behavior, the matching rail's highlighted row, and the InspectorPanel.
export type SelectionKind = "vehicle" | "incident" | "closure" | "shelter" | "zone";

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export type SelectionState = Selection | null;
