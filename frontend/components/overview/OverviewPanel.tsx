import type { ReactNode } from "react";

interface OverviewPanelProps {
  title: string;
  count?: number;
  subtitle?: string;
  children: ReactNode;
}

export default function OverviewPanel({ title, count, subtitle, children }: OverviewPanelProps) {
  return (
    <section className="ov-panel">
      <header className="ov-panel-header">
        <h2>{title}</h2>
        <span className="ov-panel-header-right">
          {subtitle && <span className="ov-panel-subtitle">{subtitle}</span>}
          {count !== undefined && <span className="ov-panel-count">{count}</span>}
        </span>
      </header>
      <div className="ov-panel-body">{children}</div>
    </section>
  );
}
