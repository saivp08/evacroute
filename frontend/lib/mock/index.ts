// Temporary development fallback data, shaped exactly like the models in lib/models —
// which is in turn shaped like the eventual FastAPI response. Only lib/services should
// import from this file; components must never import mock data directly.
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

// Relative to "now" (not a fixed past date) so the live "time ago" display in the UI
// always reads sensibly (e.g. "5m ago") no matter when this demo is actually run.
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const mockVehicles: Vehicle[] = [
  {
    id: "AMB-12",
    type: "ambulance",
    callsign: "Medic 12",
    status: "en_route",
    latitude: 40.44,
    longitude: -79.95,
    destination: "UPMC Presbyterian",
    priority: "critical",
    route: [
      { latitude: 40.44, longitude: -79.95 },
      { latitude: 40.4408, longitude: -79.9505 },
      { latitude: 40.4415, longitude: -79.952 },
      { latitude: 40.4412, longitude: -79.9535 },
      { latitude: 40.441, longitude: -79.955 },
    ],
    eta_minutes: 6,
  },
  {
    id: "AMB-9",
    type: "ambulance",
    callsign: "Medic 9",
    status: "out_of_service",
    latitude: 40.458,
    longitude: -79.93,
    destination: null,
    priority: "low",
    route: [],
    eta_minutes: null,
  },
  {
    id: "ENG-4",
    type: "fire_engine",
    callsign: "Engine 4",
    status: "on_scene",
    latitude: 40.451,
    longitude: -79.94,
    destination: "Structure Fire — Placeholder Ave",
    priority: "high",
    route: [],
    eta_minutes: 0,
  },
  {
    id: "ENG-12",
    type: "fire_engine",
    callsign: "Engine 12",
    status: "returning",
    latitude: 40.429,
    longitude: -79.924,
    destination: "PBF Engine House 12",
    priority: "low",
    route: [
      { latitude: 40.429, longitude: -79.924 },
      { latitude: 40.4285, longitude: -79.9245 },
      { latitude: 40.428, longitude: -79.925 },
    ],
    eta_minutes: 3,
  },
  {
    id: "UNIT-7",
    type: "police_vehicle",
    callsign: "Unit 7",
    status: "available",
    latitude: 40.43,
    longitude: -79.96,
    destination: null,
    priority: "low",
    route: [],
    eta_minutes: null,
  },
  {
    id: "UNIT-15",
    type: "police_vehicle",
    callsign: "Unit 15",
    status: "en_route",
    latitude: 40.465,
    longitude: -79.97,
    destination: "Debris Site — River Parkway",
    priority: "medium",
    route: [
      { latitude: 40.465, longitude: -79.97 },
      { latitude: 40.458, longitude: -79.971 },
      { latitude: 40.45, longitude: -79.97 },
      { latitude: 40.443, longitude: -79.969 },
      { latitude: 40.437, longitude: -79.968 },
    ],
    eta_minutes: 9,
  },
];

// One dispatch route per vehicle that currently has an active assignment — vehicles that
// are available/out-of-service/already-on-scene intentionally have no entry here, so
// getVehicleRoute() returning null for them is a real state, not a missing-data bug.
// Coordinates deliberately trace a multi-point curve rather than a straight origin-to-
// destination line, and mirror each vehicle's own `route` field above.
export const mockVehicleRoutes: VehicleRoute[] = [
  {
    vehicle_id: "AMB-12",
    origin: { latitude: 40.44, longitude: -79.95 },
    destination_name: "UPMC Presbyterian",
    destination: { latitude: 40.441, longitude: -79.955 },
    coordinates: [
      { latitude: 40.44, longitude: -79.95 },
      { latitude: 40.4408, longitude: -79.9505 },
      { latitude: 40.4415, longitude: -79.952 },
      { latitude: 40.4412, longitude: -79.9535 },
      { latitude: 40.441, longitude: -79.955 },
    ],
    distance_miles: 3.8,
    eta_minutes: 6,
    status: "clear",
    priority: "critical",
  },
  {
    vehicle_id: "ENG-12",
    origin: { latitude: 40.429, longitude: -79.924 },
    destination_name: "PBF Engine House 12",
    destination: { latitude: 40.428, longitude: -79.925 },
    coordinates: [
      { latitude: 40.429, longitude: -79.924 },
      { latitude: 40.4285, longitude: -79.9245 },
      { latitude: 40.428, longitude: -79.925 },
    ],
    distance_miles: 0.4,
    eta_minutes: 3,
    status: "clear",
    priority: "low",
  },
  {
    vehicle_id: "UNIT-15",
    origin: { latitude: 40.465, longitude: -79.97 },
    destination_name: "Debris Site — River Parkway",
    destination: { latitude: 40.437, longitude: -79.968 },
    coordinates: [
      { latitude: 40.465, longitude: -79.97 },
      { latitude: 40.458, longitude: -79.971 },
      { latitude: 40.45, longitude: -79.97 },
      { latitude: 40.443, longitude: -79.969 },
      { latitude: 40.437, longitude: -79.968 },
    ],
    distance_miles: 2.1,
    eta_minutes: 9,
    status: "congested",
    priority: "medium",
  },
];

export const mockHospitals: Hospital[] = [
  {
    id: "HOSP-1",
    type: "hospital",
    name: "UPMC Presbyterian",
    latitude: 40.441,
    longitude: -79.955,
    status: "operational",
    trauma_level: 1,
    bed_capacity: 200,
    beds_available: 34,
  },
  {
    id: "HOSP-2",
    type: "hospital",
    name: "Placeholder Regional Medical Center",
    latitude: 40.463,
    longitude: -79.955,
    status: "limited",
    trauma_level: 2,
    bed_capacity: 120,
    beds_available: 4,
  },
];

export const mockShelters: Shelter[] = [
  {
    id: "SHEL-1",
    type: "shelter",
    name: "Placeholder Community Shelter",
    address: "100 Placeholder Ave",
    latitude: 40.448,
    longitude: -79.945,
    status: "open",
    capacity: 500,
    occupancy: 120,
  },
  {
    id: "SHEL-2",
    type: "shelter",
    name: "Placeholder High School Shelter",
    address: "220 Placeholder Rd",
    latitude: 40.462,
    longitude: -79.912,
    status: "open",
    capacity: 800,
    occupancy: 742,
  },
  {
    id: "SHEL-3",
    type: "shelter",
    name: "Placeholder Rec Center Shelter",
    address: "45 Placeholder Blvd",
    latitude: 40.421,
    longitude: -79.981,
    status: "full",
    capacity: 300,
    occupancy: 300,
  },
];

export const mockFireStations: FireStation[] = [
  {
    id: "FS-1",
    type: "fire_station",
    name: "Placeholder Fire Station 1",
    latitude: 40.452,
    longitude: -79.938,
    status: "operational",
    jurisdiction: "Placeholder County",
  },
  {
    id: "FS-2",
    type: "fire_station",
    name: "PBF Engine House 12",
    latitude: 40.428,
    longitude: -79.925,
    status: "operational",
    jurisdiction: "Placeholder County",
  },
];

export const mockPoliceStations: PoliceStation[] = [
  {
    id: "PS-1",
    type: "police_station",
    name: "Placeholder Police Precinct 1",
    latitude: 40.435,
    longitude: -79.962,
    status: "operational",
    jurisdiction: "Placeholder County",
  },
  {
    id: "PS-2",
    type: "police_station",
    name: "Placeholder Police Precinct 4",
    latitude: 40.468,
    longitude: -79.978,
    status: "limited",
    jurisdiction: "Placeholder County",
  },
];

export const mockRoads: Road[] = [
  {
    id: "ROAD-1",
    name: "Placeholder Highway 12",
    status: "open",
    coordinates: [
      { latitude: 40.42, longitude: -79.97 },
      { latitude: 40.45, longitude: -79.93 },
    ],
    closure_reason: null,
  },
  {
    id: "ROAD-2",
    name: "Placeholder River Parkway",
    status: "congested",
    coordinates: [
      { latitude: 40.472, longitude: -79.99 },
      { latitude: 40.45, longitude: -79.955 },
      { latitude: 40.44, longitude: -79.93 },
    ],
    closure_reason: null,
  },
  {
    id: "ROAD-3",
    name: "Bridge Road",
    status: "blocked",
    coordinates: [
      { latitude: 40.452, longitude: -79.965 },
      { latitude: 40.44, longitude: -79.955 },
    ],
    closure_reason: "Debris blocking both lanes",
  },
  {
    id: "ROAD-4",
    name: "Placeholder Overlook Drive",
    status: "closed",
    coordinates: [
      { latitude: 40.41, longitude: -79.955 },
      { latitude: 40.423, longitude: -79.968 },
    ],
    closure_reason: "Closed for evacuation staging",
  },
];

// Closure EVENTS shown in the Road Closures panel/map layer — richer than a Road's own
// `status` (severity + timestamp + independent selection). CLOSURE-1 corresponds to the
// "Bridge Road" Road entry above (road_id links them so the two stay consistent); the other
// two are closures without a full Road network entry, which is a normal, expected state.
export const mockRoadClosures: RoadClosure[] = [
  {
    id: "CLOSURE-1",
    road_id: "ROAD-3",
    road_name: "Bridge Road",
    reason: "Debris",
    severity: "high",
    reported_at: minutesAgo(9),
    coordinates: [
      { latitude: 40.452, longitude: -79.965 },
      { latitude: 40.44, longitude: -79.955 },
    ],
    status: "closed",
  },
  {
    id: "CLOSURE-2",
    road_id: null,
    road_name: "Fifth Avenue",
    reason: "Flooding",
    severity: "critical",
    reported_at: minutesAgo(16),
    coordinates: [
      { latitude: 40.4425, longitude: -79.958 },
      { latitude: 40.446, longitude: -79.951 },
    ],
    status: "closed",
  },
  {
    id: "CLOSURE-3",
    road_id: null,
    road_name: "Craig Street",
    reason: "Vehicle accident",
    severity: "medium",
    reported_at: minutesAgo(22),
    coordinates: [
      { latitude: 40.45, longitude: -79.949 },
      { latitude: 40.453, longitude: -79.947 },
    ],
    status: "closed",
  },
];

// Predetermined detour scenarios for the "SIMULATE CLOSURE" demo. Currently only AMB-12
// has one defined — its alternate path loops south and west around the Bridge Road closure
// before approaching UPMC Presbyterian from the other side, rather than a straight
// replacement line. A vehicle with no entry here has no reroute scenario, which is expected.
export const mockRouteUpdateEvents: RouteUpdateEvent[] = [
  {
    vehicle_id: "AMB-12",
    closure_id: "CLOSURE-1",
    message: "Route updated — Bridge Road closed due to debris.",
    alternate_coordinates: [
      { latitude: 40.44, longitude: -79.95 },
      { latitude: 40.4375, longitude: -79.952 },
      { latitude: 40.435, longitude: -79.9565 },
      { latitude: 40.437, longitude: -79.9605 },
      { latitude: 40.4405, longitude: -79.9615 },
      { latitude: 40.4415, longitude: -79.958 },
      { latitude: 40.441, longitude: -79.955 },
    ],
    alternate_distance_miles: 4.6,
    alternate_eta_minutes: 9,
  },
];

export const mockRoutes: Route[] = [
  {
    id: "ROUTE-1",
    origin_zone_id: "ZONE-1",
    destination_shelter_id: "SHEL-1",
    status: "active",
    people_count: 850,
    coordinates: [
      { latitude: 40.44, longitude: -79.96 },
      { latitude: 40.448, longitude: -79.945 },
    ],
    eta_minutes: 14,
  },
];

export const mockIncidents: Incident[] = [
  {
    id: "INC-1",
    type: "structure_fire",
    description: "Placeholder incident report.",
    severity: "high",
    status: "responding",
    latitude: 40.451,
    longitude: -79.94,
    zone_id: "ZONE-1",
    reported_at: minutesAgo(42),
  },
  {
    id: "INC-2",
    type: "medical",
    description: "Placeholder medical emergency report.",
    severity: "critical",
    status: "confirmed",
    latitude: 40.459,
    longitude: -79.921,
    zone_id: "ZONE-1",
    reported_at: minutesAgo(8),
  },
  {
    id: "INC-3",
    type: "road_hazard",
    description: "Placeholder debris report blocking a corridor.",
    severity: "medium",
    status: "reported",
    latitude: 40.437,
    longitude: -79.968,
    zone_id: null,
    reported_at: minutesAgo(2),
  },
];

export const mockHazards: Hazard[] = [
  {
    id: "HAZ-1",
    type: "wildfire",
    name: "Placeholder Wildfire",
    latitude: 40.46,
    longitude: -79.92,
    radius_meters: 5000,
    severity: "critical",
    started_at: "2026-01-01T09:00:00Z",
  },
];

export const mockEvacuationZones: EvacuationZone[] = [
  {
    id: "ZONE-1",
    name: "Placeholder Zone A",
    status: "mandatory",
    population: 1200,
    boundary: [
      { latitude: 40.46, longitude: -79.97 },
      { latitude: 40.46, longitude: -79.93 },
      { latitude: 40.43, longitude: -79.93 },
      { latitude: 40.43, longitude: -79.97 },
    ],
  },
  {
    id: "ZONE-2",
    name: "Placeholder Zone B",
    status: "warning",
    population: 640,
    boundary: [
      { latitude: 40.47, longitude: -79.93 },
      { latitude: 40.47, longitude: -79.9 },
      { latitude: 40.45, longitude: -79.9 },
      { latitude: 40.45, longitude: -79.93 },
    ],
  },
  {
    id: "ZONE-3",
    name: "Placeholder Zone C",
    status: "advisory",
    population: 980,
    boundary: [
      { latitude: 40.43, longitude: -79.99 },
      { latitude: 40.43, longitude: -79.96 },
      { latitude: 40.41, longitude: -79.96 },
      { latitude: 40.41, longitude: -79.99 },
    ],
  },
  {
    id: "ZONE-4",
    name: "Placeholder Zone D",
    status: "clear",
    population: 410,
    boundary: [
      { latitude: 40.4, longitude: -79.94 },
      { latitude: 40.4, longitude: -79.91 },
      { latitude: 40.38, longitude: -79.91 },
      { latitude: 40.38, longitude: -79.94 },
    ],
  },
];

export const mockSystemStatuses: SystemStatus[] = [
  { id: "SYS-MAP", label: "Live Map Feed", status: "operational", detail: "Base map online" },
  { id: "SYS-DATA", label: "Data Sync", status: "operational", detail: "Mock data service" },
  { id: "SYS-COMMS", label: "Communications", status: "operational", detail: "Dispatch radio relay" },
  { id: "SYS-BACKEND", label: "Backend API", status: "offline", detail: "Not yet connected" },
];

export const mockIntelReports: IntelReport[] = [
  {
    id: "INTEL-1",
    source: "Field Unit 7",
    summary: "Placeholder field report: road conditions worsening near Zone B perimeter.",
    confidence: "medium",
    reported_at: minutesAgo(34),
  },
  {
    id: "INTEL-2",
    source: "Aerial Recon",
    summary: "Placeholder aerial summary: hazard front holding steady, no shift observed.",
    confidence: "high",
    reported_at: minutesAgo(26),
  },
  {
    id: "INTEL-3",
    source: "Public Reports",
    summary: "Placeholder crowd-sourced report: unconfirmed, low reliability.",
    confidence: "low",
    reported_at: minutesAgo(21),
  },
];

export const mockOperationsMetrics: OperationsMetrics = {
  evacuation_flow_per_hour: 340,
  avg_response_eta_minutes: 11,
  transportation_bottlenecks: 2,
};
