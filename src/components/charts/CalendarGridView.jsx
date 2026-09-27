import React from 'react';
import { weekdayOf, monthDays, shiftsOnDay } from '../../lib/calc.js';
import { WEEKDAYS_IT } from '../../lib/defaults.js';

// Vista a griglia tradizionale del mese, con puntini colorati per sede.
export default function CalendarGridView({ year, month, shifts, siteById, holidaySet, today, onDayClick }) {
  const days = monthDays(year, month);
  const firstWd = weekdayOf(year, month, 1); // 0 = lunedì
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="panel cal-grid-panel">
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
          return (
            <button key={i} type="button"
              className={`cal-cell ${isWeekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => onDayClick(dateISO)}>
              <span className="cal-cell-num">{d}</span>
              {dayShifts.length > 0 && (
                <span className="cal-cell-dots">
                  {dayShifts.slice(0, 4).map((sh, k) => (
                    <span key={k} className="cal-dot" style={{ background: siteById.get(sh.siteId)?.color ?? '#6b7280' }} />
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
