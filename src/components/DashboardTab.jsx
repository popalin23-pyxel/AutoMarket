import React, { useMemo } from 'react';
import {
  compareWeeks, compareMonths, compareYears,
  lastNWeeksSummaries, lastNMonthsSummaries, todayISO,
  shiftsToday, nextShiftAfter, weekdayOf,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import BarChart from './charts/BarChart.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

function DeltaBadge({ pct }) {
  if (pct == null) return <span className="delta-badge neutral">nuovo</span>;
  if (pct === 0) return <span className="delta-badge neutral">= 0%</span>;
  const up = pct > 0;
  return <span className={`delta-badge ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 6) return 'Buonanotte';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function formatDateLong(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS_IT_LONG[weekdayOf(y, m, d)]} ${d} ${MONTHS_IT[m - 1]}`;
}

function siteFor(sites, siteId) {
  return sites.find((s) => s.id === siteId) || { name: 'Sede eliminata', color: '#6b7280' };
}

function TodayCard({ state, today, firstName }) {
  const todays = useMemo(() => shiftsToday(state.shifts, today), [state.shifts, today]);
  const upcoming = useMemo(() => (todays.length ? null : nextShiftAfter(state.shifts, today)),
    [state.shifts, today, todays.length]);

  return (
    <div className="panel hero-today">
      <div className="hero-greeting">{greetingWord()}{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span></div>
      <div className="hero-date">{formatDateLong(today)}</div>

      {todays.length > 0 ? (
        <div className="hero-today-box working">
          <div className="hero-today-label">Oggi lavori</div>
          {todays.map((sh) => {
            const site = siteFor(state.sites, sh.siteId);
            return (
              <div key={sh.id} className="hero-today-row">
                <span className="site-dot" style={{ background: site.color }} />
                <span className="hero-today-site">{site.name}</span>
                <span className="hero-today-time">{sh.start}–{sh.end}</span>
                {sh.note && <span className="hero-today-note">{sh.note}</span>}
              </div>
            );
          })}
        </div>
      ) : upcoming ? (
        <div className="hero-today-box off">
          <div className="hero-today-label">Oggi non lavori 🎉</div>
          <div className="hero-today-row">
            <span className="site-dot" style={{ background: siteFor(state.sites, upcoming.siteId).color }} />
            <span className="hero-today-site">Prossimo turno: {formatDateLong(upcoming.date)} — {siteFor(state.sites, upcoming.siteId).name}</span>
            <span className="hero-today-time">{upcoming.start}–{upcoming.end}</span>
          </div>
        </div>
      ) : (
        <div className="hero-today-box off">
          <div className="hero-today-label">Nessun turno in programma</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardTab({ state, userEmail }) {
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const rawName = (state.settings.displayName || '').trim().split(/\s+/)[0]
    || (userEmail || '').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim().split(' ')[0]
    || '';
  const firstName = rawName ? rawName[0].toUpperCase() + rawName.slice(1) : '';

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
      <TodayCard state={state} today={today} firstName={firstName} />

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
