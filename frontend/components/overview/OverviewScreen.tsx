"use client";

import { useEffect, useState } from "react";
import type {
  EvacuationZone,
  Incident,
  IntelReport,
  OperationsMetrics,
  Shelter,
  SystemStatus,
  Vehicle,
} from "@/lib/models";
import {
  getEvacuationZones,
  getIncidents,
  getIntelReports,
  getOperationsMetrics,
  getShelters,
  getSystemStatuses,
  getVehicles,
} from "@/lib/services/dataService";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import InfrastructureLayerLoader from "@/components/map/InfrastructureLayerLoader";
import VehicleLayerLoader from "@/components/map/VehicleLayerLoader";
import ActiveIncidentsPanel from "./ActiveIncidentsPanel";
import SystemStatusPanel from "./SystemStatusPanel";
import EmergencyFleetPanel from "./EmergencyFleetPanel";
import ShelterCapacityPanel from "./ShelterCapacityPanel";
import EvacuationStatusPanel from "./EvacuationStatusPanel";
import FieldIntelligencePanel from "./FieldIntelligencePanel";
import MetricsStrip from "./MetricsStrip";

interface OverviewData {
  incidents: Incident[];
  systemStatuses: SystemStatus[];
  vehicles: Vehicle[];
  shelters: Shelter[];
  zones: EvacuationZone[];
  intelReports: IntelReport[];
  metrics: OperationsMetrics;
}

export default function OverviewScreen() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getIncidents(),
      getSystemStatuses(),
      getVehicles(),
      getShelters(),
      getEvacuationZones(),
      getIntelReports(),
      getOperationsMetrics(),
    ]).then(([incidents, systemStatuses, vehicles, shelters, zones, intelReports, metrics]) => {
      if (cancelled) return;
      setData({ incidents, systemStatuses, vehicles, shelters, zones, intelReports, metrics });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return <div className="overview-loading">Loading command center…</div>;
  }

  return (
    <div className="overview-screen">
      <div className="overview-main-row">
        <aside className="overview-col overview-col-left">
          <ActiveIncidentsPanel incidents={data.incidents} />
          <SystemStatusPanel statuses={data.systemStatuses} />
          <FieldIntelligencePanel reports={data.intelReports} />
        </aside>

        <main className="overview-map-area">
          <div className="map-frame">
            <BaseMapLoader>
              <InfrastructureLayerLoader />
              <VehicleLayerLoader selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
            </BaseMapLoader>
            <div className="map-metrics-overlay">
              <MetricsStrip metrics={data.metrics} />
            </div>
          </div>
        </main>

        <aside className="overview-col overview-col-right">
          <EmergencyFleetPanel
            vehicles={data.vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
          <ShelterCapacityPanel shelters={data.shelters} />
          <EvacuationStatusPanel zones={data.zones} />
        </aside>
      </div>
    </div>
  );
}
