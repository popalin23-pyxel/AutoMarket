import React, { useMemo } from 'react';
import { computeRangeSummary } from '../lib/calc.js';
import SiteAvatar from './SiteAvatar.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SiteCompareCard({ state, year, yearSelect }) {
  const yearRange = useMemo(
    () => computeRangeSummary(state.shifts, state.sites, state.settings, `${year}-01-01`, `${year}-12-31`),
    [state.shifts, state.sites, state.settings, year],
  );
  const avgHourly = yearRange.totalHours > 0 ? yearRange.totalInvoice / yearRange.totalHours : 0;
  const max = Math.max(0, ...yearRange.perSite.map((p) => p.total));

  return (
    <div className="panel">
      <h2 className="panel-title">Confronto sedi — {year}</h2>
      <p className="panel-desc">Dove guadagni di più, in un colpo d'occhio.</p>
      {yearSelect}
      {yearRange.perSite.length === 0 ? (
        <p className="panel-desc" style={{ marginBottom: 0 }}>Nessun turno registrato in questo anno.</p>
      ) : (
        <>
          <div className="site-compare-list">
            {yearRange.perSite.map((p) => (
              <div key={p.siteId ?? 'unknown'} className="site-compare-row">
                <SiteAvatar site={{ name: p.name, color: p.color }} size={26} />
                <div className="site-compare-info">
                  <div className="site-compare-name">{p.name}</div>
                  <div className="site-compare-sub">{fmt(p.hours)}h · €{fmt(p.rate)}/h{p.mixedRate ? ' (media)' : ''}</div>
                  <span className="site-bar-track" style={{ display: 'block', marginTop: 6 }}>
                    <span className="site-bar-fill" style={{ width: `${max > 0 ? Math.max(3, (p.total / max) * 100) : 0}%`, background: p.color }} />
                  </span>
                </div>
                <span className="site-compare-total">€{fmt(p.total)}</span>
              </div>
            ))}
          </div>
          <div className="fiscal-footnote" style={{ marginTop: 12 }}>
            Fatturato medio per ora (tutte le sedi): <b>€{fmt(avgHourly)}</b>
          </div>
        </>
      )}
    </div>
  );
}
