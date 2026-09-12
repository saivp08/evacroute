"use client";

// Compact bottom event stream — a running log of real, observed backend-state changes
// (see lib/useLiveEvents.ts). Not a fabricated activity feed: every row is a genuine diff
// between two consecutive polls of the same data-service getters the rest of the UI uses.
import type { OperationalEvent } from "@/lib/models";
import { formatClock } from "@/lib/useRelativeTime";

const KIND_GLYPH: Record<OperationalEvent["kind"], string> = {
  incident: "▲",
  closure: "⛔",
  shelter: "⌂",
  vehicle: "▣",
};

export default function LiveOperationsStream({ events }: { events: OperationalEvent[] }) {
  return (
    <div className="ops-stream">
      <div className="ops-stream-label">Live Operations</div>
      <div className="ops-stream-track">
        {events.length === 0 ? (
          <span className="ops-stream-empty">Monitoring backend for changes…</span>
        ) : (
          events.slice(0, 12).map((event) => (
            <span key={event.id} className={`ops-stream-item ops-stream-item-${event.severity}`}>
              <span className="ops-stream-time">{formatClock(event.timestamp)}</span>
              <span aria-hidden="true">{KIND_GLYPH[event.kind]}</span>
              {event.message}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
