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
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {path}
    </svg>
  );
}
