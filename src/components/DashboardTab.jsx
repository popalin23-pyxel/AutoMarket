import React, { useMemo } from 'react';
import {
  compareWeeks, compareMonths, compareYears,
  lastNWeeksSummaries, lastNMonthsSummaries, todayISO,
} from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import BarChart from './charts/BarChart.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

function DeltaBadge({ pct }) {
  if (pct == null) return <span className="delta-badge neutral">nuovo</span>;
  if (pct === 0) return <span className="delta-badge neutral">= 0%</span>;
  const up = pct > 0;
  return <span className={`delta-badge ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

export default function DashboardTab({ state }) {
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));

  const week = useMemo(() => compareWeeks(state.shifts, state.sites, state.settings, today),
    [state.shifts, state.sites, state.settings, today]);
  const month = useMemo(() => compareMonths(state.shifts, state.sites, state.settings, y, m),
    [state.shifts, state.sites, state.settings, y, m]);
  const year = useMemo(() => compareYears(state.shifts, state.sites, state.settings, y),
    [state.shifts, state.sites, state.settings, y]);
  const weeksTrend = useMemo(() => lastNWeeksSummaries(state.shifts, state.sites, state.settings, 8, today),
    [state.shifts, state.sites, state.settings, today]);
  const monthsTrend = useMemo(() => lastNMonthsSummaries(state.shifts, state.sites, state.settings, 6, y, m),
    [state.shifts, state.sites, state.settings, y, m]);

  const hasAnyData = state.shifts.length > 0;

  return (
    <>
      <div className="panel hero-week">
        <div className="hero-week-label">Questa settimana</div>
        {!hasAnyData ? (
          <p className="hint hint-info" style={{ marginBottom: 0 }}>Registra qualche turno per iniziare a vedere le statistiche.</p>
        ) : (
          <>
            <div className="hero-week-row">
              <div className="hero-stat">
                <span className="hero-num">{fmt0(week.current.totalHours)}<span className="hero-unit">h</span></span>
                <span className="hero-caption">ore lavorate</span>
              </div>
              <div className="hero-stat">
                <span className="hero-num gold">€{fmt(week.current.net)}</span>
                <span className="hero-caption">netto stimato</span>
              </div>
            </div>
            <div className="hero-deltas">
              <span>vs settimana scorsa (ore) <DeltaBadge pct={week.deltaHoursPct} /></span>
              <span>vs settimana scorsa (netto) <DeltaBadge pct={week.deltaNetPct} /></span>
            </div>
          </>
        )}
      </div>

      {hasAnyData && (
        <>
          <div className="panel">
            <h2 className="panel-title">Ultime 8 settimane</h2>
            <p className="panel-desc">Netto per settimana</p>
            <BarChart data={weeksTrend} valueKey="net" labelKey="label" color="var(--gold)"
              formatValue={(v) => `${Math.round(v)}`} height={140} />
          </div>

          <div className="panel">
            <h2 className="panel-title">Confronti</h2>
            <div className="compare-grid">
              <div className="compare-card">
                <div className="compare-title">{MONTHS_IT[m - 1]} vs {MONTHS_IT[month.previous.month - 1]}</div>
                <div className="compare-nums">€{fmt(month.current.net)} <span className="vs">vs</span> €{fmt(month.previous.net)}</div>
                <DeltaBadge pct={month.deltaNetPct} />
              </div>
              <div className="compare-card">
                <div className="compare-title">{y} vs {y - 1}</div>
                <div className="compare-nums">€{fmt(year.current.totalNet)} <span className="vs">vs</span> €{fmt(year.previous.totalNet)}</div>
                <DeltaBadge pct={year.deltaNetPct} />
              </div>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">Ultimi 6 mesi</h2>
            <p className="panel-desc">Ore lavorate per mese</p>
            <BarChart data={monthsTrend} valueKey="totalHours" labelKey="label" color="var(--accent)"
              formatValue={(v) => `${Math.round(v)}`} height={140} />
          </div>
        </>
      )}
    </>
  );
}
