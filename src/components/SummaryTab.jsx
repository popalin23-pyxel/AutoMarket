import React, { useMemo } from 'react';
import { computeMonthSummary } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import { exportMonthExcel } from '../lib/excel.js';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SummaryTab({ state, year, month, setYear, setMonth }) {
  const sum = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, year, month),
    [state.shifts, state.sites, state.settings, year, month],
  );

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };

  return (
    <>
      <div className="panel">
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>

        {sum.shiftCount === 0 ? (
          <p className="hint hint-info">Nessun turno registrato questo mese.</p>
        ) : (
          <button className="btn" onClick={() => exportMonthExcel(sum)}>⬇ Esporta Excel</button>
        )}
      </div>

      {sum.perSite.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Per sede</h2>
          <div className="site-summary-list">
            {sum.perSite.map((p) => (
              <div key={p.siteId ?? 'unknown'} className="site-summary-card" style={{ borderColor: p.color + '33' }}>
                <div className="ssc-head">
                  <span className="site-badge" style={{ background: p.color + '22', color: p.color }}>
                    <span className="site-dot" style={{ background: p.color }} />{p.name}
                  </span>
                  <span className="ssc-total mono">€{fmt(p.total)}</span>
                </div>
                <div className="ssc-grid">
                  <div><span className="ssc-lbl">Ore</span><span className="mono">{fmt(p.hours)}</span></div>
                  <div><span className="ssc-lbl">€/h</span><span className="mono">{fmt(p.rate)}</span></div>
                  <div><span className="ssc-lbl">Fatturato</span><span className="mono">€{fmt(p.revenue)}</span></div>
                  <div><span className="ssc-lbl">Rivalsa {p.rivalsaPercent}%</span><span className="mono">€{fmt(p.rivalsa)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h2 className="panel-title">Riepilogo</h2>
        <div className="stats-row">
          <div className="stat"><div className="stat-label">Ore totali</div><div className="stat-value">{fmt(sum.totalHours)}</div></div>
          <div className="stat"><div className="stat-label">Fatturato</div><div className="stat-value">€{fmt(sum.totalInvoice)}</div></div>
          <div className="stat"><div className="stat-label">Netto stimato</div><div className="stat-value gold">€{fmt(sum.net)}</div></div>
        </div>

        <div className="summary-flow">
          <div className="flow-row"><span className="flow-label">Compensi (ore × paga)</span><span className="flow-value">€{fmt(sum.totalRevenue)}</span></div>
          <div className="flow-row"><span className="flow-label">Rivalsa</span><span className="flow-value">€{fmt(sum.totalRivalsa)}</span></div>
          <div className="flow-row total"><span className="flow-label">Totale fatturato</span><span className="flow-value">€{fmt(sum.totalInvoice)}</span></div>
          <div className="flow-row taxes"><span className="flow-label">Tasse da accantonare ({sum.taxPercent}%)</span><span className="flow-value red">−€{fmt(sum.taxes)}</span></div>
          <div className="flow-row net"><span className="flow-label">Ti resta (netto)</span><span className="flow-value green">€{fmt(sum.net)}</span></div>
        </div>
      </div>
    </>
  );
}
