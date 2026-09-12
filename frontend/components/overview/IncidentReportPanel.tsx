"use client";

// Free-text incident intake -> POST /incident/parse -> real backend replan. The staged
// "Analyzing / Replanning" copy is cosmetic pacing for a single request/response call (the
// backend has no streaming progress signal to reflect) — the completion state and every
// count in it are real, read straight off the backend's response
// (see submitIncidentReport in lib/services/dataService.ts).
import { useState } from "react";
import { submitIncidentReport } from "@/lib/services/dataService";
import { BackendRequestError } from "@/lib/services/backendClient";
import OverviewPanel from "./OverviewPanel";

type Stage = "idle" | "analyzing" | "replanning" | "done" | "error";

const ANALYZING_MS = 700;

export default function IncidentReportPanel() {
  const [report, setReport] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [summary, setSummary] = useState<{ appliedIncidentCount: number; ambulancesDispatched: number; rescueTeamsDispatched: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const text = report.trim();
    if (!text || stage === "analyzing" || stage === "replanning") return;

    setStage("analyzing");
    setError(null);
    setSummary(null);

    const pending = submitIncidentReport(text);
    setTimeout(() => setStage((s) => (s === "analyzing" ? "replanning" : s)), ANALYZING_MS);

    try {
      const result = await pending;
      setSummary(result);
      setStage("done");
      setReport("");
    } catch (err) {
      setError(err instanceof BackendRequestError ? err.message : "Unable to submit this report right now.");
      setStage("error");
    }
  }

  const busy = stage === "analyzing" || stage === "replanning";

  return (
    <OverviewPanel title="Report Incident">
      <div className="incident-report-form">
        <textarea
          className="incident-report-input"
          placeholder="e.g. Debris has completely blocked Fourth Street. Twelve people are injured in Zone C."
          value={report}
          onChange={(e) => setReport(e.target.value)}
          disabled={busy}
          rows={3}
        />
        <button type="button" className="op-button op-button-danger" onClick={handleSubmit} disabled={busy || report.trim().length === 0}>
          {busy ? "Submitting…" : "Submit Report"}
        </button>
      </div>

      {stage === "analyzing" && <p className="incident-report-status">Analyzing incident…</p>}
      {stage === "replanning" && <p className="incident-report-status">Replanning transportation network…</p>}
      {stage === "error" && error && <p className="incident-report-status incident-report-status-error">{error}</p>}
      {stage === "done" && summary && (
        <div className="incident-report-status incident-report-status-done">
          <div className="incident-report-status-title">Plan Updated</div>
          <div>{summary.appliedIncidentCount} incident{summary.appliedIncidentCount === 1 ? "" : "s"} applied</div>
          <div>{summary.ambulancesDispatched} ambulance{summary.ambulancesDispatched === 1 ? "" : "s"} dispatched</div>
          <div>{summary.rescueTeamsDispatched} rescue team{summary.rescueTeamsDispatched === 1 ? "" : "s"} dispatched</div>
        </div>
      )}
    </OverviewPanel>
  );
}
