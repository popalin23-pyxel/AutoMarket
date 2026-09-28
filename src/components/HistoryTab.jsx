import React, { useMemo, useState } from 'react';
import { computeYearSummary, monthsWithData } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import BarChart from './charts/BarChart.jsx';
import YearHeatmap from './charts/YearHeatmap.jsx';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HistoryTab({ state, onOpenMonth }) {
  const years = useMemo(() => {
    const set = new Set(monthsWithData(state.shifts).map((m) => m.year));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [state.shifts]);

  const [year, setYear] = useState(years[0]);
  const y = useMemo(
    () => computeYearSummary(state.shifts, state.sites, state.settings, year),
    [state.shifts, state.sites, state.settings, year],
  );

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Storico</h2>
        <div className="hist-year-nav">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>

        {y.months.length === 0 ? (
          <EmptyState icon="history" title="Nessun turno in questo anno" hint="Cambia anno oppure registra il tuo primo turno." />
        ) : (
          <div className="stats-row">
            <div className="stat"><div className="stat-label">Ore anno</div><div className="stat-value">{fmt(y.totalHours)}</div></div>
            <div className="stat"><div className="stat-label">Fatturato anno</div><div className="stat-value">€{fmt(y.totalInvoice)}</div></div>
            <div className="stat"><div className="stat-label">Tasse accantonate</div><div className="stat-value">€{fmt(y.totalTaxes)}</div></div>
            <div className="stat"><div className="stat-label">Netto anno</div><div className="stat-value gold">€{fmt(y.totalNet)}</div></div>
          </div>
        )}
      </div>

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Mappa dell'anno</h2>
          <p className="panel-desc">Ogni quadratino è un giorno: più scuro = più ore lavorate</p>
          <YearHeatmap year={year} shifts={state.shifts} color="#38bdf8" />
        </div>
      )}

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Andamento {year}</h2>
          <p className="panel-desc">Netto per mese</p>
          <BarChart
            data={y.months.map((m) => ({ label: MONTHS_IT[m.month - 1].slice(0, 3), net: m.net }))}
            valueKey="net" labelKey="label" color="var(--gold)" formatValue={(v) => `${Math.round(v)}`} height={130} />
        </div>
      )}

      {y.months.length > 0 && (
        <div className="panel">
          {[...y.months].reverse().map((m) => (
            <div key={m.month} className="hist-month-row" onClick={() => onOpenMonth(m.year, m.month)}>
              <span className="hist-month-name">{MONTHS_IT[m.month - 1]}</span>
              <div className="hist-month-stats">
                <span>{fmt(m.totalHours)}h</span>
                <span>€{fmt(m.totalInvoice)}</span>
                <span className="gold">€{fmt(m.net)} netto</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
