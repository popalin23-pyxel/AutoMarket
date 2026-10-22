import React from 'react';
import { weekdayOf, monthDays, shiftsOnDay } from '../../lib/calc.js';
import { WEEKDAYS_IT, dayMarkKind, hexToRgba } from '../../lib/defaults.js';

// Vista a griglia tradizionale del mese, con puntini colorati per sede
// (dorato per le prestazioni occasionali, che non hanno una sede).
export default function CalendarGridView({ year, month, shifts, occasionalWork = [], dayMarks = [], siteById, holidaySet, today, stamping = false, onDayClick }) {
  const days = monthDays(year, month);
  const firstWd = weekdayOf(year, month, 1); // 0 = lunedì
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={`panel cal-grid-panel ${stamping ? 'stamping' : ''}`}>
      <div className="cal-grid-head">
        {WEEKDAYS_IT.map((w) => <div key={w} className="cal-grid-head-cell">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} className="cal-cell empty" />;
          const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const wd = weekdayOf(year, month, d);
          const holiday = holidaySet.has(`${month}-${d}`);
          const isWeekend = wd >= 5 || holiday;
          const isToday = dateISO === today;
          const dayShifts = shiftsOnDay(shifts, dateISO);
          const dayOccasional = shiftsOnDay(occasionalWork, dateISO);
          const mark = shiftsOnDay(dayMarks, dateISO)[0];
          const markKind = mark ? dayMarkKind(mark.kind) : null;
          return (
            <button key={i} type="button"
              className={`cal-cell ${isWeekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${isToday ? 'today' : ''} ${mark ? 'marked' : ''}`}
              style={markKind ? { background: hexToRgba(markKind.color, 0.16), borderColor: hexToRgba(markKind.color, 0.45) } : undefined}
              title={markKind?.label}
              onClick={() => onDayClick(dateISO)}>
              {markKind && <span className="cal-cell-mark" aria-label={markKind.label}>{markKind.icon}</span>}
              <span className="cal-cell-num">{d}</span>
              {(dayShifts.length > 0 || dayOccasional.length > 0) && (
                <span className="cal-cell-dots">
                  {dayShifts.slice(0, 4).map((sh, k) => (
                    <span key={k} className={`cal-dot ${sh.status === 'cancelled' ? 'cancelled' : ''}`}
                      style={{ background: siteById.get(sh.siteId)?.color ?? '#6b7280' }} />
                  ))}
                  {dayOccasional.slice(0, 4 - dayShifts.length).map((o, k) => (
                    <span key={`o${k}`} className="cal-dot" style={{ background: 'var(--gold)' }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
