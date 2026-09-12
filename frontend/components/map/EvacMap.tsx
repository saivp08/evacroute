"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment } from "react";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Circle, Marker, Popup, Tooltip } from "react-leaflet";
import type { ScenarioState, ZoneStatus } from "@/lib/types";

const ZONE_COLOR: Record<ZoneStatus, string> = {
  clear: "#22c55e",
  "at-risk": "#eab308",
  evacuating: "#3b82f6",
  critical: "#ef4444",
};

function divIcon(html: string, size: number) {
  return L.divIcon({ html, className: "evac-div-icon", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

const AMBULANCE_ICON = divIcon('<div style="font-size:18px;filter:drop-shadow(0 0 2px #000)">🚑</div>', 20);
const STATION_ICON = divIcon('<div style="font-size:14px;filter:drop-shadow(0 0 2px #000)">🚒</div>', 16);

interface EvacMapProps {
  scenario: ScenarioState;
  center: [number, number];
  changedZoneIds?: Set<string>;
}

export default function EvacMap({ scenario, center, changedZoneIds }: EvacMapProps) {
  const blockedRefs = new Set(scenario.blockedRoads.map((r) => r.roadRef));

  return (
    <MapContainer center={center} zoom={12} className="evac-map" preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {scenario.zones.map((zone) => (
        <Polygon
          key={zone.id}
          positions={zone.boundary}
          pathOptions={{
            color: ZONE_COLOR[zone.status],
            fillColor: ZONE_COLOR[zone.status],
            fillOpacity: changedZoneIds?.has(zone.id) ? 0.45 : 0.2,
            weight: changedZoneIds?.has(zone.id) ? 3 : 1,
          }}
        >
          <Tooltip sticky>
            <strong>{zone.name}</strong>
            <br />
            Population: {zone.population.toLocaleString()}
            <br />
            Vulnerability: {zone.vulnerablePct.toFixed(0)}%
            <br />
            Status: {zone.status}
          </Tooltip>
        </Polygon>
      ))}

      {scenario.hazards.map((hazard) => (
        <Circle
          key={hazard.id}
          center={hazard.location}
          radius={hazard.radiusMeters}
          pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.12, weight: 1, dashArray: "4 4" }}
        >
          <Tooltip>
            {hazard.name} ({hazard.acresBurned.toLocaleString()} acres, historical reference)
          </Tooltip>
        </Circle>
      ))}

      {Object.entries(scenario.roads).map(([ref, segments]) =>
        segments.map((segment) => (
          <Polyline
            key={segment.id}
            positions={segment.coordinates}
            pathOptions={{
              color: blockedRefs.has(ref) ? "#7f1d1d" : "#475569",
              weight: 2,
              opacity: 0.5,
              dashArray: blockedRefs.has(ref) ? "2 6" : undefined,
            }}
          >
            <Tooltip>{ref}{blockedRefs.has(ref) ? " (blocked)" : ""}</Tooltip>
          </Polyline>
        ))
      )}

      {scenario.blockedRoads.map((road) => (
        <Polyline
          key={road.id}
          positions={road.coordinates}
          pathOptions={{ color: "#ef4444", weight: 5, dashArray: "2 8", lineCap: "round" }}
        >
          <Tooltip>Blocked: {road.reason}</Tooltip>
        </Polyline>
      ))}

      {scenario.assignments.map((a, i) => (
        <Polyline
          key={`${a.zoneId}-${a.shelterId}-${i}`}
          positions={a.coordinates}
          pathOptions={{
            color: changedZoneIds?.has(a.zoneId) ? "#facc15" : "#38bdf8",
            weight: changedZoneIds?.has(a.zoneId) ? 4 : 2,
            opacity: 0.8,
          }}
        >
          <Tooltip sticky>
            {a.zoneName} &rarr; {a.shelterName} ({a.people.toLocaleString()} people)
          </Tooltip>
        </Polyline>
      ))}

      {scenario.fireStations.map((station) => (
        <Marker key={station.id} position={station.location} icon={STATION_ICON}>
          <Popup>{station.name}</Popup>
        </Marker>
      ))}

      {scenario.shelters.map((shelter) => (
        <CircleMarker
          key={shelter.id}
          center={shelter.location}
          radius={7}
          pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.8, weight: 1 }}
        >
          <Popup>
            <strong>{shelter.name}</strong>
            <br />
            {shelter.address}
            <br />
            Capacity: {shelter.capacity.toLocaleString()}
          </Popup>
        </CircleMarker>
      ))}

      {scenario.ambulances.map((ambulance) => (
        <Fragment key={ambulance.id}>
          <Polyline positions={ambulance.coordinates} pathOptions={{ color: "#f472b6", weight: 2, dashArray: "4 6", opacity: 0.8 }} />
          <Marker position={ambulance.coordinates[1]} icon={AMBULANCE_ICON}>
            <Popup>
              <strong>{ambulance.id}</strong>
              <br />
              From {ambulance.stationName}
              <br />
              En route to {ambulance.destinationZoneName}
            </Popup>
          </Marker>
        </Fragment>
      ))}
    </MapContainer>
  );
}
