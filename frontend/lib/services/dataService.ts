// Data/service layer for EvacRoute.
//
//   Frontend component -> this service -> mock data (today) or FastAPI backend (later)
//
// Components must call these functions and never import lib/mock directly. Each function
// is the single seam a real backend integration will replace, e.g.:
//
//   export async function getVehicles(): Promise<Vehicle[]> {
//     const res = await fetch(`${API_BASE_URL}/vehicles`);
//     return res.json();
//   }
//
// The return type stays identical, so no component needs to change when that happens.
import type {
  EvacuationZone,
  FireStation,
  Hazard,
  Hospital,
  Incident,
  IntelReport,
  OperationsMetrics,
  PoliceStation,
  Road,
  RoadClosure,
  Route,
  RouteUpdateEvent,
  Shelter,
  SystemStatus,
  Vehicle,
  VehicleRoute,
} from "../models";
import {
  mockEvacuationZones,
  mockFireStations,
  mockHazards,
  mockHospitals,
  mockIncidents,
  mockIntelReports,
  mockOperationsMetrics,
  mockPoliceStations,
  mockRoadClosures,
  mockRoads,
  mockRoutes,
  mockRouteUpdateEvents,
  mockShelters,
  mockSystemStatuses,
  mockVehicleRoutes,
  mockVehicles,
} from "../mock";

export async function getVehicles(): Promise<Vehicle[]> {
  return mockVehicles;
}

export async function getHospitals(): Promise<Hospital[]> {
  return mockHospitals;
}

export async function getShelters(): Promise<Shelter[]> {
  return mockShelters;
}

export async function getFireStations(): Promise<FireStation[]> {
  return mockFireStations;
}

export async function getPoliceStations(): Promise<PoliceStation[]> {
  return mockPoliceStations;
}

export async function getRoads(): Promise<Road[]> {
  return mockRoads;
}

export async function getRoutes(): Promise<Route[]> {
  return mockRoutes;
}

export async function getIncidents(): Promise<Incident[]> {
  return mockIncidents;
}

export async function getHazards(): Promise<Hazard[]> {
  return mockHazards;
}

export async function getEvacuationZones(): Promise<EvacuationZone[]> {
  return mockEvacuationZones;
}

export async function getSystemStatuses(): Promise<SystemStatus[]> {
  return mockSystemStatuses;
}

export async function getIntelReports(): Promise<IntelReport[]> {
  return mockIntelReports;
}

export async function getOperationsMetrics(): Promise<OperationsMetrics> {
  return mockOperationsMetrics;
}

// Returns null for a vehicle with no active route (available/out-of-service/already
// arrived) as well as for an unrecognized vehicle id — both are legitimate "no route to
// show" states for the caller, not errors.
export async function getVehicleRoute(vehicleId: string): Promise<VehicleRoute | null> {
  return mockVehicleRoutes.find((route) => route.vehicle_id === vehicleId) ?? null;
}

export async function getRoadClosures(): Promise<RoadClosure[]> {
  return mockRoadClosures;
}

// Returns the predetermined reroute scenario for a vehicle, or null if none is defined for
// it — most vehicles simply have no reroute event, which is a normal state, not an error.
export async function getRerouteEvent(vehicleId: string): Promise<RouteUpdateEvent | null> {
  return mockRouteUpdateEvents.find((event) => event.vehicle_id === vehicleId) ?? null;
}
