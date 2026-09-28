import React from 'react';
import { hexToRgba } from '../../lib/defaults.js';

// Grafico a barre compatto (andamento settimane/mesi).
export default function BarChart({ data, valueKey = 'value', labelKey = 'label', color = 'var(--accent)', height = 130, formatValue }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  return (
    <div className="barchart" style={{ height }}>
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const h = v > 0 ? Math.max(4, (v / max) * 100) : 0;
        const c = d.color || color;
        const gradient = c.startsWith('#') ? `linear-gradient(180deg, ${c}, ${hexToRgba(c, 0.55)})` : c;
        return (
          <div key={i} className="barchart-col">
            <div className="barchart-val">{v > 0 ? (formatValue ? formatValue(v) : v) : ''}</div>
            <div className="barchart-bar" style={{ height: `${h}%`, background: gradient, animationDelay: `${i * 35}ms` }} />
            <div className="barchart-lbl">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}
