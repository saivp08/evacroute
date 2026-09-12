import type { IntelConfidence, IntelReport } from "@/lib/models";
import { useNow, formatRelativeTime } from "@/lib/useRelativeTime";
import OverviewPanel from "./OverviewPanel";

const CONFIDENCE_DOT: Record<IntelConfidence, string> = {
  high: "dot-response",
  medium: "dot-caution",
  low: "dot-inactive",
};

export default function FieldIntelligencePanel({ reports }: { reports: IntelReport[] }) {
  const now = useNow();
  return (
    <OverviewPanel title="Field Intelligence" count={reports.length}>
      <ul className="ov-list">
        {reports.map((report) => (
          <li key={report.id} className="ov-row">
            <span className={`ov-dot ${CONFIDENCE_DOT[report.confidence]}`} aria-hidden="true" />
            <div className="ov-row-main">
              <div className="ov-row-title">
                {report.source}
                <span className="ov-row-tag">{report.confidence} confidence</span>
              </div>
              <div className="ov-row-sub">{report.summary}</div>
              <div className="ov-row-sub" style={{ opacity: 0.7 }}>
                {formatRelativeTime(report.reported_at, now)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
