import React, { useMemo } from 'react';
import {
  compareWeeks, compareMonths, computeMonthProgress, tomorrowISO, shiftsToday, nextShiftAfter, weekdayOf, shiftsOnDay,
} from '../lib/calc.js';
import { useNow } from '../lib/useNow.js';
import ConfirmShiftsCard from './ConfirmShiftsCard.jsx';
import InstallCard from './InstallCard.jsx';
import { MONTHS_IT, WEEKDAYS_IT_LONG, roleLabel, dayMarkKind } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import CountUpText from './CountUpText.jsx';
import DeltaBadge from './DeltaBadge.jsx';
import BackupReminder from './BackupReminder.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const fmtInt = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 0 });

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

// Primi passi per chi inizia (es. un nuovo cliente): sparisce da solo appena completati.
function SetupCard({ state, onNavigate }) {
  const st = state.settings;
  const hasData = state.shifts.length > 0 || state.occasionalWork.length > 0;
  const steps = [
    { done: !!((st.displayName || '').trim() || st.professionalRole || (st.vatNumber || '').trim()), label: 'Completa la tua anagrafica', go: () => onNavigate('studio', 'anagrafica') },
    { done: state.sites.length > 0, label: 'Aggiungi la prima sede con la paga oraria', go: () => onNavigate('studio', 'sites') },
    { done: hasData, label: 'Registra il primo turno', go: () => onNavigate('calendar') },
  ];
  // serve solo per iniziare: sparisce appena c'è il primo turno o la prima prestazione
  if (hasData || steps.every((s) => s.done)) return null;
  return (
    <div className="panel setup-card">
      <h2 className="panel-title">Primi passi</h2>
      <div className="setup-list">
        {steps.map((s) => (
          <button key={s.label} type="button" className={`setup-step ${s.done ? 'done' : ''}`} onClick={s.go} disabled={s.done}>
            <span className="setup-check">{s.done ? <Icon name="checkCircle" size={18} /> : <span className="setup-dot" />}</span>
            <span className="setup-label">{s.label}</span>
            {!s.done && <span className="setup-go">›</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Il mese in Home: in grande ciò che è già stato lavorato (turni finiti), sotto ciò che è
// in programma e la previsione a fine mese. Prima i turni futuri contavano come già fatti.
function MonthCard({ progress, deltaPct, monthLabel, prevMonthLabel, goal }) {
  const { done, planned, total } = progress;
  const hourlyNet = done.totalHours > 0 ? done.net / done.totalHours : 0;
  const hasPlanned = planned.shiftCount > 0 || planned.occasionalCount > 0;
  const goalPct = goal > 0 ? Math.round((done.netTotal / goal) * 100) : null;
  const forecastPct = goal > 0 ? Math.round((total.netTotal / goal) * 100) : null;
  const reached = goal > 0 && done.netTotal >= goal;

  return (
    <div className="panel month-hero">
      <div className="month-hero-top">
        <span className="month-hero-label">{monthLabel}</span>
      </div>
      <div className="month-hero-net">€<CountUpText value={done.netTotal} format={fmt} /></div>
      <div className="month-hero-net-caption">
        netto già guadagnato{done.occasionalCount > 0 ? ` · di cui €${fmt(done.occasionalNet)} da prestazioni occasionali` : ''}
      </div>

      <div className="month-hero-grid">
        <div className="mh-stat">
          <span className="mh-val">€<CountUpText value={done.totalInvoice} format={fmtInt} /></span>
          <span className="mh-lbl">fatturato finora</span>
        </div>
        <div className="mh-stat">
          <span className="mh-val"><CountUpText value={done.totalHours} format={fmt0} />h</span>
          <span className="mh-lbl">lavorate</span>
        </div>
        <div className="mh-stat">
          <span className="mh-val">€<CountUpText value={hourlyNet} format={fmt} />/h</span>
          <span className="mh-lbl">netto medio</span>
        </div>
      </div>

      {hasPlanned && (
        <div className="month-hero-plan">
          <div className="mh-plan-row">
            <span className="mh-plan-lbl">In programma</span>
            <span className="mh-plan-val mono">{fmt0(planned.totalHours)}h · €{fmt(planned.netTotal)}</span>
          </div>
          <div className="mh-plan-row">
            <span className="mh-plan-lbl">Previsione a fine mese</span>
            <span className="mh-plan-val mono"><b>€{fmt(total.netTotal)}</b></span>
          </div>
        </div>
      )}
      <div className="month-hero-delta-row">
        <DeltaBadge pct={deltaPct} /> <span>{hasPlanned ? 'previsione' : 'questo mese'} vs {prevMonthLabel}</span>
      </div>

      {goalPct != null && (
        <div className="month-hero-goal-block">
          <div className="goal-bar-track">
            {hasPlanned && !reached && (
              <div className="goal-bar-fill planned" style={{ width: `${Math.min(100, forecastPct)}%` }} />
            )}
            <div className={`goal-bar-fill ${reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, goalPct)}%` }} />
          </div>
          <div className="month-hero-goal-text">
            {reached
              ? <>Obiettivo raggiunto · €{fmt(done.netTotal)} su €{fmt(goal)}</>
              : <><b>{goalPct}%</b> dell'obiettivo{hasPlanned
                ? <> · con i turni in programma arrivi al <b>{forecastPct}%</b></>
                : <> · mancano €{fmt(Math.max(0, goal - done.netTotal))}</>}</>}
          </div>
        </div>
      )}
    </div>
  );
}

function TodayCard({ state, today }) {
  const todays = useMemo(() => shiftsToday(state.shifts, today), [state.shifts, today]);
  const todaysOccasional = useMemo(() => shiftsOnDay(state.occasionalWork, today), [state.occasionalWork, today]);
  const todaysMark = (state.dayMarks ?? []).find((mk) => mk.date === today);
  const upcoming = useMemo(() => (todays.length ? null : nextShiftAfter(state.shifts, today)),
    [state.shifts, today, todays.length]);

  const isEvening = new Date().getHours() >= 18;
  const tomorrow = tomorrowISO();
  const tomorrowShifts = useMemo(() => (isEvening ? shiftsToday(state.shifts, tomorrow) : []),
    [state.shifts, tomorrow, isEvening]);

  return (
    <div className="panel hero-today">
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
          <div className="hero-today-label">
            {todaysMark
              ? <>{dayMarkKind(todaysMark.kind).icon} Oggi: {dayMarkKind(todaysMark.kind).label.toLowerCase()}{todaysMark.note ? ` · ${todaysMark.note}` : ''}</>
              : <><Icon name="checkCircle" size={14} className="inline-icon" /> Oggi non lavori</>}
          </div>
          <div className="hero-today-row">
            <SiteAvatar site={siteFor(state.sites, upcoming.siteId)} size={20} />
            <span className="hero-today-site">Prossimo turno: {formatDateLong(upcoming.date)} — {siteFor(state.sites, upcoming.siteId).name}</span>
            <span className="hero-today-time">{upcoming.start}–{upcoming.end}</span>
          </div>
        </div>
      ) : (
        <div className="hero-today-box off">
          <div className="hero-today-label">
            {todaysMark ? `${dayMarkKind(todaysMark.kind).icon} Oggi: ${dayMarkKind(todaysMark.kind).label.toLowerCase()} · ` : ''}Nessun turno in programma
          </div>
        </div>
      )}

      {todaysOccasional.length > 0 && (
        <div className="hero-today-box off" style={{ marginTop: 10 }}>
          <div className="hero-today-label">Prestazioni di oggi</div>
          {todaysOccasional.map((o) => (
            <div key={o.id} className="hero-today-row">
              <span className="occasional-dot">💼</span>
              <span className="hero-today-site">{o.description}</span>
              <span className="hero-today-time">€{fmt(Number(o.grossAmount) || 0)}</span>
            </div>
          ))}
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

function WeekRow({ week }) {
  return (
    <div className="panel week-row">
      <span className="week-row-label">Questa settimana</span>
      <span className="week-row-vals">
        <span className="week-row-val mono">{fmt0(week.current.totalHours)}h</span>
        <span className="week-row-val mono">€{fmt(week.current.netTotal)}</span>
        <span className="week-row-delta"><DeltaBadge pct={week.deltaNetPct} /> vs sett. scorsa</span>
      </span>
    </div>
  );
}

export default function DashboardTab({ state, setState, userEmail, isAdmin, onNavigate, onOpenCurrentMonth }) {
  const now = useNow();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const rawName = (state.settings.displayName || '').trim().split(/\s+/)[0]
    || (userEmail || '').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim().split(' ')[0]
    || '';
  const firstName = rawName ? rawName[0].toUpperCase() + rawName.slice(1) : '';
  const role = roleLabel(state.settings);

  const week = useMemo(() => compareWeeks(state.shifts, state.sites, state.settings, today, state.occasionalWork),
    [state.shifts, state.sites, state.settings, today, state.occasionalWork]);
  const month = useMemo(() => compareMonths(state.shifts, state.sites, state.settings, y, m, state.occasionalWork),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork]);
  const progress = useMemo(() => computeMonthProgress(state.shifts, state.sites, state.settings, y, m, state.occasionalWork, now),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork, now]);

  const hasAnyData = state.shifts.length > 0 || state.occasionalWork.length > 0;

  return (
    <>
      <div className="home-greeting">
        <div className="hero-greeting">{greetingWord()}{firstName ? `, ${firstName}` : ''}</div>
        <div className="hero-date">{[role, formatDateLong(today)].filter(Boolean).join(' · ')}</div>
      </div>

      <InstallCard />

      <BackupReminder state={state} />

      <SetupCard state={state} onNavigate={onNavigate} />

      {setState && <ConfirmShiftsCard state={state} setState={setState} now={now} />}

      {hasAnyData && (
        <MonthCard progress={progress} deltaPct={month.deltaNetPct} monthLabel={`${MONTHS_IT[m - 1]} ${y}`}
          prevMonthLabel={MONTHS_IT[month.previous.month - 1].toLowerCase()}
          goal={Number(state.settings.monthlyGoal) || 0} />
      )}

      {(state.sites.length > 0 || hasAnyData) && <TodayCard state={state} today={today} />}

      {hasAnyData && <WeekRow week={week} />}

      {(state.sites.length > 0 || hasAnyData) && (
        <div className="home-actions">
          {state.sites.length > 0 && (
            <button className="btn btn-primary" onClick={() => onOpenCurrentMonth('calendar')}>
              <Icon name="calendar" size={16} /> Registra un turno
            </button>
          )}
          <button className="btn" onClick={() => onOpenCurrentMonth('earnings', 'summary')}>
            <Icon name="euro" size={16} /> Riepilogo del mese
          </button>
          {isAdmin && (
            <button className="btn" onClick={() => onNavigate('admin')}>
              <Icon name="zap" size={16} /> Amministrazione
            </button>
          )}
        </div>
      )}
    </>
  );
}
