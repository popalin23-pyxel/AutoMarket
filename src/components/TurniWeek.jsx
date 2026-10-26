import React, { useMemo } from 'react';
import {
  addDaysISO, startOfWeek, shiftsOnDay, hoursOfShift, isCancelled, isShiftDone, shiftsToConfirm,
  computeRangeSummary, holidaysOfYear, isHoliday,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT, dayMarkKind } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
const dayNum = (iso) => Number(iso.slice(8));

function weekTitle(start, today) {
  const diff = Math.round((new Date(start + 'T00:00:00') - new Date(startOfWeek(today) + 'T00:00:00')) / (7 * 86400000));
  if (diff === 0) return 'Questa settimana';
  if (diff === 1) return 'Settimana prossima';
  if (diff === -1) return 'Settimana scorsa';
  const m = Number(start.slice(5, 7));
  return `Settimana del ${dayNum(start)} ${MONTHS_IT[m - 1].toLowerCase()}`;
}

function rangeText(start) {
  const end = addDaysISO(start, 6);
  const sm = Number(start.slice(5, 7)), em = Number(end.slice(5, 7));
  return sm === em
    ? `da lunedì ${dayNum(start)} a domenica ${dayNum(end)}`
    : `da lunedì ${dayNum(start)} ${MONTHS_IT[sm - 1].slice(0, 3).toLowerCase()} a domenica ${dayNum(end)} ${MONTHS_IT[em - 1].slice(0, 3).toLowerCase()}`;
}

// Turni, vista settimana: un giorno per riga, con lo stato di ogni turno (fatto, da confermare, oggi).
export default function TurniWeek({
  state, weekStart, setWeekStart, today, onOpenDay, onEditShift, onEditOccasional, onEditMark,
}) {
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);
  const weekEnd = addDaysISO(weekStart, 6);
  const summary = useMemo(
    () => computeRangeSummary(state.shifts, state.sites, state.settings, weekStart, weekEnd, state.occasionalWork),
    [state.shifts, state.sites, state.settings, weekStart, weekEnd, state.occasionalWork],
  );
  const toConfirm = useMemo(() => new Set(shiftsToConfirm(state.shifts).map((s) => s.id)), [state.shifts]);
  const dayMarks = state.dayMarks ?? [];
  const holidays = useMemo(() => {
    const ys = new Set([weekStart.slice(0, 4), weekEnd.slice(0, 4)]);
    return new Map([...ys].map((y) => [y, holidaysOfYear(Number(y))]));
  }, [weekStart, weekEnd]);

  // giorni della settimana; quelli liberi uno dopo l'altro si raggruppano in una riga sola
  const blocks = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysISO(weekStart, i);
      const [y, m, d] = date.split('-').map(Number);
      const items = [
        ...shiftsOnDay(dayMarks, date).map((mk) => ({ kind: 'mark', item: mk })),
        ...shiftsOnDay(state.shifts, date).sort((a, b) => (a.start || '').localeCompare(b.start || '')).map((sh) => ({ kind: 'shift', item: sh })),
        ...shiftsOnDay(state.occasionalWork, date).map((o) => ({ kind: 'occ', item: o })),
      ];
      const day = { date, wd: i, holiday: isHoliday(y, m, d, holidays.get(String(y))) };
      const last = out[out.length - 1];
      if (items.length === 0 && date !== today && last?.free && !last.days.some((x) => x.date === today)) last.days.push(day);
      else out.push(items.length === 0 ? { free: true, days: [day] } : { free: false, day, items });
    }
    return out;
  }, [weekStart, state.shifts, state.occasionalWork, dayMarks, holidays, today]);

  const future = weekStart > startOfWeek(today);
  const prev = () => setWeekStart(addDaysISO(weekStart, -7));
  const next = () => setWeekStart(addDaysISO(weekStart, 7));

  const dn = (day) => (
    <div className={`wk-dn ${day.holiday ? 'holiday' : ''}`}>
      <span className="wk-wd">{WEEKDAYS_IT[day.wd].toUpperCase()}</span>
      <span className="wk-n">{dayNum(day.date)}</span>
    </div>
  );

  const shiftEnd = (sh, date) => {
    if (isCancelled(sh)) return <span className="wk-badge off">Non fatto</span>;
    if (sh.status === 'done') return <span className="wk-badge ok"><Icon name="check" size={15} strokeWidth={3} />Fatto</span>;
    if (toConfirm.has(sh.id)) {
      return (
        <button type="button" className="wk-conf" onClick={(e) => { e.stopPropagation(); onEditShift(date, sh); }}>
          Conferma<Icon name="chevronRight" size={17} strokeWidth={2.6} />
        </button>
      );
    }
    if (isShiftDone(sh)) return <span className="wk-badge ok"><Icon name="check" size={15} strokeWidth={3} />Fatto</span>;
    if (date === today) return <span className="wk-badge today">Oggi</span>;
    return <span className="wk-hours">{fmt1(hoursOfShift(sh))} ore</span>;
  };

  return (
    <>
      <div className="ncard wk-nav">
        <button type="button" className="wk-arrow" onClick={prev} aria-label="Settimana precedente"><Icon name="chevronLeft" size={24} strokeWidth={2.6} /></button>
        <div className="wk-title">
          <div className="wk-t1">{weekTitle(weekStart, today)}</div>
          <div className="wk-t2">
            {rangeText(weekStart)}
            {summary.totalHours > 0 || summary.occasionalCount > 0 ? (
              <><br /><b>{fmt1(summary.totalHours)} ore</b> · {future ? 'ti resteranno' : 'ti restano'} <span className="wk-money">€{fmt(summary.netTotal)}</span></>
            ) : <><br />nessun turno</>}
          </div>
          {weekStart !== startOfWeek(today) && (
            <button type="button" className="link-btn wk-today-link" onClick={() => setWeekStart(startOfWeek(today))}>Torna a questa settimana</button>
          )}
        </div>
        <button type="button" className="wk-arrow" onClick={next} aria-label="Settimana successiva"><Icon name="chevronRight" size={24} strokeWidth={2.6} /></button>
      </div>

      <div className="ncard wk-days">
        {blocks.map((b) => {
          if (b.free) {
            const isToday = b.days[0].date === today;
            return (
              <button type="button" key={b.days[0].date} className={`wk-day free ${isToday ? 'today' : ''}`} onClick={() => onOpenDay(b.days[0].date)}>
                {b.days.length === 1 ? dn(b.days[0]) : (
                  <div className="wk-dn multi">
                    {b.days.map((d) => <span key={d.date} className="wk-wd">{WEEKDAYS_IT[d.wd].toUpperCase()} {dayNum(d.date)}</span>)}
                  </div>
                )}
                <span className="wk-db"><b>Libero</b> · nessun turno</span>
                {isToday ? <span className="wk-badge today">Oggi</span> : <span className="wk-add"><Icon name="plus" size={18} strokeWidth={2.4} /></span>}
              </button>
            );
          }
          const { day, items } = b;
          return (
            <div key={day.date} className={`wk-group ${day.date === today ? 'today' : ''}`}>
              {items.map(({ kind, item }, i) => {
                const first = i === 0;
                const dnCell = first ? dn(day) : <div className="wk-dn" />;
                if (kind === 'mark') {
                  const k = dayMarkKind(item.kind);
                  return (
                    <button type="button" key={`m${item.id}`} className="wk-day" onClick={() => onEditMark(item)}>
                      {dnCell}
                      <span className="wk-db">
                        <span className="wk-ds"><span className="wk-emoji">{k.icon}</span>{k.label}</span>
                        {item.note && <span className="wk-dt h">{item.note}</span>}
                      </span>
                    </button>
                  );
                }
                if (kind === 'occ') {
                  return (
                    <button type="button" key={`o${item.id}`} className="wk-day" onClick={() => onEditOccasional(day.date, item)}>
                      {dnCell}
                      <span className="wk-db">
                        <span className="wk-ds"><span className="wk-extra"><Icon name="briefcase" size={14} strokeWidth={2.4} /></span>{item.description || 'Prestazione'}</span>
                        <span className="wk-dt h">Prestazione · €{fmt(item.grossAmount)}</span>
                      </span>
                    </button>
                  );
                }
                const site = siteById.get(item.siteId);
                const cancelled = isCancelled(item);
                return (
                  <button type="button" key={`s${item.id}`} className={`wk-day ${cancelled ? 'cancelled' : ''}`} onClick={() => onEditShift(day.date, item)}>
                    {dnCell}
                    <span className="wk-db">
                      <span className="wk-ds"><span className="wk-dot" style={{ background: site?.color ?? '#6b7280' }} />{site?.name ?? 'Sede eliminata'}</span>
                      <span className="wk-dt">{item.start} – {item.end}{item.note ? ` · ${item.note}` : ''}</span>
                    </span>
                    {shiftEnd(item, day.date)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
