// Real vector map-symbol icons (not emoji, not letter badges) for every entity type the map
// renders. Each is a small inline SVG so no icon font/sprite asset pipeline is needed —
// color and size are just props, driven by the entity's real backend status/severity.
import type { CSSProperties } from "react";

export interface MapIconProps {
  size: number;
  color: string;
  className?: string;
  style?: CSSProperties;
}

function Svg({ size, className, style, children }: MapIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Ambulance: boxy van silhouette with a cross window and wheels — reads instantly at small
// sizes, distinct from every other vehicle type.
export function AmbulanceIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="8" width="15" height="8" rx="1.2" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <path d="M17 10h3l2 2.5V16h-5z" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <rect x="6" y="10.2" width="4.4" height="3.6" rx="0.4" fill="#fff" />
      <path d="M7.6 10.9v2.2M6.5 12h2.2" stroke={props.color} strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="7" cy="17" r="1.6" fill="#1a1a1a" />
      <circle cx="18" cy="17" r="1.6" fill="#1a1a1a" />
    </Svg>
  );
}

// Fire engine: longer body, ladder line, red-forward silhouette.
export function FireEngineIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="9" width="17" height="7" rx="1" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <path d="M18.5 10.5h2.7l1.3 2v2.5h-4z" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <rect x="1.5" y="9" width="17" height="1.6" fill="#fff" opacity="0.85" />
      <rect x="4.5" y="11.2" width="3" height="2.4" rx="0.3" fill="#fff" />
      <rect x="9" y="11.2" width="3" height="2.4" rx="0.3" fill="#fff" />
      <circle cx="6" cy="17" r="1.6" fill="#1a1a1a" />
      <circle cx="19.5" cy="17" r="1.6" fill="#1a1a1a" />
    </Svg>
  );
}

// Police vehicle: sedan silhouette with a light-bar accent.
export function PoliceIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <path d="M3 13.5 5 9.5h13l2 4v3.5H3z" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <path d="M6.5 9.5 8 6.8h7l1.5 2.7z" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <rect x="8.3" y="7.3" width="6.4" height="2" rx="0.3" fill="#fff" opacity="0.85" />
      <rect x="9.5" y="10.4" width="4.6" height="1.4" rx="0.3" fill="#fff" />
      <circle cx="6.5" cy="17" r="1.6" fill="#1a1a1a" />
      <circle cx="17" cy="17" r="1.6" fill="#1a1a1a" />
    </Svg>
  );
}

// Rescue/technical team: a compact 4x4-style utility vehicle silhouette, distinct from the
// sedan/van/truck shapes above.
export function RescueIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12.5 5 8.5h12l2.5 4v4h-16z" fill={props.color} stroke="#fff" strokeWidth="0.6" />
      <rect x="6.5" y="9.4" width="9" height="2.6" rx="0.3" fill="#fff" opacity="0.85" />
      <path d="M11 8.5v2.6M6.5 10.7h9" stroke={props.color} strokeWidth="0.6" />
      <circle cx="7" cy="16.5" r="1.7" fill="#1a1a1a" />
      <circle cx="17" cy="16.5" r="1.7" fill="#1a1a1a" />
    </Svg>
  );
}

// Shelter: a simple house/roof silhouette.
export function ShelterIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 21 10.5V21H3V10.5z" fill={props.color} stroke="#fff" strokeWidth="0.7" />
      <rect x="9.5" y="14" width="5" height="7" fill="#fff" />
      <path d="M2 11.5 12 3l10 8.5" fill="none" stroke={props.color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

// Hospital: rounded square with a medical cross — distinct from the shelter's roof shape.
export function HospitalIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" fill={props.color} stroke="#fff" strokeWidth="0.8" />
      <path d="M12 6.5v11M6.5 12h11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </Svg>
  );
}

// Incident: alert triangle — the universal "something is happening here" symbol.
export function IncidentIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5 22.5 21H1.5z" fill={props.color} stroke="#fff" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="11" y="9" width="2" height="6.2" rx="1" fill="#fff" />
      <circle cx="12" cy="17.5" r="1.15" fill="#fff" />
    </Svg>
  );
}

// Road closure: a barrier/no-entry glyph, distinct from the incident triangle.
export function ClosureIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" fill={props.color} stroke="#fff" strokeWidth="1" />
      <rect x="5" y="10.7" width="14" height="2.6" rx="1" fill="#fff" transform="rotate(-38 12 12)" />
    </Svg>
  );
}

// Hazard: flame glyph — used for the (currently backend-empty) hazards layer, so it reads
// distinctly from an "incident" the moment real hazard data exists.
export function HazardIcon(props: MapIconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.5c1 3 3.5 4 3.5 7.3a3.5 3.5 0 1 1-7 0c0-1 .4-1.8 1-2.4-.1 1 .4 1.6 1 1.6.9 0 .9-1 .7-1.8C10.7 5.8 11.3 4 12 2.5Z"
        fill={props.color}
        stroke="#fff"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
