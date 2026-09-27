import React from 'react';

// Grafico a barre compatto (andamento settimane/mesi).
export default function BarChart({ data, valueKey = 'value', labelKey = 'label', color = 'var(--accent)', height = 130, formatValue }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  return (
    <div className="barchart" style={{ height }}>
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const h = v > 0 ? Math.max(4, (v / max) * 100) : 0;
        return (
          <div key={i} className="barchart-col">
            <div className="barchart-val">{v > 0 ? (formatValue ? formatValue(v) : v) : ''}</div>
            <div className="barchart-bar" style={{ height: `${h}%`, background: d.color || color }} />
            <div className="barchart-lbl">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}
