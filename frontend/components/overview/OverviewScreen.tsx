"use client";

import { useEffect, useState } from "react";
import type {
  EvacuationZone,
  Incident,
  IntelReport,
  OperationsMetrics,
  RoadClosure,
  Shelter,
  SystemStatus,
  Vehicle,
} from "@/lib/models";
import {
  getEvacuationZones,
  getIncidents,
  getIntelReports,
  getOperationsMetrics,
  getRoadClosures,
  getShelters,
  getSystemStatuses,
  getVehicles,
} from "@/lib/services/dataService";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import RoadLayerLoader from "@/components/map/RoadLayerLoader";
import RoadClosureLayerLoader from "@/components/map/RoadClosureLayerLoader";
import InfrastructureLayerLoader from "@/components/map/InfrastructureLayerLoader";
import VehicleLayerLoader from "@/components/map/VehicleLayerLoader";
import ActiveIncidentsPanel from "./ActiveIncidentsPanel";
import SystemStatusPanel from "./SystemStatusPanel";
import EmergencyFleetPanel from "./EmergencyFleetPanel";
import ShelterCapacityPanel from "./ShelterCapacityPanel";
import EvacuationStatusPanel from "./EvacuationStatusPanel";
import FieldIntelligencePanel from "./FieldIntelligencePanel";
import MetricsStrip from "./MetricsStrip";
import RoutePanel from "./RoutePanel";
import RoadClosuresPanel from "./RoadClosuresPanel";
import LayerControlPanel from "./LayerControlPanel";
import TrafficSummaryPanel from "./TrafficSummaryPanel";
import TrafficLayerLoader from "@/components/map/TrafficLayerLoader";
import HazardLayerLoader from "@/components/map/HazardLayerLoader";
import EvacuationZoneLayerLoader from "@/components/map/EvacuationZoneLayerLoader";
import type { RerouteState } from "@/lib/reroute";
import { DEFAULT_MAP_LAYER_VISIBILITY, type MapLayerKey } from "@/lib/mapLayers";

// How long each stage of the "SIMULATE CLOSURE" demo takes. Purely a UI pacing choice —
// no data is computed here, just a fixed, replayable animation timeline.
const ACTIVATING_MS = 900;
const REROUTING_MS = 1400;

interface OverviewData {
  incidents: Incident[];
  systemStatuses: SystemStatus[];
  vehicles: Vehicle[];
  shelters: Shelter[];
  zones: EvacuationZone[];
  intelReports: IntelReport[];
  metrics: OperationsMetrics;
  roadClosures: RoadClosure[];
}

export default function OverviewScreen() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);
  const [reroute, setReroute] = useState<RerouteState | null>(null);
  const [layers, setLayers] = useState(DEFAULT_MAP_LAYER_VISIBILITY);

  function toggleLayer(key: MapLayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  // Switching to a different vehicle always starts fresh — a reroute demo shouldn't carry
  // over onto whatever vehicle the user selects next.
  useEffect(() => {
    setReroute(null);
  }, [selectedVehicleId]);

  // Drives the "activating -> rerouting -> rerouted" timeline. Re-running this only when
  // the STAGE changes (not on every progress tick) keeps a single interval alive for the
  // whole reveal instead of recreating one every frame.
  useEffect(() => {
    if (!reroute) return;
    if (reroute.stage === "activating") {
      const timer = setTimeout(() => {
        setReroute((r) => (r ? { ...r, stage: "rerouting", progress: 0 } : r));
      }, ACTIVATING_MS);
      return () => clearTimeout(timer);
    }
    if (reroute.stage === "rerouting") {
      const start = Date.now();
      const id = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / REROUTING_MS);
        setReroute((r) => (r ? { ...r, progress } : r));
        if (progress >= 1) {
          clearInterval(id);
          setReroute((r) => (r ? { ...r, stage: "rerouted", progress: 1 } : r));
        }
      }, 50);
      return () => clearInterval(id);
    }
  }, [reroute?.stage]);

  function handleSimulateClosure() {
    if (!selectedVehicleId) return;
    setReroute({ vehicleId: selectedVehicleId, stage: "activating", progress: 0 });
  }

  function handleReplayReroute() {
    if (!selectedVehicleId) return;
    setReroute({ vehicleId: selectedVehicleId, stage: "activating", progress: 0 });
  }

  function handleResetReroute() {
    setReroute(null);
  }

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
      getRoadClosures(),
    ]).then(([incidents, systemStatuses, vehicles, shelters, zones, intelReports, metrics, roadClosures]) => {
      if (cancelled) return;
      setData({ incidents, systemStatuses, vehicles, shelters, zones, intelReports, metrics, roadClosures });
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
          <LayerControlPanel layers={layers} onToggle={toggleLayer} />
          <TrafficSummaryPanel />
          <ActiveIncidentsPanel incidents={data.incidents} />
          <RoadClosuresPanel
            closures={data.roadClosures}
            selectedClosureId={selectedClosureId}
            onSelectClosure={setSelectedClosureId}
          />
          <SystemStatusPanel statuses={data.systemStatuses} />
          <FieldIntelligencePanel reports={data.intelReports} />
        </aside>

        <main className="overview-map-area">
          <div className="map-frame">
            <div className="map-metrics-overlay">
              <MetricsStrip metrics={data.metrics} />
            </div>
            <div className="map-frame-canvas">
              <BaseMapLoader>
                {/* Traffic replaces the base road layer's styling while toggled on — both
                    draw the same road geometry, so showing both at once would just be
                    wasted overdraw with no visual benefit. */}
                {layers.traffic ? <TrafficLayerLoader /> : <RoadLayerLoader />}
                {layers.roadClosures && (
                  <RoadClosureLayerLoader selectedClosureId={selectedClosureId} onSelectClosure={setSelectedClosureId} />
                )}
                {layers.evacuationZones && (
                  <EvacuationZoneLayerLoader selectedZoneId={null} onSelectZone={() => {}} planVisible={false} />
                )}
                {layers.hazards && <HazardLayerLoader />}
                <InfrastructureLayerLoader showHospitals={layers.hospitals} showShelters={layers.shelters} />
                {layers.fleet && (
                  <VehicleLayerLoader
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={setSelectedVehicleId}
                    reroute={reroute}
                    showRoutes={layers.emergencyRoutes}
                  />
                )}
              </BaseMapLoader>
            </div>
          </div>
        </main>

        <aside className="overview-col overview-col-right">
          <EmergencyFleetPanel
            vehicles={data.vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
          <RoutePanel
            vehicle={data.vehicles.find((v) => v.id === selectedVehicleId) ?? null}
            reroute={reroute}
            onSimulateClosure={handleSimulateClosure}
            onReplay={handleReplayReroute}
            onReset={handleResetReroute}
          />
          <ShelterCapacityPanel shelters={data.shelters} />
          <EvacuationStatusPanel zones={data.zones} />
        </aside>
      </div>
    </div>
  );
}
