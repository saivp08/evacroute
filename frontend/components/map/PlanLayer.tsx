"use client";

import { Fragment } from "react";
import { CircleMarker, Polygon, Polyline, Popup } from "react-leaflet";
import type { EvacuationZone, Incident, Route } from "@/lib/models";
import { validCoordinate } from "@/lib/services/normalize";

export default function PlanLayer({ zones, routes, incidents }: { zones: EvacuationZone[]; routes: Route[]; incidents: Incident[] }) {
  return <>
    {zones.map((zone) => <Fragment key={zone.id}>
      {(zone.boundaries ?? []).map((boundary, index) => <Polygon key={`${zone.id}-${index}`}
        positions={boundary.map((p): [number, number] => [p.latitude, p.longitude])}
        pathOptions={{ color: "#a78bfa", weight: 2, fillOpacity: 0.07 }}>
        <Popup>{zone.name}: {zone.population.toLocaleString()} people</Popup>
      </Polygon>)}
      {validCoordinate([zone.latitude, zone.longitude]) && <CircleMarker center={[zone.latitude!, zone.longitude!]} radius={6} pathOptions={{ color: "#a78bfa" }}>
        <Popup>{zone.name}: {zone.population.toLocaleString()} people</Popup>
      </CircleMarker>}
    </Fragment>)}
    {routes.map((route) => <Polyline key={route.id}
      positions={route.coordinates.map((p): [number, number] => [p.latitude, p.longitude])}
      pathOptions={{ color: "#34d399", weight: 4, opacity: 0.8 }}>
      <Popup>{zones.find((z) => z.id === route.origin_zone_id)?.name ?? route.origin_zone_id} to {route.destination_shelter_id}<br />
        {route.people_count.toLocaleString()} people / {route.eta_minutes} min planned</Popup>
    </Polyline>)}
    {incidents.filter((i) => validCoordinate([i.latitude, i.longitude])).map((incident) => <CircleMarker key={incident.id}
      center={[incident.latitude!, incident.longitude!]} radius={9} pathOptions={{ color: "#fb7185", fillOpacity: 0.7 }}>
      <Popup>{incident.description}</Popup>
    </CircleMarker>)}
  </>;
}
