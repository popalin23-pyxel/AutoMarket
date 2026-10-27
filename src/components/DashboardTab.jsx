import React, { useMemo } from 'react';
import {
  computeMonthProgress, shiftsToday, shiftsForToday, isShiftDone, shiftStartDate, shiftEndDate,
  shiftsOnDay, activeShifts, addDaysISO, weekdayOf,
} from '../lib/calc.js';
import { useNow } from '../lib/useNow.js';
import ConfirmShiftsCard from './ConfirmShiftsCard.jsx';
import InstallCard from './InstallCard.jsx';
import { MONTHS_IT, WEEKDAYS_IT, WEEKDAYS_IT_LONG, dayMarkKind } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import BackupReminder from './BackupReminder.jsx';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 });
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function greetingWord(now) {
  const h = now.getHours();
  if (h < 6) return 'Buonanotte';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

// "Martedì 27 ottobre"
function formatDateLong(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS_IT_LONG[weekdayOf(y, m, d)]} ${d} ${MONTHS_IT[m - 1].toLowerCase()}`;
}
const weekdayLower = (dateISO) => { const [y, m, d] = dateISO.split('-').map(Number); return WEEKDAYS_IT_LONG[weekdayOf(y, m, d)].toLowerCase(); };

function siteFor(sites, siteId) {
  return sites.find((s) => s.id === siteId) || { name: 'Sede eliminata', color: '#6b7280' };
}

const isNight = (sh) => (sh.end || '') <= (sh.start || '');
// "07:30" → "7:30"
const hm = (t) => (t || '').replace(/^0(\d)/, '$1');

// tra quanto: "tra 50 minuti", "tra 2 ore e 10 minuti"; oltre le 12 ore "alle 7:30"
function untilText(ms, time) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'tra poco';
  if (min < 60) return `tra ${min} ${min === 1 ? 'minuto' : 'minuti'}`;
  if (min >= 12 * 60) return `alle ${hm(time)}`;
  const h = Math.floor(min / 60), m = min % 60;
  return `tra ${h} ${h === 1 ? 'ora' : 'ore'}${m ? ` e ${m} ${m === 1 ? 'minuto' : 'minuti'}` : ''}`;
}

const SiteName = ({ site }) => <><span className="og-dot" style={{ background: site.color }} />{site.name}</>;

// Primi passi per chi inizia (es. un nuovo cliente): sparisce da solo appena completati.
function SetupCard({ state, onNavigate, onAdd }) {
  const st = state.settings;
  const hasData = state.shifts.length > 0 || state.occasionalWork.length > 0;
  const steps = [
    { done: !!((st.displayName || '').trim() || st.professionalRole || (st.vatNumber || '').trim()), label: 'Completa i tuoi dati', go: () => onNavigate('altro', 'anagrafica') },
    { done: state.sites.some((x) => !x.archived), label: 'Aggiungi la prima sede con la paga oraria', go: () => onNavigate('altro', 'sites') },
    { done: hasData, label: 'Registra il primo turno', go: onAdd },
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

// Il riquadro "Oggi": la giornata in una frase (dove lavori, gli orari, tra quanto), e domani.
function TodayCard({ state, today, now }) {
  // i turni di oggi più la notte di ieri ancora in corso (vedi shiftsForToday)
  const todays = useMemo(() => shiftsForToday(state.shifts, now), [state.shifts, now]);
  const remaining = todays.filter((sh) => !isShiftDone(sh, now));
  const current = remaining.find((sh) => { const st = shiftStartDate(sh); return st && st <= now; });
  const nextToday = remaining.find((sh) => { const st = shiftStartDate(sh); return st && st > now; });
  const occasional = shiftsOnDay(state.occasionalWork, today);
  const mark = (state.dayMarks ?? []).find((mk) => mk.date === today);

  const tomorrow = addDaysISO(today, 1);
  const tomorrowShifts = useMemo(() => shiftsToday(state.shifts, tomorrow), [state.shifts, tomorrow]);
  // niente più turni oggi né domani: quando sarà il prossimo
  const nextShift = useMemo(() => {
    if (remaining.length || tomorrowShifts.length) return null;
    return activeShifts(state.shifts).filter((s) => s.date > tomorrow)
      .sort((a, b) => (a.date === b.date ? (a.start || '').localeCompare(b.start || '') : a.date.localeCompare(b.date)))[0] ?? null;
  }, [state.shifts, tomorrow, remaining.length, tomorrowShifts.length]);

  const sites = [...new Map(remaining.map((sh) => [sh.siteId, siteFor(state.sites, sh.siteId)])).values()];
  const working = todays.length > 0;

  let main;
  if (current) main = <>Sei in turno a <SiteName site={siteFor(state.sites, current.siteId)} /></>;
  else if (remaining.length) main = <>Lavori a {sites.map((s, i) => <React.Fragment key={`${s.name}-${i}`}>{i > 0 && ' e '}<SiteName site={s} /></React.Fragment>)}</>;
  else if (working) main = <>Turno di oggi finito ✓</>;
  else if (mark) main = <>{dayMarkKind(mark.kind).label} {dayMarkKind(mark.kind).icon}</>;
  else main = <>Oggi riposo 🌿</>;

  let when = null;
  if (current) {
    when = <>Finisce alle <b>{hm(current.end)}</b> ({untilText(shiftEndDate(current) - now, current.end)})</>;
  } else if (nextToday) {
    const first = remaining.length > 1 && !todays.some((sh) => isShiftDone(sh, now));
    when = <>{first ? 'Il primo turno inizia' : 'Il turno inizia'} <b>{untilText(shiftStartDate(nextToday) - now, nextToday.start)}</b></>;
  }

  const tomorrowSites = [...new Map(tomorrowShifts.map((sh) => [sh.siteId, siteFor(state.sites, sh.siteId)])).values()];
  const tNight = tomorrowShifts.length === 1 && isNight(tomorrowShifts[0]);
  const tStart = tomorrowShifts[0] ? Number(tomorrowShifts[0].start.slice(0, 2)) : 0;

  return (
    <div className={`ncard og-today ${remaining.length ? '' : 'off'}`}>
      <div className="og-lbl">Oggi</div>
      <div className="og-main">{main}</div>
      {mark?.note && !working && <div className="og-when">{mark.note}</div>}

      {working && (
        <div className="og-times">
          {todays.map((sh) => {
            const done = isShiftDone(sh, now);
            return (
              <span key={sh.id} className={`og-time ${done ? 'done' : ''} ${sh === current ? 'now' : ''}`}>
                {done && <Icon name="check" size={15} strokeWidth={3} />}{sh.start} – {sh.end}
                {sh.date !== today && <small>da ieri</small>}
              </span>
            );
          })}
        </div>
      )}
      {when && <div className="og-when"><Icon name="clock" size={17} /><span>{when}</span></div>}
      {remaining.filter((sh) => sh.note).map((sh) => <div key={sh.id} className="og-note">📝 {sh.note}</div>)}

      {occasional.map((o) => (
        <div key={o.id} className="og-next">
          <span className="og-next-ic ic-gold"><Icon name="briefcase" size={18} /></span>
          <div><b>Prestazione: {o.description || 'senza descrizione'}</b><span className="og-next-s">€{fmt(o.grossAmount)}</span></div>
        </div>
      ))}

      {tomorrowShifts.length > 0 && (
        <div className="og-next">
          <span className={`og-next-ic ${tNight ? 'ic-vio' : 'ic-gold'}`}><Icon name={tNight ? 'moon' : tStart >= 12 ? 'sunset' : 'sun'} size={18} /></span>
          <div>
            <b>
              {tNight ? 'Domani notte: ' : 'Domani: '}
              {tomorrowSites.map((s) => s.name).join(' e ')}
              {!tNight && tomorrowShifts.length === 1 && ` alle ${hm(tomorrowShifts[0].start)}`}
            </b>
            <span className="og-next-s">
              {tNight
                ? `dalle ${tomorrowShifts[0].start} di ${weekdayLower(tomorrow)} alle ${tomorrowShifts[0].end} di ${weekdayLower(addDaysISO(tomorrow, 1))}`
                : tomorrowShifts.map((sh) => `${sh.start} – ${sh.end}`).join(' · ')}
            </span>
          </div>
        </div>
      )}
      {nextShift && (
        <div className="og-next">
          <span className="og-next-ic ic-blue"><Icon name="calendar" size={18} /></span>
          <div>
            <b>Prossimo turno: {weekdayLower(nextShift.date)} {Number(nextShift.date.slice(8))} a {siteFor(state.sites, nextShift.siteId).name}</b>
            <span className="og-next-s">{nextShift.start} – {nextShift.end}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// I soldi del mese in breve: quanto resta finora, l'obiettivo e la previsione; il resto è in Soldi.
function MoneyCard({ progress, monthName, goal, onOpenSoldi }) {
  const { done, planned, total } = progress;
  const hasPlanned = planned.shiftCount > 0 || planned.occasionalCount > 0;
  // per difetto: 99,6% non deve diventare "100%" se l'obiettivo non è raggiunto
  const pct = (v) => (goal > 0 ? Math.floor((v / goal) * 100) : 0);
  const [int, dec] = fmt(done.netTotal).split(',');
  const reached = goal > 0 && done.netTotal >= goal;
  const onTrack = goal > 0 && total.netTotal >= goal;
  return (
    <div className="ncard og-money">
      <div className="og-m-lead">A {monthName}, tolte le tasse, finora ti restano</div>
      <div className="og-m-big">€{int}<small>,{dec}</small></div>
      {goal > 0 && (
        <>
          <div className="og-track">
            {hasPlanned && !reached && <div className="plan" style={{ width: `${Math.min(100, pct(total.netTotal))}%` }} />}
            <div className={`fill ${reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, pct(done.netTotal))}%` }} />
          </div>
          <div className="og-g-row"><span>Obiettivo <b>€{fmt0(goal)}</b></span><span>{reached ? 'raggiunto 🎉' : <>sei al <b>{pct(done.netTotal)}%</b></>}</span></div>
        </>
      )}
      {hasPlanned && (
        <div className="og-g-ok">
          <span className={`c ${goal > 0 && !onTrack ? 'warn' : ''}`}><Icon name={goal > 0 && !onTrack ? 'target' : 'check'} size={14} strokeWidth={3} /></span>
          <span>
            Con i turni in programma arrivi a <b>€{fmt0(total.netTotal)}</b>
            {goal > 0 && (onTrack ? ` (${pct(total.netTotal)}%)` : `: mancano €${fmt0(goal - total.netTotal)} all'obiettivo`)}
          </span>
        </div>
      )}
      {!hasPlanned && goal > 0 && !reached && (
        <div className="og-g-ok"><span className="c warn"><Icon name="target" size={14} strokeWidth={3} /></span><span>Mancano <b>€{fmt0(goal - done.netTotal)}</b> all'obiettivo</span></div>
      )}
      <button type="button" className="og-link" onClick={onOpenSoldi}><span>Tutti i conti in Soldi</span><Icon name="chevronRight" size={18} /></button>
    </div>
  );
}

// I prossimi giorni di lavoro (da domani): turni e giorni segnati; ferie di più giorni in una riga.
function NextShifts({ state, today, onOpenTurni }) {
  const rows = useMemo(() => {
    const items = [
      ...activeShifts(state.shifts).filter((s) => s.date > today).map((s) => ({ kind: 'shift', date: s.date, sort: `${s.date} ${s.start}`, item: s })),
      ...(state.dayMarks ?? []).filter((mk) => mk.date > today).map((mk) => ({ kind: 'mark', date: mk.date, sort: `${mk.date} 00`, item: mk })),
    ].sort((a, b) => a.sort.localeCompare(b.sort));
    const out = [];
    for (const it of items) {
      const last = out[out.length - 1];
      if (it.kind === 'mark' && last?.kind === 'mark' && last.item.kind === it.item.kind && addDaysISO(last.to, 1) === it.date) { last.to = it.date; continue; }
      if (out.length === 4) break;
      out.push({ ...it, to: it.date });
    }
    return out;
  }, [state.shifts, state.dayMarks, today]);

  if (!rows.length) return null;
  const daysAway = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  return (
    <>
      <div className="grp-title">I prossimi turni</div>
      <div className="lcard">
        {rows.map((r) => {
          const [y, m, d] = r.date.split('-').map(Number);
          const away = daysAway(r.date);
          let a, b, tag = null;
          if (r.kind === 'shift') {
            a = <SiteName site={siteFor(state.sites, r.item.siteId)} />;
            b = <span className="og-nx-b">{r.item.start} – {r.item.end}</span>;
            if (isNight(r.item)) tag = <span className="og-tag night"><Icon name="moon" size={12} /> notte</span>;
          } else {
            const k = dayMarkKind(r.item.kind);
            a = <>{k.icon} {k.label}</>;
            b = <span className="og-nx-b h">{r.to === r.date ? 'tutto il giorno' : `fino a ${weekdayLower(r.to)} ${Number(r.to.slice(8))}`}</span>;
          }
          if (!tag && away >= 4) tag = <span className="og-tag">tra {away} giorni</span>;
          return (
            <button key={`${r.kind}-${r.item.id}`} type="button" className="og-next-row" onClick={onOpenTurni}>
              <span className="og-nd"><span className="w">{WEEKDAYS_IT[weekdayOf(y, m, d)].toUpperCase()}</span><span className="n">{d}</span></span>
              <span className="og-nx"><span className="og-nx-a">{a}</span>{b}</span>
              {tag}
            </button>
          );
        })}
        <button type="button" className="og-more" onClick={onOpenTurni}>Tutti i turni <Icon name="chevronRight" size={17} /></button>
      </div>
    </>
  );
}

// Oggi, la pagina principale: il saluto e, nell'angolo, il fatturato del mese; poi la giornata
// in una frase, le cose da fare, i soldi in breve e i prossimi turni.
export default function DashboardTab({ state, setState, userEmail, onNavigate, onOpenCurrentMonth, onAdd }) {
  const now = useNow();
  const today = isoOf(now);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const rawName = (state.settings.displayName || '').trim().split(/\s+/)[0]
    || (userEmail || '').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim().split(' ')[0]
    || '';
  const firstName = rawName ? rawName[0].toUpperCase() + rawName.slice(1) : '';

  const progress = useMemo(() => computeMonthProgress(state.shifts, state.sites, state.settings, y, m, state.occasionalWork, now),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork, now]);
  const { done, total } = progress;
  const hasAnyData = state.shifts.length > 0 || state.occasionalWork.length > 0;
  const greeting = greetingWord(now);

  return (
    <>
      <div className="og-greet">
        <div className="og-greet-l">
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}{greeting === 'Buongiorno' ? ' 👋' : ''}</h1>
          <div className="og-greet-date">{formatDateLong(today)}</div>
        </div>
        {total.shiftCount > 0 && (
          // fatturato del mese (rivalsa compresa): già fatto, su il totale con i turni in programma
          <button type="button" className="og-fatt" onClick={() => onOpenCurrentMonth('soldi')}>
            <span className="l">Fatturato</span>
            <span className="v">€{fmt(done.totalInvoice)}</span>
            <span className="s">
              {total.totalInvoice > done.totalInvoice ? <>su <b>€{fmt0(total.totalInvoice)}</b> totali</> : `a ${MONTHS_IT[m - 1].toLowerCase()}`}
            </span>
          </button>
        )}
      </div>

      <SetupCard state={state} onNavigate={onNavigate} onAdd={onAdd} />

      {(state.sites.length > 0 || hasAnyData) && <TodayCard state={state} today={today} now={now} />}

      {setState && <ConfirmShiftsCard state={state} setState={setState} now={now} />}

      <InstallCard />
      <BackupReminder state={state} />

      {hasAnyData && (
        <MoneyCard progress={progress} monthName={MONTHS_IT[m - 1].toLowerCase()} goal={Number(state.settings.monthlyGoal) || 0}
          onOpenSoldi={() => onOpenCurrentMonth('soldi')} />
      )}

      <NextShifts state={state} today={today} onOpenTurni={() => onNavigate('calendar')} />
    </>
  );
}
