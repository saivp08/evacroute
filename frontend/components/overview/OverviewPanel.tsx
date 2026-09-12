import type { ReactNode } from "react";

interface OverviewPanelProps {
  title: string;
  count?: number;
  children: ReactNode;
}

export default function OverviewPanel({ title, count, children }: OverviewPanelProps) {
  return (
    <section className="ov-panel">
      <header className="ov-panel-header">
        <h2>{title}</h2>
        {count !== undefined && <span className="ov-panel-count">{count}</span>}
      </header>
      <div className="ov-panel-body">{children}</div>
    </section>
  );
}
