import React, { useMemo } from 'react';
import {
  compareWeeks, compareMonths, compareYears,
  lastNWeeksSummaries, lastNMonthsSummaries, todayISO, tomorrowISO,
  shiftsToday, nextShiftAfter, weekdayOf, shiftsInMonth, monthsWithData,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import AreaChart from './charts/AreaChart.jsx';
import Icon from './icons/Icon.jsx';
import EmptyState from './EmptyState.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import CountUpText from './CountUpText.jsx';
import BackupReminder from './BackupReminder.jsx';

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

  const isEvening = new Date().getHours() >= 18;
  const tomorrow = tomorrowISO();
  const tomorrowShifts = useMemo(() => (isEvening ? shiftsToday(state.shifts, tomorrow) : []),
    [state.shifts, tomorrow, isEvening]);

  return (
    <div className="panel hero-today">
      <div className="hero-greeting">
        {greetingWord()}{firstName ? `, ${firstName}` : ''} <Icon name="wave" size={20} className="wave-icon" />
      </div>
      <div className="hero-date">{formatDateLong(today)}</div>

      {todays.length > 0 ? (
        <div className="hero-today-box working">
          <div className="hero-today-label">Oggi lavori</div>
          {todays.map((sh) => {
            const site = siteFor(state.sites, sh.siteId);
            return (
              <div key={sh.id} className="hero-today-row">
                <SiteAvatar site={site} size={20} />
                <span className="hero-today-site">{site.name}</span>
                <span className="hero-today-time">{sh.start}–{sh.end}</span>
                {sh.note && <span className="hero-today-note">{sh.note}</span>}
              </div>
            );
          })}
        </div>
      ) : upcoming ? (
        <div className="hero-today-box off">
          <div className="hero-today-label"><Icon name="checkCircle" size={14} className="inline-icon" /> Oggi non lavori</div>
          <div className="hero-today-row">
            <SiteAvatar site={siteFor(state.sites, upcoming.siteId)} size={20} />
            <span className="hero-today-site">Prossimo turno: {formatDateLong(upcoming.date)} — {siteFor(state.sites, upcoming.siteId).name}</span>
            <span className="hero-today-time">{upcoming.start}–{upcoming.end}</span>
          </div>
        </div>
      ) : (
        <div className="hero-today-box off">
          <div className="hero-today-label">Nessun turno in programma</div>
        </div>
      )}

      {tomorrowShifts.length > 0 && (
        <div className="tomorrow-banner">
          <Icon name="bell" size={17} className="tomorrow-banner-icon" />
          <div>
            <div className="tomorrow-banner-title">Promemoria: domani lavori</div>
            {tomorrowShifts.map((sh) => {
              const site = siteFor(state.sites, sh.siteId);
              return (
                <div key={sh.id} className="tomorrow-banner-row">
                  <SiteAvatar site={site} size={18} />
                  {site.name} · {sh.start}–{sh.end}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, net }) {
  if (!goal) return null;
  const pct = Math.min(100, Math.round((net / goal) * 100));
  const reached = net >= goal;
  return (
    <div className="panel">
      <div className="goal-head">
        <h2 className="panel-title" style={{ marginBottom: 0 }}>Obiettivo del mese</h2>
        <span className="goal-pct"><CountUpText value={pct} format={(v) => Math.round(v)} />%</span>
      </div>
      <div className="goal-bar-track">
        <div className={`goal-bar-fill ${reached ? 'reached' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-sub">
        {reached
          ? `Obiettivo raggiunto — €${fmt(net)} su €${fmt(goal)} 🎉`
          : `€${fmt(net)} su €${fmt(goal)} — mancano €${fmt(Math.max(0, goal - net))}`}
      </div>
    </div>
  );
}

function NavGrid({ state, y, m, onNavigate, isAdmin }) {
  const shiftsThisMonth = shiftsInMonth(state.shifts, y, m).length;
  const monthsCount = monthsWithData(state.shifts).length;
  const items = [
    { id: 'calendar', icon: 'calendar', tile: 'teal', label: 'Calendario', hint: `${shiftsThisMonth} turni questo mese` },
    { id: 'earnings', icon: 'euro', tile: 'gold', label: 'Guadagni', hint: `${state.sites.length} sedi · riepilogo` },
    { id: 'stats', icon: 'history', tile: 'rose', label: 'Statistiche', hint: `${monthsCount} mesi registrati` },
    { id: 'settings', icon: 'settings', tile: 'lime', label: 'Profilo', hint: 'Account e backup' },
    ...(isAdmin ? [{ id: 'admin', icon: 'zap', tile: 'violet', label: 'Admin', hint: 'Utenti e approvazioni' }] : []),
  ];
  return (
    <div className="nav-grid">
      {items.map((it) => (
        <button key={it.id} className="nav-card" onClick={() => onNavigate(it.id)}>
          <span className={`nav-icon-tile tile-${it.tile}`}><Icon name={it.icon} size={19} /></span>
          <span className="nav-card-label">{it.label}</span>
          <span className="nav-card-hint">{it.hint}</span>
        </button>
      ))}
    </div>
  );
}

export default function DashboardTab({ state, userEmail, isAdmin, onNavigate }) {
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
      <BackupReminder state={state} />

      <TodayCard state={state} today={today} firstName={firstName} />

      <NavGrid state={state} y={y} m={m} onNavigate={onNavigate} isAdmin={isAdmin} />

      <GoalCard goal={Number(state.settings.monthlyGoal) || 0} net={month.current.net} />

      <div className="panel hero-week">
        <div className="hero-week-label">Questa settimana</div>
        {!hasAnyData ? (
          <EmptyState icon="calendar" title="Ancora nessun turno"
            hint="Registra qualche turno per iniziare a vedere le statistiche." />
        ) : (
          <>
            <div className="hero-week-row">
              <div className="hero-stat">
                <span className="hero-num"><CountUpText value={week.current.totalHours} format={fmt0} /><span className="hero-unit">h</span></span>
                <span className="hero-caption">ore lavorate</span>
              </div>
              <div className="hero-stat">
                <span className="hero-num gold">€<CountUpText value={week.current.net} format={fmt} /></span>
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
            <AreaChart data={weeksTrend} valueKey="net" labelKey="label" color="var(--gold)" height={140} />
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
            <AreaChart data={monthsTrend} valueKey="totalHours" labelKey="label" color="var(--accent)" height={140} />
          </div>
        </>
      )}
    </>
  );
}
