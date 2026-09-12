// Ephemeral UI state for the "SIMULATE CLOSURE" demo interaction — NOT a backend-mirrored
// model (see lib/models for those). This never leaves the browser and isn't persisted;
// it just coordinates the InspectorPanel controls with the VehicleLayer's map animation.
export type RerouteStage = "idle" | "activating" | "rerouting" | "rerouted";

export interface RerouteState {
  vehicleId: string;
  stage: RerouteStage;
  // Reveal progress for the alternate route being "drawn" onto the map, 0..1.
  // Meaningful only while stage === "rerouting" (0 at the start, 1 once fully drawn).
  progress: number;
}
