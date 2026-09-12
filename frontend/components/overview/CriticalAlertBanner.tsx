"use client";

// Prominent, interrupting alert for a real critical/high-severity event (a new incident or
// road closure — see lib/useLiveEvents.ts). Content is entirely the event's own real
// fields; nothing here is invented copy.
import type { OperationalEvent } from "@/lib/models";
import { formatClock } from "@/lib/useRelativeTime";

interface CriticalAlertBannerProps {
  event: OperationalEvent;
  onViewOnMap: () => void;
  onDismiss: () => void;
}

export default function CriticalAlertBanner({ event, onViewOnMap, onDismiss }: CriticalAlertBannerProps) {
  return (
    <div className="critical-alert" role="alert">
      <div className="critical-alert-icon" aria-hidden="true">
        ●
      </div>
      <div className="critical-alert-body">
        <div className="critical-alert-title">Critical Transport Alert</div>
        <div className="critical-alert-message">{event.message}</div>
        {event.detail && <div className="critical-alert-detail">{event.detail}</div>}
        <div className="critical-alert-time">{formatClock(event.timestamp)}</div>
      </div>
      <div className="critical-alert-actions">
        {event.entityId && (
          <button type="button" className="op-button op-button-danger" onClick={onViewOnMap}>
            View on Map
          </button>
        )}
        <button type="button" className="critical-alert-dismiss" onClick={onDismiss} aria-label="Dismiss alert">
          ✕
        </button>
      </div>
    </div>
  );
}
