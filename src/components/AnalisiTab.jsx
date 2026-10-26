import React, { useMemo, useState } from 'react';
import {
  compareWeeks, compareMonths, compareYears, lastNWeeksSummaries, lastNMonthsSummaries,
  monthsWithData, todayISO,
} from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import AreaChart from './charts/AreaChart.jsx';
import EmptyState from './EmptyState.jsx';
import DeltaBadge from './DeltaBadge.jsx';
import HistoryTab from './HistoryTab.jsx';
import SiteCompareCard from './SiteCompareCard.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => n.toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 1 });

const SUB_TABS = [
  { id: 'trend', label: 'Andamento' },
  { id: 'compare', label: 'Confronti' },
  { id: 'year', label: 'Anno' },
];

function TrendPanel({ state }) {
  const [period, setPeriod] = useState('weeks');
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const data = useMemo(() => (period === 'weeks'
    ? lastNWeeksSummaries(state.shifts, state.sites, state.settings, 8, today, state.occasionalWork)
    : lastNMonthsSummaries(state.shifts, state.sites, state.settings, 12, y, m, state.occasionalWork)),
  [period, state.shifts, state.sites, state.settings, state.occasionalWork, today, y, m]);
  const unit = period === 'weeks' ? 'settimana' : 'mese';

  return (
    <>
      <div className="theme-switch" style={{ marginBottom: 14 }}>
        <button className={`theme-opt ${period === 'weeks' ? 'active' : ''}`} onClick={() => setPeriod('weeks')}>Ultime 8 settimane</button>
        <button className={`theme-opt ${period === 'months' ? 'active' : ''}`} onClick={() => setPeriod('months')}>Ultimi 12 mesi</button>
      </div>
      <div className="panel">
        <h2 className="panel-title">Netto</h2>
        <p className="panel-desc">Netto stimato per {unit} (sedi + prestazioni occasionali)</p>
        <AreaChart data={data} valueKey="netTotal" labelKey="label" color="var(--gold)" height={150} />
      </div>
      <div className="panel">
        <h2 className="panel-title">Ore lavorate</h2>
        <p className="panel-desc">Ore di turno per {unit}</p>
        <AreaChart data={data} valueKey="totalHours" labelKey="label" color="var(--accent)" height={150} />
      </div>
    </>
  );
}

function CompareCard({ title, cur, prev, delta, hoursCur, hoursPrev }) {
  return (
    <div className="compare-card">
      <div className="compare-title">{title}</div>
      <div className="compare-nums">€{fmt(cur)} <span className="vs">vs</span> €{fmt(prev)}</div>
      <DeltaBadge pct={delta} />
      {hoursCur != null && <div className="compare-sub">{fmt0(hoursCur)}h vs {fmt0(hoursPrev)}h</div>}
    </div>
  );
}

function ComparePanel({ state, year, yearSelect }) {
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const week = useMemo(() => compareWeeks(state.shifts, state.sites, state.settings, today, state.occasionalWork),
    [state.shifts, state.sites, state.settings, today, state.occasionalWork]);
  const month = useMemo(() => compareMonths(state.shifts, state.sites, state.settings, y, m, state.occasionalWork),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork]);
  const yearCmp = useMemo(() => compareYears(state.shifts, state.sites, state.settings, y, state.occasionalWork),
    [state.shifts, state.sites, state.settings, y, state.occasionalWork]);

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Periodo su periodo</h2>
        <p className="panel-desc">Netto stimato rispetto al periodo precedente.</p>
        <div className="compare-grid">
          <CompareCard title="Questa settimana vs scorsa" cur={week.current.netTotal} prev={week.previous.netTotal}
            delta={week.deltaNetPct} hoursCur={week.current.totalHours} hoursPrev={week.previous.totalHours} />
          <CompareCard title={`${MONTHS_IT[m - 1]} vs ${MONTHS_IT[month.previous.month - 1]}`}
            cur={month.current.netTotal} prev={month.previous.netTotal} delta={month.deltaNetPct}
            hoursCur={month.current.totalHours} hoursPrev={month.previous.totalHours} />
          <CompareCard title={`${y} vs ${y - 1}`} cur={yearCmp.current.totalNetAll} prev={yearCmp.previous.totalNetAll}
            delta={yearCmp.deltaNetPct} hoursCur={yearCmp.current.totalHours} hoursPrev={yearCmp.previous.totalHours} />
        </div>
      </div>
      <SiteCompareCard state={state} year={year} yearSelect={yearSelect} />
    </>
  );
}

export default function AnalisiTab({ state, initialSub = 'trend', onOpenMonth }) {
  const [sub, setSub] = useState(initialSub);
  const years = useMemo(() => {
    const set = new Set(monthsWithData(state.shifts, state.occasionalWork).map((mm) => mm.year));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [state.shifts, state.occasionalWork]);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const hasAnyData = state.shifts.length > 0 || state.occasionalWork.length > 0;
  const yearSelect = (
    <div className="hist-year-nav">
      <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Anno">
        {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div className="tabs">
        {SUB_TABS.map((t) => (
          <button key={t.id} className={`tab ${sub === t.id ? 'active' : ''}`} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {!hasAnyData ? (
        <div className="panel">
          <EmptyState icon="chart" title="Ancora nessun dato da analizzare"
            hint="Registra qualche turno in Turni: qui compariranno andamenti e confronti." />
        </div>
      ) : (
        <>
          {sub === 'trend' && <TrendPanel state={state} />}
          {sub === 'compare' && <ComparePanel state={state} year={year} yearSelect={yearSelect} />}
          {sub === 'year' && <HistoryTab state={state} year={year} yearSelect={yearSelect} onOpenMonth={onOpenMonth} />}
        </>
      )}
    </>
  );
}
