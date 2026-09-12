"use client";

// Structured incident intake -> composes one real sentence from the fields below -> POST
// /incident/parse -> real backend replan. The backend only understands free text (it's an
// LLM extraction endpoint, see backend/app/openai/client.py), so the "structured form" here
// is a UI convenience over the same real submission, not a second code path — nothing about
// severity/type/location is invented on the frontend, it's just assembled into a sentence
// the existing parser already handles. The staged "Analyzing / Replanning" copy is cosmetic
// pacing for a single request/response call; the completion state and every count in it are
// real, read straight off the backend's response (see submitIncidentReport in
// lib/services/dataService.ts).
import { useEffect, useRef, useState } from "react";
import { getRoutes, submitIncidentReport } from "@/lib/services/dataService";
import { analyzeIncidentImage, type ImageAnalysisResult, type IncidentImageType } from "@/lib/services/backendClient";
import OverviewPanel from "./OverviewPanel";

type Stage = "idle" | "analyzing" | "replanning" | "done" | "error";
type ImageStage = "idle" | "analyzing" | "done" | "error";

const ANALYZING_MS = 700;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const INCIDENT_TYPES = ["Fire", "Wildfire", "Flooding", "Road obstruction", "Crash", "Medical emergency", "Hazardous material", "Other"] as const;
const SEVERITIES = ["Low", "Moderate", "High", "Critical"] as const;

// Maps Gemini's fixed vocabulary onto this form's own dropdown options — the two lists
// don't use identical wording (e.g. "ROAD_CLOSURE" vs "Road obstruction").
const IMAGE_TYPE_TO_FORM_TYPE: Record<IncidentImageType, (typeof INCIDENT_TYPES)[number]> = {
  FIRE: "Fire",
  FLOOD: "Flooding",
  ROAD_CLOSURE: "Road obstruction",
  CRASH: "Crash",
  MEDICAL_EMERGENCY: "Medical emergency",
  WILDFIRE: "Wildfire",
  HAZARDOUS_MATERIAL: "Hazardous material",
  OTHER: "Other",
};

const IMAGE_SEVERITY_TO_FORM_SEVERITY: Record<string, (typeof SEVERITIES)[number]> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

function confidenceLabel(score: number): string {
  if (score >= 0.75) return "High confidence";
  if (score >= 0.45) return "Medium confidence";
  return "Low confidence";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface PendingLocation {
  lat: number;
  lng: number;
}

interface IncidentReportPanelProps {
  pendingLocation: PendingLocation | null;
  pickModeActive: boolean;
  onTogglePickMode: () => void;
  onLocationConsumed: () => void;
  // Called once the incident is real (backend has already applied it and returned real
  // ids) — the parent uses this to refresh every map layer immediately (rather than
  // waiting for the next poll), select the new incident so its panel opens, and remember
  // the specific category the user actually picked (the backend only classifies into its
  // own broader routing-relevant types, e.g. HAZARD_UPDATE, not "Flooding").
  onIncidentApplied: (incidentId: string, userTypeLabel: string) => void;
}

interface ReportSummary {
  appliedIncidentCount: number;
  ambulancesDispatched: number;
  rescueTeamsDispatched: number;
  // A real before/after diff of getRoutes() around the submission — how many zone->shelter
  // assignments actually changed, and how many people are on those changed routes. Not
  // returned by the backend directly, so this is computed here rather than invented.
  routesChanged: number;
  peopleRedirected: number;
  // The backend's own real explanation for why an event wasn't extracted/applied (e.g. no
  // resolvable location) — surfaced as-is when nothing was applied, instead of leaving a
  // bare "0 incidents applied" with no explanation. Already plain-language, not internal
  // parser/model jargon.
  notes: string[];
}

function composeReport(args: {
  type: string;
  location: string;
  severity: string;
  description: string;
  peopleAffected: string;
}): string {
  const parts: string[] = [];
  parts.push(`${args.severity} severity ${args.type.toLowerCase()}${args.location ? ` at ${args.location}` : ""}.`);
  if (args.description.trim()) parts.push(args.description.trim());
  if (args.peopleAffected.trim()) parts.push(`Approximately ${args.peopleAffected.trim()} people affected.`);
  return parts.join(" ");
}

export default function IncidentReportPanel({ pendingLocation, pickModeActive, onTogglePickMode, onLocationConsumed, onIncidentApplied }: IncidentReportPanelProps) {
  const [type, setType] = useState<(typeof INCIDENT_TYPES)[number]>("Road obstruction");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("Moderate");
  const [description, setDescription] = useState("");
  const [peopleAffected, setPeopleAffected] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStage, setImageStage] = useState<ImageStage>("idle");
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null);
  // Which fields the last image analysis actually populated — drives the small "Gemini
  // Analysis" badge per field; clears the moment the user edits that field themselves.
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  async function handleImageSelected(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Please upload a JPG, PNG, or WEBP image.");
      setImageStage("error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is too large (8 MB limit).");
      setImageStage("error");
      return;
    }

    setImageError(null);
    setImageAnalysis(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImagePreview(dataUrl);
      setImageStage("analyzing");

      const base64 = dataUrl.split(",")[1] ?? "";
      const result = await analyzeIncidentImage(base64, file.type, description);

      setImageAnalysis(result);
      setImageStage("done");

      const filled = new Set<string>();
      setType(IMAGE_TYPE_TO_FORM_TYPE[result.incident_type]);
      filled.add("type");
      if (result.severity) {
        setSeverity(IMAGE_SEVERITY_TO_FORM_SEVERITY[result.severity]);
        filled.add("severity");
      }
      if (result.description) {
        setDescription(result.description);
        filled.add("description");
      }
      // Location stays under the user's own control ("Pick on Map") — an affected road
      // Gemini actually read from the image is offered into the Location field only when
      // that field is still empty, never overriding an explicit selection.
      if (result.affected_road && location.trim().length === 0) {
        setLocation(result.affected_road);
        filled.add("location");
      }
      if (result.estimated_people_affected) {
        setPeopleAffected(String(result.estimated_people_affected));
        filled.add("peopleAffected");
      }
      setAiFilledFields(filled);
    } catch {
      // Never surface raw API errors — the user can still complete the report manually.
      setImageError("Image analysis is unavailable. You can complete the incident report manually.");
      setImageStage("error");
    }
  }

  function clearImage() {
    setImagePreview(null);
    setImageStage("idle");
    setImageError(null);
    setImageAnalysis(null);
    setAiFilledFields(new Set());
  }

  function markEdited(field: string) {
    setAiFilledFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  // A location picked on the map (either "Pick on Map" or a map right-click) lands here —
  // fills the Location field with real coordinates and brings this form into view so the
  // user immediately sees their click had an effect.
  useEffect(() => {
    if (!pendingLocation) return;
    setLocation(`${pendingLocation.lat.toFixed(5)}, ${pendingLocation.lng.toFixed(5)}`);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    onLocationConsumed();
  }, [pendingLocation, onLocationConsumed]);

  async function handleSubmit() {
    if (stage === "analyzing" || stage === "replanning" || location.trim().length === 0) return;
    const text = composeReport({ type, location, severity, description, peopleAffected });

    setStage("analyzing");
    setError(null);
    setSummary(null);

    // A real before snapshot of zone->shelter assignments, so the "routes changed" / "people
    // redirected" numbers shown after submit are an actual diff, never a guess.
    const before = await getRoutes().catch(() => [] as Awaited<ReturnType<typeof getRoutes>>);
    const beforeByZone = new Map(before.map((r) => [r.origin_zone_id, r]));

    const pending = submitIncidentReport(text);
    setTimeout(() => setStage((s) => (s === "analyzing" ? "replanning" : s)), ANALYZING_MS);

    try {
      const result = await pending;
      const after = await getRoutes().catch(() => [] as Awaited<ReturnType<typeof getRoutes>>);
      let routesChanged = 0;
      let peopleRedirected = 0;
      for (const route of after) {
        const previous = beforeByZone.get(route.origin_zone_id);
        if (!previous || previous.destination_shelter_id !== route.destination_shelter_id) {
          routesChanged += 1;
          peopleRedirected += route.people_count;
        }
      }

      setSummary({
        appliedIncidentCount: result.appliedIncidentCount,
        ambulancesDispatched: result.ambulancesDispatched,
        rescueTeamsDispatched: result.rescueTeamsDispatched,
        routesChanged,
        peopleRedirected,
        notes: result.notes,
      });
      setStage("done");
      // Only clear the form on genuine success — if nothing was applied, the user needs
      // their own entered values still visible to see what to adjust before retrying.
      if (result.newIncidentIds.length > 0) {
        setLocation("");
        setDescription("");
        setPeopleAffected("");
        clearImage();
        onIncidentApplied(result.newIncidentIds[0], type);
      }
    } catch {
      // Never surface the backend's own internal/parser wording (e.g. "Anthropic returned
      // malformed..."). The submission genuinely failed atomically (the backend applies
      // nothing on a rejected report), so this must not claim the incident was recorded.
      setError("Unable to submit this report right now. Please try again.");
      setStage("error");
    }
  }

  const busy = stage === "analyzing" || stage === "replanning";

  return (
    <div ref={panelRef}>
      <OverviewPanel title="Report Incident">
        <div className="incident-report-form">
          <label className="incident-report-field">
            <span className="incident-report-label">Upload Event Image (optional)</span>
            <div
              className="incident-report-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleImageSelected(file);
              }}
            >
              {imagePreview ? (
                <div className="incident-report-image-preview-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Uploaded incident" className="incident-report-image-preview" />
                  <button type="button" className="op-button incident-report-remove-image" onClick={clearImage} disabled={imageStage === "analyzing"}>
                    Remove
                  </button>
                </div>
              ) : (
                <label className="incident-report-dropzone-label">
                  <span>Drag an image here, or click to choose one</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="incident-report-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelected(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {imageStage === "analyzing" && <p className="incident-report-status">Analyzing image…</p>}
            {imageStage === "error" && imageError && <p className="incident-report-status incident-report-status-error">{imageError}</p>}
            {imageStage === "done" && imageAnalysis && (
              <p className="incident-report-status incident-report-image-done">
                Analysis complete — {confidenceLabel(imageAnalysis.confidence.incident_type)} on type
                {imageAnalysis.environmental_conditions.length > 0 ? ` · ${imageAnalysis.environmental_conditions.join(", ")}` : ""}
              </p>
            )}
          </label>

          <label className="incident-report-field">
            <span className="incident-report-label">
              Incident Type
              {aiFilledFields.has("type") && <span className="incident-report-ai-badge">Gemini Analysis</span>}
            </span>
            <select
              className="incident-report-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                markEdited("type");
              }}
              disabled={busy}
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="incident-report-field">
            <span className="incident-report-label">
              Location
              {aiFilledFields.has("location") && <span className="incident-report-ai-badge">Gemini Analysis</span>}
            </span>
            <div className="incident-report-location-row">
              <input
                type="text"
                className="incident-report-text-input"
                placeholder="e.g. Fourth Street, or Zone C"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  markEdited("location");
                }}
                disabled={busy}
              />
              <button
                type="button"
                className={`op-button incident-report-pick-button ${pickModeActive ? "incident-report-pick-button-active" : ""}`}
                onClick={onTogglePickMode}
                disabled={busy}
              >
                {pickModeActive ? "Click the map…" : "Pick on Map"}
              </button>
            </div>
          </label>

          <label className="incident-report-field">
            <span className="incident-report-label">
              Severity
              {aiFilledFields.has("severity") && <span className="incident-report-ai-badge">Gemini Analysis</span>}
            </span>
            <select
              className="incident-report-select"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as typeof severity);
                markEdited("severity");
              }}
              disabled={busy}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="incident-report-field">
            <span className="incident-report-label">
              Description
              {aiFilledFields.has("description") && <span className="incident-report-ai-badge">Gemini Analysis</span>}
            </span>
            <textarea
              className="incident-report-input"
              placeholder="What's happening?"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markEdited("description");
              }}
              disabled={busy}
              rows={2}
            />
          </label>

          <label className="incident-report-field">
            <span className="incident-report-label">
              Estimated People Affected (optional)
              {aiFilledFields.has("peopleAffected") && <span className="incident-report-ai-badge">Gemini Analysis</span>}
            </span>
            <input
              type="text"
              className="incident-report-text-input"
              placeholder="e.g. 12"
              value={peopleAffected}
              onChange={(e) => {
                setPeopleAffected(e.target.value);
                markEdited("peopleAffected");
              }}
              disabled={busy}
            />
          </label>

          <button
            type="button"
            className="op-button op-button-danger"
            onClick={handleSubmit}
            disabled={busy || location.trim().length === 0}
            title={location.trim().length === 0 ? "A location is required to identify what this incident affects" : undefined}
          >
            {busy ? "Submitting…" : "Report Incident"}
          </button>
          {!busy && location.trim().length === 0 && <p className="incident-report-hint">A location is required.</p>}
        </div>

        {stage === "analyzing" && <p className="incident-report-status">Analyzing incident…</p>}
        {stage === "replanning" && <p className="incident-report-status">Replanning transportation network…</p>}
        {stage === "error" && error && <p className="incident-report-status incident-report-status-error">{error}</p>}
        {stage === "done" && summary && summary.appliedIncidentCount === 0 && (
          <div className="incident-report-status incident-report-status-error">
            <div className="incident-report-status-title">No Incident Applied</div>
            {summary.notes.length > 0 ? summary.notes.map((note, i) => <div key={i}>{note}</div>) : <div>The report didn't contain enough detail to act on.</div>}
          </div>
        )}
        {stage === "done" && summary && summary.appliedIncidentCount > 0 && (
          <div className="incident-report-status incident-report-status-done">
            <div className="incident-report-status-title">Network Updated</div>
            <div>{summary.appliedIncidentCount} incident{summary.appliedIncidentCount === 1 ? "" : "s"} applied</div>
            {summary.routesChanged > 0 && (
              <div>{summary.routesChanged} evacuation route{summary.routesChanged === 1 ? "" : "s"} reassigned ({summary.peopleRedirected.toLocaleString()} people redirected)</div>
            )}
            <div>{summary.ambulancesDispatched} ambulance{summary.ambulancesDispatched === 1 ? "" : "s"} dispatched</div>
            <div>{summary.rescueTeamsDispatched} rescue team{summary.rescueTeamsDispatched === 1 ? "" : "s"} dispatched</div>
          </div>
        )}
      </OverviewPanel>
    </div>
  );
}
