import React from 'react';

// Anello a più segmenti (es. Tasse vs Netto) con valore al centro.
export default function RingChart({ segments, size = 132, thickness = 16, centerValue, centerLabel }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const frac = Math.max(0, s.value) / total;
        const dash = frac * c;
        const circle = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.7s ease, stroke-dashoffset 0.7s ease' }} />
        );
        offset += dash;
        return circle;
      })}
      {centerValue != null && (
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'var(--text)', fontSize: 19, fontWeight: 800, fontFamily: 'var(--mono)' }}>
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'var(--text-mut)', fontSize: 10 }}>
          {centerLabel}
        </text>
      )}
    </svg>
  );
}
