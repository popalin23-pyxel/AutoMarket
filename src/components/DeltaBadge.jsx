import React from 'react';

export default function DeltaBadge({ pct }) {
  if (pct == null) return <span className="delta-badge neutral">nuovo</span>;
  if (pct === 0) return <span className="delta-badge neutral">= 0%</span>;
  const up = pct > 0;
  const value = Math.abs(pct).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 1 });
  return <span className={`delta-badge ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {value}%</span>;
}
