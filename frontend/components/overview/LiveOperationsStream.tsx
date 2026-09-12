"use client";

// Compact bottom event stream — a running log of real, observed backend-state changes
// (see lib/useLiveEvents.ts). Not a fabricated activity feed: every row is a genuine diff
// between two consecutive polls of the same data-service getters the rest of the UI uses.
import type { OperationalEvent } from "@/lib/models";
import { formatClock } from "@/lib/useRelativeTime";
import { EVENT_KIND_SHAPE, shapeClassName } from "@/lib/entitySymbols";

// Nothing technical/system-status-flavored belongs here — when there's no real operational
// activity to show, the bar simply isn't rendered rather than filling the space with any
// placeholder copy.
export default function LiveOperationsStream({ events }: { events: OperationalEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="ops-stream">
      <div className="ops-stream-label">Live Operations</div>
      <div className="ops-stream-track">
        {events.slice(0, 12).map((event) => (
          <span key={event.id} className={`ops-stream-item ops-stream-item-${event.severity}`}>
            <span className="ops-stream-time">{formatClock(event.timestamp)}</span>
            <span className={shapeClassName(EVENT_KIND_SHAPE[event.kind])} aria-hidden="true" />
            {event.message}
          </span>
        ))}
      </div>
    </div>
  );
}
