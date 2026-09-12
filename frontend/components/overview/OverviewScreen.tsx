"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvacuationZone, Incident, OperationalEvent, OperationsMetrics, RoadClosure, Shelter, Vehicle } from "@/lib/models";
import {
  getEvacuationZones,
  getIncidents,
  getOperationsMetrics,
  getRoadClosures,
  getShelters,
  getVehicles,
  resolveIncident,
  submitIncidentReport,
} from "@/lib/services/dataService";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import RoadLayerLoader from "@/components/map/RoadLayerLoader";
import RoadClosureLayerLoader from "@/components/map/RoadClosureLayerLoader";
import IncidentLayerLoader from "@/components/map/IncidentLayerLoader";
import InfrastructureLayerLoader from "@/components/map/InfrastructureLayerLoader";
import VehicleLayerLoader from "@/components/map/VehicleLayerLoader";
import HazardLayerLoader from "@/components/map/HazardLayerLoader";
import EvacuationZoneLayerLoader from "@/components/map/EvacuationZoneLayerLoader";
import EvacuationRouteLayerLoader from "@/components/map/EvacuationRouteLayerLoader";
import ActiveIncidentsPanel from "./ActiveIncidentsPanel";
import EmergencyFleetPanel from "./EmergencyFleetPanel";
import ShelterCapacityPanel from "./ShelterCapacityPanel";
import EvacuationStatusPanel from "./EvacuationStatusPanel";
import MetricsStrip from "./MetricsStrip";
import RoadClosuresPanel from "./RoadClosuresPanel";
import LayerControlPanel from "./LayerControlPanel";
import InspectorPanel from "./InspectorPanel";
import CriticalAlertBanner from "./CriticalAlertBanner";
import ToastStack from "./ToastStack";
import LiveOperationsStream from "./LiveOperationsStream";
import MapLegend from "./MapLegend";
import IncidentReportPanel, { type PendingLocation } from "./IncidentReportPanel";
import MapClickCaptureLoader from "@/components/map/MapClickCaptureLoader";
import AssistantWidget from "@/components/assistant/AssistantWidget";
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

// A deliberately-chosen exception to "never fabricate incidents": explicitly requested so
// the app always shows a live scenario unfolding — glowing affected roads, dispatched
// responders moving, escalated evacuation demand — instead of a calm, empty map, with
// multiple independent incidents able to be active at once. Each one goes through the exact
// same real submission path a user's own report would (same parser, same optimizer, same
// rerouting, same dispatch logic), and is individually removed via the real
// POST /incident/{id}/resolve once its own real dispatched responder's own real ETA has
// elapsed — never a blanket reset that would also clear a real user's own report. Only the
// initial trigger and the random pick-order are fabricated; every effect downstream is real.
// Each entry is one clean, individually-verified report (a compound multi-event sentence
// referencing the same zone from two events was tried and rejected by the parser's own
// strict schema — kept to one event per report instead of fighting the validator).
const DEMO_INCIDENT_POOL = [
  "Debris has closed Redwood Highway, blocking two lanes.",
  "A crash has closed College Avenue.",
  "Medical emergency in Zone A. One person is injured and needs immediate transport.",
  "Medical emergency in Zone B. One person is injured and needs immediate transport.",
  "Rescue needed in Zone C. A person is trapped and cannot be moved.",
];
const MAX_CONCURRENT_DEMO_INCIDENTS = 2;
// How long a demo incident with no dispatched responder (e.g. a plain road closure) stays
// active before being cycled out — there's no real "arrival" event to key off for those.
const DEMO_FALLBACK_DURATION_MS = 50000;
const DEMO_TICK_MS = 5000;

interface OverviewData {
  incidents: Incident[];
  vehicles: Vehicle[];
  shelters: Shelter[];
  zones: EvacuationZone[];
  metrics: OperationsMetrics;
  roadClosures: RoadClosure[];
}

type Toast = OperationalEvent & { toastId: string };

export default function OverviewScreen() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [reroute, setReroute] = useState<RerouteState | null>(null);
  // id -> real epoch-ms deadline (its dispatched responder's own real ETA, or the fallback
  // duration for incidents with no dispatch) — only demo-seeded incidents are ever tracked
  // here, so this loop never touches or resolves anything a real user reported themselves.
  const demoTracked = useRef<Map<string, number>>(new Map());
  const demoRecentlyUsed = useRef<string[]>([]);
  const demoTickRunning = useRef(false);
  const hasLoadedOnce = useRef(false);
  const [layers, setLayers] = useState(DEFAULT_MAP_LAYER_VISIBILITY);
  const [criticalAlert, setCriticalAlert] = useState<OperationalEvent | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pickModeActive, setPickModeActive] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null);
  // The specific category the user picked when reporting an incident (e.g. "Flooding"),
  // keyed by the real backend id the submission returned — session-only, display purposes
  // only (see Incident.reportedTypeLabel).
  const [incidentTypeLabels, setIncidentTypeLabels] = useState<Record<string, string>>({});

  const handleMapPick = useCallback((lat: number, lng: number) => {
    setPendingLocation({ lat, lng });
    setPickModeActive(false);
  }, []);

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
  // invalidateBackendState() call it makes) so the map AND the rails actually reflect a
  // changed backend — a new incident, a shelter occupancy update, a reroute — instead of the
  // snapshot captured on first load ever being replaced. Every map layer that shows
  // incidents/closures/shelters/vehicles reads this same `data`, not its own independent
  // fetch, so a real backend change is guaranteed to reach the map, not just the rail.
  const load = useCallback(() => {
    invalidateBackendState();
    return Promise.all([
      getIncidents(),
      getVehicles(),
      getShelters(),
      getEvacuationZones(),
      getOperationsMetrics(),
      getRoadClosures(),
    ]).then(([incidents, vehicles, shelters, zones, metrics, roadClosures]) => {
      setData({ incidents, vehicles, shelters, zones, metrics, roadClosures });
      hasLoadedOnce.current = true;
    });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const pickNextDemoReport = useCallback(() => {
    const notRecent = DEMO_INCIDENT_POOL.filter((report) => !demoRecentlyUsed.current.includes(report));
    const pool = notRecent.length > 0 ? notRecent : DEMO_INCIDENT_POOL;
    const report = pool[Math.floor(Math.random() * pool.length)];
    // Never immediately repeat: remember all-but-one of the pool so the next pick can't be
    // the same report again (once the whole pool has cycled through, it opens back up).
    demoRecentlyUsed.current = [report, ...demoRecentlyUsed.current].slice(0, DEMO_INCIDENT_POOL.length - 1);
    return report;
  }, []);

  const seedOneDemoIncident = useCallback(async () => {
    const report = pickNextDemoReport();
    try {
      const result = await submitIncidentReport(report);
      await load();
      if (result.newIncidentIds.length === 0) return;
      const newId = result.newIncidentIds[0];
      // The real dispatched responder's own real ETA decides how long this stays active —
      // never a random or fixed duration when a real one is available.
      const vehicles = await getVehicles();
      const responder = vehicles.find((v) => v.destination === newId && v.eta_minutes !== null);
      const deadline = Date.now() + (responder ? responder.eta_minutes! * 60000 : DEMO_FALLBACK_DURATION_MS);
      demoTracked.current.set(newId, deadline);
    } catch {
      // Skip this cycle (e.g. the parser is temporarily unavailable) — the next tick tries
      // again rather than falling back to any fabricated state.
    }
  }, [load, pickNextDemoReport]);

  // Keeps a real, ever-changing emergency scenario running: each demo-seeded incident is
  // independently resolved (via the real POST /incident/{id}/resolve, not a blanket reset)
  // once its own real responder's ETA elapses, then replaced by a different randomly-picked
  // one — while other concurrently active incidents (demo or real-user-submitted) are left
  // untouched. Multiple can be active at once, up to MAX_CONCURRENT_DEMO_INCIDENTS.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!hasLoadedOnce.current || demoTickRunning.current || cancelled) return;
      demoTickRunning.current = true;
      try {
        const now = Date.now();
        for (const [incidentId, deadline] of Array.from(demoTracked.current.entries())) {
          if (now < deadline) continue;
          demoTracked.current.delete(incidentId);
          await resolveIncident(incidentId).catch(() => {});
          await load();
          await seedOneDemoIncident();
        }
        if (demoTracked.current.size < MAX_CONCURRENT_DEMO_INCIDENTS) {
          await seedOneDemoIncident();
        }
      } finally {
        demoTickRunning.current = false;
      }
    }

    const id = setInterval(tick, DEMO_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load, seedOneDemoIncident]);

  if (!data) {
    return <div className="overview-loading">Loading transportation network…</div>;
  }

  const displayIncidents = data.incidents.map((incident) =>
    incidentTypeLabels[incident.id] ? { ...incident, reportedTypeLabel: incidentTypeLabels[incident.id] } : incident
  );

  return (
    <div className="overview-screen">
      {criticalAlert && (
        <CriticalAlertBanner event={criticalAlert} onViewOnMap={viewCriticalAlertOnMap} onDismiss={() => setCriticalAlert(null)} />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="overview-main-row">
        <aside className="overview-col overview-col-left">
          <IncidentReportPanel
            pendingLocation={pendingLocation}
            pickModeActive={pickModeActive}
            onTogglePickMode={() => setPickModeActive((v) => !v)}
            onLocationConsumed={() => setPendingLocation(null)}
            onIncidentApplied={(incidentId, userTypeLabel) => {
              setIncidentTypeLabels((prev) => ({ ...prev, [incidentId]: userTypeLabel }));
              load().then(() => select("incident", incidentId));
            }}
          />
          <LayerControlPanel layers={layers} onToggle={toggleLayer} />
          <ActiveIncidentsPanel
            incidents={displayIncidents}
            selectedIncidentId={selectedIncidentId}
            onSelectIncident={(id) => select("incident", id)}
          />
          <RoadClosuresPanel
            closures={data.roadClosures}
            selectedClosureId={selectedClosureId}
            onSelectClosure={(id) => select("closure", id)}
          />
        </aside>

        <main className="overview-map-area">
          <div className="map-frame">
            <div className="map-metrics-overlay">
              <MetricsStrip metrics={data.metrics} />
            </div>
            <div className={`map-frame-canvas ${pickModeActive ? "map-frame-canvas-picking" : ""}`}>
              <BaseMapLoader>
                <MapClickCaptureLoader pickModeActive={pickModeActive} onPick={handleMapPick} />
                {layers.traffic && <RoadLayerLoader />}
                {layers.roadClosures && (
                  <RoadClosureLayerLoader
                    closures={data.roadClosures}
                    selectedClosureId={selectedClosureId}
                    onSelectClosure={(id) => select("closure", id)}
                    hasSelection={selection !== null}
                  />
                )}
                {layers.evacuationZones && (
                  <EvacuationZoneLayerLoader selectedZoneId={selectedZoneId} onSelectZone={(id) => select("zone", id)} />
                )}
                {layers.hazards && <HazardLayerLoader />}
                <EvacuationRouteLayerLoader />
                <IncidentLayerLoader
                  incidents={data.incidents}
                  selectedIncidentId={selectedIncidentId}
                  onSelectIncident={(id) => select("incident", id)}
                  hasSelection={selection !== null}
                />
                <InfrastructureLayerLoader
                  shelters={data.shelters}
                  showHospitals={layers.hospitals}
                  showShelters={layers.shelters}
                  selectedShelterId={selectedShelterId}
                  onSelectShelter={(id) => select("shelter", id)}
                  hasSelection={selection !== null}
                />
                {layers.fleet && (
                  <VehicleLayerLoader
                    vehicles={data.vehicles}
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={(id) => select("vehicle", id)}
                    reroute={reroute}
                    showRoutes={layers.emergencyRoutes}
                    hasSelection={selection !== null}
                  />
                )}
              </BaseMapLoader>
              <InspectorPanel
                selection={selection}
                incidents={displayIncidents}
                closures={data.roadClosures}
                shelters={data.shelters}
                zones={data.zones}
                vehicles={data.vehicles}
                reroute={reroute}
                onSimulateClosure={handleSimulateClosure}
                onReplayReroute={handleReplayReroute}
                onResetReroute={handleResetReroute}
                onClose={() => setSelection(null)}
              />
              <MapLegend />
            </div>
            <LiveOperationsStream events={events} />
          </div>
        </main>
        <AssistantWidget onViewReference={select} />

        <aside className="overview-col overview-col-right">
          <EmergencyFleetPanel
            vehicles={data.vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={(id) => select("vehicle", id)}
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
