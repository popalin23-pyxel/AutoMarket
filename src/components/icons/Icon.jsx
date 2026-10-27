// Set minimale di icone SVG "line" (stile Feather), per sostituire le emoji
// nella navigazione e avere un look coerente su tutti i dispositivi.
import React from 'react';

const PATHS = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M16 3v4M8 3v4M3.5 10h17" />
    </>
  ),
  euro: (
    <>
      <path d="M17.5 7.2A6.5 6.5 0 1 0 17.5 17" />
      <path d="M4 10.2h9.5M4 14h8" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21.5S5.5 14.9 5.5 10a6.5 6.5 0 1 1 13 0c0 4.9-6.5 11.5-6.5 11.5Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3.2 3.5v5h5" />
      <path d="M12 7.5V12l3.2 2.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.8a1.9 1.9 0 0 0 .38 2.1l.07.07a2.2 2.2 0 1 1-3.1 3.1l-.07-.06a1.9 1.9 0 0 0-2.1-.38 1.9 1.9 0 0 0-1.15 1.74V21.7a2.2 2.2 0 1 1-4.4 0v-.1a1.9 1.9 0 0 0-1.2-1.76 1.9 1.9 0 0 0-2.1.38l-.07.06a2.2 2.2 0 1 1-3.1-3.1l.06-.07a1.9 1.9 0 0 0 .38-2.1 1.9 1.9 0 0 0-1.74-1.15H2.3a2.2 2.2 0 1 1 0-4.4h.1A1.9 1.9 0 0 0 4.16 8.1a1.9 1.9 0 0 0-.38-2.1l-.06-.07a2.2 2.2 0 1 1 3.1-3.1l.07.06a1.9 1.9 0 0 0 2.1.38H9a1.9 1.9 0 0 0 1.15-1.74V1.3a2.2 2.2 0 1 1 4.4 0v.1A1.9 1.9 0 0 0 15.9 3.15a1.9 1.9 0 0 0 2.1-.38l.07-.06a2.2 2.2 0 1 1 3.1 3.1l-.06.07a1.9 1.9 0 0 0-.38 2.1V9a1.9 1.9 0 0 0 1.74 1.15h.1a2.2 2.2 0 1 1 0 4.4h-.1a1.9 1.9 0 0 0-1.76 1.2Z" />
    </>
  ),
  zap: <path d="M13.2 2 4 14.3h7.2l-1 7.7L20 9.4h-7.3l.5-7.4Z" />,
  wave: <path d="M4 13c2.5 3 6.5 4.5 8 4.5 4 0 8-3 8-9.5" />,
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path d="M8.5 11h7M8.5 15h5" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3a5 5 0 0 0-5 5v3.3c0 .78-.32 1.53-.88 2.08L4.8 15.7h14.4l-1.32-1.32a2.9 2.9 0 0 1-.88-2.08V8a5 5 0 0 0-5-5Z" />
      <path d="M9.5 18.7a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.3 2.4 2.4 5-5.4" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5v3.2c0 2 1.6 3.4 3.2 4.3.5.3.5 1 0 1.3-1.6.9-3.2 2.3-3.2 4.3v3.4M16.5 3.5v3.2c0 2-1.6 3.4-3.2 4.3-.5.3-.5 1 0 1.3 1.6.9 3.2 2.3 3.2 4.3v3.4" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 3.5v16a1 1 0 0 0 1 1h16" />
      <path d="m7.5 15 3.5-4.5 3 2.5 5-6.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.2" />
      <path d="M8.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  // ── icone della nuova interfaccia (Oggi · Turni · Soldi · Altro) ──
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  building: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 10h2a2 2 0 0 1 2 2v9M2.5 21h19M10 7v4M8 9h4M8 15h4" />
    </>
  ),
  taxes: (
    <>
      <path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L10 21l-2.5-1.7L5 21z" />
      <path d="M15 8.5l-6 6" />
      <circle cx="9.5" cy="9" r="1.2" />
      <circle cx="14.5" cy="14" r="1.2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  stamp: (
    <>
      <path d="M5 22h14" />
      <path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z" />
      <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3c-1.66 0-3 1-3 3s1 2 1 3.5V13" />
    </>
  ),
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-.9 1.6-2-.4-1.4.4-2.6 1.9-2.6h1.8a3.2 3.2 0 0 0 3.2-3.2c0-5-3.8-9.2-8.5-9.2Z" />
      <circle cx="7.8" cy="11" r="1.1" />
      <circle cx="10.5" cy="7.3" r="1.1" />
      <circle cx="15" cy="7.8" r="1.1" />
    </>
  ),
  shield: <path d="M12 3l7.5 3v5.5c0 4.8-3.2 8-7.5 9.5-4.3-1.5-7.5-4.7-7.5-9.5V6L12 3Z" />,
  cloud: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 9H7Z" />
      <path d="M12 15.5v-5M9.8 12.6 12 10.4l2.2 2.2" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M12 7.5v6M9.6 11.3 12 13.7l2.4-2.4M10.5 18.5h3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
      <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2.4-1.6L13.2 21 12 20l-1.2 1-2.4-1.6L6 21V3Z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </>
  ),
  calc: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.2" />
      <path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
    </>
  ),
  download: (
    <>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M12 11.5v6M9.5 15l2.5 2.5 2.5-2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  umbrella: (
    <>
      <path d="M12 3.5a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" />
      <path d="M12 12.5v6a2 2 0 0 0 4 0" />
    </>
  ),
  sunset: (
    <>
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  trend: (
    <>
      <path d="M3.5 16.5l5.5-5.5 4 4 7.5-7.5" />
      <path d="M15 7.5h5.5V13" />
    </>
  ),
  idcard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16.2c.6-1.6 1.8-2.3 3.2-2.3s2.6.7 3.2 2.3M14.5 10h3.5M14.5 13.5h3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V7" />
      <path d="M6 7l.9 12.2A2 2 0 0 0 8.9 21h6.2a2 2 0 0 0 2-1.8L18 7M10 11v6M14 11v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.6-2.5h6.8L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className, style }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      {path}
    </svg>
  );
}
