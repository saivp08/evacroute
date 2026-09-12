"use client";

import { Marker, Popup } from "react-leaflet";
import type { Shelter } from "@/lib/models";
import { shelterIcon } from "./markerIcons";

// Render only infrastructure supplied by the backend.
export default function InfrastructureLayer({ shelters }: { shelters: Shelter[] }) {
  return <>
      {shelters.map((shelter) => (
        <Marker key={shelter.id} position={[shelter.latitude, shelter.longitude]} icon={shelterIcon(shelter.status)}>
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{shelter.name}</div>
              <div className="marker-popup-sub">{shelter.address}</div>
              <div className="marker-popup-row">
                <span>Status</span>
                <span>{shelter.status}</span>
              </div>
              <div className="marker-popup-row">
                <span>Current + planned</span>
                <span>
                  {shelter.occupancy} / {shelter.capacity}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
  </>;
}
