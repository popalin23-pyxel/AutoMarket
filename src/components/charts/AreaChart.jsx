import React, { useId } from 'react';

// Grafico ad area con linea morbida, per gli andamenti (settimane/mesi/anni).
export default function AreaChart({ data, valueKey = 'value', labelKey = 'label', color = 'var(--accent)', height = 140 }) {
  const gradId = useId();
  const values = data.map((d) => d[valueKey] || 0);
  const max = Math.max(1, ...values);
  const n = data.length;
  const stepX = n > 1 ? 100 / (n - 1) : 0;

  const points = values.map((v, i) => {
    const x = n > 1 ? i * stepX : 50;
    const y = 96 - (v / max) * 84;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1][0].toFixed(2)},100 L${points[0][0].toFixed(2)},100 Z`
    : '';

  const svgHeight = Math.max(40, height - 22); // spazio riservato alle etichette sotto

  return (
    <div className="areachart" style={{ color }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height={svgHeight} className="areachart-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 0 && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
        {points.length > 1 && (
          <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.2"
            vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.8" fill="currentColor" vectorEffect="non-scaling-stroke">
            <title>{data[i][labelKey]}: {values[i]}</title>
          </circle>
        ))}
      </svg>
      <div className="areachart-labels">
        {data.map((d, i) => <span key={i}>{d[labelKey]}</span>)}
      </div>
    </div>
  );
}
