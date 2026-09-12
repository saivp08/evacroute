"use client";

export type NavKey = "overview" | "incidents" | "fleet" | "evacuation" | "shelters" | "hazards" | "intelligence";

interface NavItem {
  key: NavKey;
  label: string;
  glyph: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", glyph: "◈" },
  { key: "incidents", label: "Incidents", glyph: "▲" },
  { key: "fleet", label: "Fleet", glyph: "▣" },
  { key: "evacuation", label: "Evacuation", glyph: "➜" },
  { key: "shelters", label: "Shelters", glyph: "⌂" },
  { key: "hazards", label: "Hazards", glyph: "⬡" },
  { key: "intelligence", label: "Intelligence", glyph: "◎" },
];

interface SidebarProps {
  active: NavKey;
  onSelect: (key: NavKey) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ active, onSelect, open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <nav className={`app-sidebar ${open ? "app-sidebar-open" : ""}`} aria-label="Primary">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">EV</span>
          <div>
            <div className="sidebar-brand-name">EvacRoute</div>
            <div className="sidebar-brand-tag">Operations Center</div>
          </div>
        </div>
        <ul className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`sidebar-nav-item ${active === item.key ? "sidebar-nav-item-active" : ""}`}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
              >
                <span className="sidebar-nav-glyph" aria-hidden="true">{item.glyph}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
