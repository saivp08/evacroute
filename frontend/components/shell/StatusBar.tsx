"use client";

// No technical connectivity/system-status language belongs in the visible product — this
// bar is brand + the operational clock only. (Health monitoring for the map/data itself
// still happens where it matters: layers simply show whatever the backend last reported.)
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";

export default function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="app-status-bar">
      <div className="status-bar-left">
        <div className="status-bar-brand">
          <span className="status-bar-brand-mark" aria-label="EvacRoute">
            {/* The road-logo motif only (crossroad + winding route + pin), no wordmark —
                same square footprint the plain "EV" mark used to occupy. */}
            <svg viewBox="0 0 48 48" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M20 4v12M20 32v12M28 4v8M28 36v8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M4 20h10M34 20h10M4 28h8M36 28h8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path
                d="M18 12c0 8 12 8 12 16s-12 8-12 16"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M13.5 40.5 20 44l-1.2-7.2Z" fill="currentColor" />
              <path d="M34.5 7.5 28 4l1.2 7.2Z" fill="currentColor" />
              <circle cx="24" cy="24" r="4.4" fill="currentColor" />
            </svg>
          </span>
          <div>
            <div className="status-bar-brand-name">EvacRoute</div>
            <div className="status-bar-brand-tag">Operations Center</div>
          </div>
        </div>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-time">{now ? now.toLocaleTimeString() : "--:--:--"}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
