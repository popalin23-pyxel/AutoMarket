import React, { useState, useMemo, useEffect } from 'react';
import { monthDays, weekdayOf, shiftsOnDay, hoursOfShift, todayISO, holidaysOfYear, isHoliday } from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT, hexToRgba } from '../lib/defaults.js';
import { addShift, updateShift, removeShift } from '../lib/store.js';
import ShiftEditor from './ShiftEditor.jsx';
import CalendarGridView from './charts/CalendarGridView.jsx';

const VIEW_KEY = 'turnio_view_pref';

export default function ShiftsTab({ state, setState, year, month, setYear, setMonth }) {
  const [editing, setEditing] = useState(null); // { date, shift: null|obj }
  const [dayPopover, setDayPopover] = useState(null); // dateISO (solo vista calendario)
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'list'; } catch { return 'list'; } });
  const [toast, setToast] = useState(false);

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

  const days = monthDays(year, month);
  const today = todayISO();
  const holidaySet = useMemo(() => holidaysOfYear(year), [year]);
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); };

  const openNew = (dateISO) => { setDayPopover(null); setEditing({ date: dateISO, shift: null }); };
  const openEdit = (dateISO, shift) => { setDayPopover(null); setEditing({ date: dateISO, shift }); };

  const flashSaved = () => {
    setToast(true);
    try { navigator.vibrate?.(25); } catch {}
    setTimeout(() => setToast(false), 1400);
  };

  const save = (data) => {
    if (editing?.shift) setState((s) => updateShift(s, editing.shift.id, data));
    else setState((s) => addShift(s, data));
    setEditing(null);
    flashSaved();
  };
  const del = (id) => { setState((s) => removeShift(s, id)); setEditing(null); };

  const { monthTotalHours, monthAccent } = useMemo(() => {
    let h = 0;
    const bySite = new Map();
    for (let d = 1; d <= days; d++) {
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const sh of shiftsOnDay(state.shifts, dateISO)) {
        const sh2 = hoursOfShift(sh);
        h += sh2;
        if (sh.siteId != null) bySite.set(sh.siteId, (bySite.get(sh.siteId) || 0) + sh2);
      }
    }
    let bestId = null, bestH = 0;
    for (const [id, hh] of bySite) if (hh > bestH) { bestH = hh; bestId = id; }
    return {
      monthTotalHours: Math.round(h * 100) / 100,
      monthAccent: bestId != null ? siteById.get(bestId)?.color : null,
    };
  }, [state.shifts, year, month, days, siteById]);

  const DayShiftsBlock = ({ dateISO }) => {
    const dayShifts = shiftsOnDay(state.shifts, dateISO);
    return (
      <div className="day-shifts">
        {dayShifts.map((sh) => {
          const site = siteById.get(sh.siteId);
          const color = site?.color ?? '#6b7280';
          return (
            <div key={sh.id} className="shift-chip" style={{ borderLeftColor: color, background: color + '14' }}
              onClick={() => openEdit(dateISO, sh)}>
              <span className="site-dot" style={{ background: color }} />
              <span className="shift-site">{site?.name ?? 'Sede eliminata'}</span>
              <span className="shift-time">{sh.start}–{sh.end}</span>
              <span className="shift-hours">{hoursOfShift(sh)}h</span>
            </div>
          );
        })}
        <button className="day-add-btn" onClick={() => openNew(dateISO)} disabled={state.sites.length === 0}>
          + turno
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="panel" style={monthAccent ? {
        borderTopColor: monthAccent, borderTopWidth: 3,
        background: `linear-gradient(160deg, ${hexToRgba(monthAccent, 0.10)}, var(--glass))`,
      } : undefined}>
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <div key={`${year}-${month}`} className="month-slide">
            <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
            <span className="month-sub">{monthTotalHours}h totali questo mese</span>
          </div>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>

        <div className="view-row">
          <button className="btn btn-sm" onClick={goToday}>Vai a oggi</button>
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ Lista</button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦ Calendario</button>
          </div>
        </div>

        {state.sites.length === 0 && (
          <div className="hint hint-warn" style={{ marginTop: 12 }}>
            Prima di registrare i turni, aggiungi almeno una sede nella scheda "Sedi".
          </div>
        )}
      </div>

      {view === 'list' ? (
        <div className="panel" style={{ padding: 0 }}>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const wd = weekdayOf(year, month, d);
            const holiday = isHoliday(year, month, d, holidaySet);
            const isWeekend = wd >= 5 || holiday;
            const isToday = dateISO === today;
            return (
              <div key={d} className={`day-row ${isWeekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`}
                style={{ padding: '10px 14px', ...(isToday ? { background: 'rgba(45,212,191,0.07)' } : {}) }}>
                <div className="day-num">
                  <b style={isToday ? { color: 'var(--accent)' } : undefined}>{d}</b>
                  <span style={holiday ? { color: 'var(--red)' } : undefined}>{holiday ? '★' : WEEKDAYS_IT[wd]}</span>
                </div>
                <DayShiftsBlock dateISO={dateISO} />
              </div>
            );
          })}
        </div>
      ) : (
        <CalendarGridView year={year} month={month} shifts={state.shifts} siteById={siteById}
          holidaySet={holidaySet} today={today} onDayClick={(dateISO) => setDayPopover(dateISO)} />
      )}

      {dayPopover && (
        <div className="editor-overlay" onClick={() => setDayPopover(null)}>
          <div className="editor-card" onClick={(e) => e.stopPropagation()}>
            <div className="editor-head">
              <span>{dayPopover}</span>
              <button className="btn btn-sm" onClick={() => setDayPopover(null)}>✕</button>
            </div>
            <DayShiftsBlock dateISO={dayPopover} />
          </div>
        </div>
      )}

      {editing && (
        <ShiftEditor date={editing.date} shift={editing.shift} sites={state.sites}
          onSave={save} onDelete={del} onClose={() => setEditing(null)} />
      )}

      {toast && <div className="save-toast">✓ Turno salvato</div>}
    </>
  );
}
