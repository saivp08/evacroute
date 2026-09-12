"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EvacuationZone,
  Incident,
  IntelReport,
  OperationalEvent,
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
import IncidentLayerLoader from "@/components/map/IncidentLayerLoader";
import InfrastructureLayerLoader from "@/components/map/InfrastructureLayerLoader";
import VehicleLayerLoader from "@/components/map/VehicleLayerLoader";
import HazardLayerLoader from "@/components/map/HazardLayerLoader";
import EvacuationZoneLayerLoader from "@/components/map/EvacuationZoneLayerLoader";
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
import NetworkStatusPanel from "./NetworkStatusPanel";
import ContextDrawer from "./ContextDrawer";
import CriticalAlertBanner from "./CriticalAlertBanner";
import ToastStack from "./ToastStack";
import LiveOperationsStream from "./LiveOperationsStream";
import type { RerouteState } from "@/lib/reroute";
import { DEFAULT_MAP_LAYER_VISIBILITY, type MapLayerKey } from "@/lib/mapLayers";
import type { Selection, SelectionState } from "@/lib/selection";
import { useLiveEvents, LIVE_POLL_MS } from "@/lib/useLiveEvents";
import { invalidateBackendState } from "@/lib/services/backendClient";

// How long each stage of the "SIMULATE CLOSURE" demo takes. Purely a UI pacing choice —
// no data is computed here, just a fixed, replayable animation timeline.
const ACTIVATING_MS = 900;
const REROUTING_MS = 1400;
const MAX_TOASTS = 3;

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

type Toast = OperationalEvent & { toastId: string };

export default function OverviewScreen() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [reroute, setReroute] = useState<RerouteState | null>(null);
  const [layers, setLayers] = useState(DEFAULT_MAP_LAYER_VISIBILITY);
  const [criticalAlert, setCriticalAlert] = useState<OperationalEvent | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const select = useCallback((kind: Selection["kind"], id: string) => {
    setSelection({ kind, id });
  }, []);

  const handleNewEvents = useCallback((batch: OperationalEvent[]) => {
    const critical = [...batch].reverse().find((event) => event.severity === "critical");
    if (critical) setCriticalAlert(critical);

    const nonCritical = batch.filter((event) => event.severity !== "critical");
    if (nonCritical.length > 0) {
      setToasts((prev) => [
        ...nonCritical.map((event) => ({ ...event, toastId: `${event.id}-toast` })),
        ...prev,
      ].slice(0, MAX_TOASTS));
    }
  }, []);

  const events = useLiveEvents(handleNewEvents);

  function dismissToast(toastId: string) {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }

  function viewCriticalAlertOnMap() {
    if (!criticalAlert?.entityId) return;
    if (criticalAlert.kind === "incident") select("incident", criticalAlert.entityId);
    else if (criticalAlert.kind === "closure") select("closure", criticalAlert.entityId);
    setCriticalAlert(null);
  }

  function toggleLayer(key: MapLayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  const selectedVehicleId = selection?.kind === "vehicle" ? selection.id : null;
  const selectedClosureId = selection?.kind === "closure" ? selection.id : null;
  const selectedIncidentId = selection?.kind === "incident" ? selection.id : null;
  const selectedShelterId = selection?.kind === "shelter" ? selection.id : null;
  const selectedZoneId = selection?.kind === "zone" ? selection.id : null;

  // Switching the selected vehicle always starts fresh — a reroute demo shouldn't carry
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

  // Polls at the same cadence as useLiveEvents (and relies on the same
  // invalidateBackendState() call it makes) so the rails actually reflect a changed
  // backend — a new incident, a shelter occupancy update — instead of the snapshot
  // captured on first load ever being replaced.
  useEffect(() => {
    let cancelled = false;

    function load() {
      invalidateBackendState();
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
    }

    load();
    const id = setInterval(load, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) {
    return <div className="overview-loading">Loading transportation network…</div>;
  }

  return (
    <div className="overview-screen">
      {criticalAlert && (
        <CriticalAlertBanner event={criticalAlert} onViewOnMap={viewCriticalAlertOnMap} onDismiss={() => setCriticalAlert(null)} />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="overview-main-row">
        <aside className="overview-col overview-col-left">
          <LayerControlPanel layers={layers} onToggle={toggleLayer} />
          <NetworkStatusPanel />
          <ActiveIncidentsPanel
            incidents={data.incidents}
            selectedIncidentId={selectedIncidentId}
            onSelectIncident={(id) => select("incident", id)}
          />
          <RoadClosuresPanel
            closures={data.roadClosures}
            selectedClosureId={selectedClosureId}
            onSelectClosure={(id) => select("closure", id)}
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
                {layers.traffic && <RoadLayerLoader />}
                {layers.roadClosures && (
                  <RoadClosureLayerLoader selectedClosureId={selectedClosureId} onSelectClosure={(id) => select("closure", id)} />
                )}
                {layers.evacuationZones && (
                  <EvacuationZoneLayerLoader selectedZoneId={selectedZoneId} onSelectZone={(id) => select("zone", id)} />
                )}
                {layers.hazards && <HazardLayerLoader />}
                <IncidentLayerLoader selectedIncidentId={selectedIncidentId} onSelectIncident={(id) => select("incident", id)} />
                <InfrastructureLayerLoader
                  showHospitals={layers.hospitals}
                  showShelters={layers.shelters}
                  selectedShelterId={selectedShelterId}
                  onSelectShelter={(id) => select("shelter", id)}
                />
                {layers.fleet && (
                  <VehicleLayerLoader
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={(id) => select("vehicle", id)}
                    reroute={reroute}
                    showRoutes={layers.emergencyRoutes}
                  />
                )}
              </BaseMapLoader>
              <ContextDrawer
                selection={selection}
                incidents={data.incidents}
                closures={data.roadClosures}
                shelters={data.shelters}
                zones={data.zones}
                onClose={() => setSelection(null)}
              />
            </div>
            <LiveOperationsStream events={events} />
          </div>
        </main>

        <aside className="overview-col overview-col-right">
          <EmergencyFleetPanel
            vehicles={data.vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={(id) => select("vehicle", id)}
          />
          <RoutePanel
            vehicle={data.vehicles.find((v) => v.id === selectedVehicleId) ?? null}
            reroute={reroute}
            onSimulateClosure={handleSimulateClosure}
            onReplay={handleReplayReroute}
            onReset={handleResetReroute}
          />
          <ShelterCapacityPanel
            shelters={data.shelters}
            selectedShelterId={selectedShelterId}
            onSelectShelter={(id) => select("shelter", id)}
          />
          <EvacuationStatusPanel zones={data.zones} selectedZoneId={selectedZoneId} onSelectZone={(id) => select("zone", id)} />
        </aside>
      </div>
    </div>
  );
}
