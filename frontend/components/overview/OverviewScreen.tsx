"use client";

import { useState } from "react";
import { useOperations } from "@/lib/services/OperationsProvider";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import RoadLayerLoader from "@/components/map/RoadLayerLoader";
import InfrastructureLayerLoader from "@/components/map/InfrastructureLayerLoader";
import VehicleLayerLoader from "@/components/map/VehicleLayerLoader";
import PlanLayerLoader from "@/components/map/PlanLayerLoader";
import IncidentInput from "@/components/panels/IncidentInput";
import ActiveIncidentsPanel from "./ActiveIncidentsPanel";
import SystemStatusPanel from "./SystemStatusPanel";
import EmergencyFleetPanel from "./EmergencyFleetPanel";
import ShelterCapacityPanel from "./ShelterCapacityPanel";
import EvacuationStatusPanel from "./EvacuationStatusPanel";
import OverviewPanel from "./OverviewPanel";
import MetricsStrip from "./MetricsStrip";

export default function OverviewScreen() {
  const { data, scenario, plan, parsed, busy, error, reload, runOptimization, submitReport, reset } = useOperations();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  if (!data) return <div className="overview-loading" role={error ? "alert" : "status"}>
    {error ?? "Loading command center..."}
    {error && <button type="button" onClick={() => void reload()} disabled={!!busy}>Retry connection</button>}
  </div>;
  return <div className="overview-screen">
    <div className="operations-actions">
      <button type="button" disabled={!!busy} onClick={() => void runOptimization()}>Run optimization</button>
      <button type="button" disabled={!!busy} onClick={() => void reset()}>Reset incidents</button>
      <span role="status">{busy ?? `${scenario?.scenario.name} / ${data.routes.length} evacuation routes`}</span>
    </div>
    {error && <div className="operations-error" role="alert">{error}</div>}
    <div className="overview-main-row">
      <aside className="overview-col overview-col-left">
        <ActiveIncidentsPanel incidents={data.incidents} />
        <OverviewPanel title="Emergency Report"><IncidentInput onSubmit={submitReport} disabled={!!busy} /></OverviewPanel>
        <SystemStatusPanel statuses={[{ id: "backend", label: "Backend", status: error ? "degraded" : "operational", detail: error ? "Last request failed; the last loaded plan is shown." : "Scenario and routing API connected." }]} />
        <OverviewPanel title="Field Intelligence" count={parsed?.parsed_events.length ?? 0}>
          {!parsed && <p className="empty-note">No report submitted this session.</p>}
          {parsed?.parsed_events.map((event, i) => <p className="empty-note" key={i}>{event.certainty}: {event.evidence}</p>)}
          {parsed?.notes.map((note, i) => <p className="empty-note" key={`note-${i}`}>{note}</p>)}
        </OverviewPanel>
      </aside>
      <main className="overview-map-area"><div className="map-frame">
        <div className="map-metrics-overlay"><MetricsStrip metrics={plan?.metrics ?? null} /></div>
        <div className="map-frame-canvas"><BaseMapLoader center={data.center} zoom={13}>
          <RoadLayerLoader roads={data.roads} />
          <PlanLayerLoader zones={data.zones} routes={data.routes} incidents={data.incidents} />
          <InfrastructureLayerLoader shelters={data.shelters} />
          <VehicleLayerLoader vehicles={data.vehicles} selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
        </BaseMapLoader></div>
      </div></main>
      <aside className="overview-col overview-col-right">
        <EmergencyFleetPanel vehicles={data.vehicles} selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
        {plan && plan.dispatch_summary.length > 0 && <p className="empty-note" role="status">Dispatch: {plan.metrics.ambulances_dispatched} ambulances, {plan.metrics.rescue_teams_dispatched} rescue teams. Uncovered injuries: {plan.metrics.uncovered_injuries}; unfilled rescue requests: {plan.metrics.unfilled_rescue_requests}.</p>}
        <ShelterCapacityPanel shelters={data.shelters} />
        <EvacuationStatusPanel zones={data.zones} />
      </aside>
    </div>
  </div>;
}
