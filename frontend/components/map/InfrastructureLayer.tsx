"use client";

// Infrastructure marker layer: hospitals, shelters, fire stations, police stations.
//   map component -> this layer -> lib/services/dataService -> mock data (today) / backend (later)
// This layer owns its own fetch so it can be dropped into any map without the parent
// screen needing to know about infrastructure data.
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import type { FireStation, Hospital, PoliceStation, Shelter } from "@/lib/models";
import { getFireStations, getHospitals, getPoliceStations, getShelters } from "@/lib/services/dataService";
import { fireStationIcon, hospitalIcon, policeStationIcon, shelterIcon } from "./markerIcons";

interface InfrastructureLayerProps {
  // Fire/police stations have no Phase 10 layer-control toggle, so they stay unconditional;
  // only Hospitals and Shelters are individually togglable (see LayerControlPanel).
  showHospitals?: boolean;
  showShelters?: boolean;
}

export default function InfrastructureLayer({ showHospitals = true, showShelters = true }: InfrastructureLayerProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [fireStations, setFireStations] = useState<FireStation[]>([]);
  const [policeStations, setPoliceStations] = useState<PoliceStation[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHospitals(), getShelters(), getFireStations(), getPoliceStations()]).then(
      ([h, s, f, p]) => {
        if (cancelled) return;
        setHospitals(h);
        setShelters(s);
        setFireStations(f);
        setPoliceStations(p);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {showHospitals && hospitals.map((hospital) => (
        <Marker key={hospital.id} position={[hospital.latitude, hospital.longitude]} icon={hospitalIcon(hospital.status)}>
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{hospital.name}</div>
              <div className="marker-popup-row">
                <span>Status</span>
                <span>{hospital.status}</span>
              </div>
              <div className="marker-popup-row">
                <span>Trauma Level</span>
                <span>{hospital.trauma_level ?? "—"}</span>
              </div>
              <div className="marker-popup-row">
                <span>Beds Available</span>
                <span>
                  {hospital.beds_available} / {hospital.bed_capacity}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {showShelters && shelters.map((shelter) => (
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
                <span>Occupancy</span>
                <span>
                  {shelter.occupancy} / {shelter.capacity}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {fireStations.map((station) => (
        <Marker key={station.id} position={[station.latitude, station.longitude]} icon={fireStationIcon(station.status)}>
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{station.name}</div>
              <div className="marker-popup-row">
                <span>Status</span>
                <span>{station.status}</span>
              </div>
              <div className="marker-popup-row">
                <span>Jurisdiction</span>
                <span>{station.jurisdiction}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {policeStations.map((station) => (
        <Marker key={station.id} position={[station.latitude, station.longitude]} icon={policeStationIcon(station.status)}>
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{station.name}</div>
              <div className="marker-popup-row">
                <span>Status</span>
                <span>{station.status}</span>
              </div>
              <div className="marker-popup-row">
                <span>Jurisdiction</span>
                <span>{station.jurisdiction}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
