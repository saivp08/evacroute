"use client";

import { useEffect, useState } from "react";

interface StatusBarProps {
  sectionLabel: string;
  onMenuClick: () => void;
}

export default function StatusBar({ sectionLabel, onMenuClick }: StatusBarProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="app-status-bar">
      <div className="status-bar-left">
        <button type="button" className="sidebar-toggle" onClick={onMenuClick} aria-label="Toggle navigation">
          ☰
        </button>
        <span className="status-bar-section">{sectionLabel}</span>
      </div>
      <div className="status-bar-right">
        <span className="status-pill status-pill-ok">
          <span className="status-dot" aria-hidden="true" />
          System Operational
        </span>
        <span className="status-bar-time">{now ? now.toLocaleTimeString() : "--:--:--"}</span>
      </div>
    </header>
  );
}
