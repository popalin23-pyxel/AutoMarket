import React, { useState, useMemo } from 'react';
import { monthDays, weekdayOf, shiftsOnDay, hoursOfShift, todayISO } from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT } from '../lib/defaults.js';
import { addShift, updateShift, removeShift } from '../lib/store.js';
import ShiftEditor from './ShiftEditor.jsx';

export default function ShiftsTab({ state, setState, year, month, setYear, setMonth }) {
  const [editing, setEditing] = useState(null); // { date, shift: null|obj }
  const days = monthDays(year, month);
  const today = todayISO();
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); };

  const openNew = (dateISO) => setEditing({ date: dateISO, shift: null });
  const openEdit = (dateISO, shift) => setEditing({ date: dateISO, shift });

  const save = (data) => {
    if (editing?.shift) setState((s) => updateShift(s, editing.shift.id, data));
    else setState((s) => addShift(s, data));
    setEditing(null);
  };
  const del = (id) => { setState((s) => removeShift(s, id)); setEditing(null); };

  const monthTotalHours = useMemo(() => {
    let h = 0;
    for (let d = 1; d <= days; d++) {
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const sh of shiftsOnDay(state.shifts, dateISO)) h += hoursOfShift(sh);
    }
    return Math.round(h * 100) / 100;
  }, [state.shifts, year, month, days]);

  return (
    <>
      <div className="panel">
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <div>
            <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
            <span className="month-sub">{monthTotalHours}h totali questo mese</span>
          </div>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>
        <button className="btn btn-sm" onClick={goToday}>Vai a oggi</button>

        {state.sites.length === 0 && (
          <div className="hint hint-warn" style={{ marginTop: 12 }}>
            Prima di registrare i turni, aggiungi almeno una sede nella scheda "Sedi".
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const wd = weekdayOf(year, month, d);
          const isWeekend = wd >= 5;
          const isToday = dateISO === today;
          const dayShifts = shiftsOnDay(state.shifts, dateISO);
          return (
            <div key={d} className={`day-row ${isWeekend ? 'weekend' : ''}`}
              style={{ padding: '10px 14px', ...(isToday ? { background: 'rgba(45,212,191,0.06)' } : {}) }}>
              <div className="day-num">
                <b style={isToday ? { color: 'var(--accent)' } : undefined}>{d}</b>
                <span>{WEEKDAYS_IT[wd]}</span>
              </div>
              <div className="day-shifts">
                {dayShifts.map((sh) => {
                  const site = siteById.get(sh.siteId);
                  return (
                    <div key={sh.id} className="shift-chip" onClick={() => openEdit(dateISO, sh)}>
                      <span className="site-dot" style={{ background: site?.color ?? '#6b7280' }} />
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
            </div>
          );
        })}
      </div>

      {editing && (
        <ShiftEditor date={editing.date} shift={editing.shift} sites={state.sites}
          onSave={save} onDelete={del} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
