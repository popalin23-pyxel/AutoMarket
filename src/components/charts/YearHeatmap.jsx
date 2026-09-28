import React, { useMemo } from 'react';
import { hoursOfShift } from '../../lib/calc.js';
import { WEEKDAYS_IT } from '../../lib/defaults.js';

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function YearHeatmap({ year, shifts }) {
  const hoursByDate = useMemo(() => {
    const map = new Map();
    for (const sh of shifts) {
      if (!sh.date?.startsWith(String(year))) continue;
      map.set(sh.date, (map.get(sh.date) || 0) + hoursOfShift(sh));
    }
    return map;
  }, [shifts, year]);

  const { weeks, maxHours } = useMemo(() => {
    const start = new Date(year, 0, 1);
    const startWd = (start.getDay() + 6) % 7; // lun=0
    start.setDate(start.getDate() - startWd);
    const end = new Date(year, 11, 31);

    const cols = [];
    let cursor = new Date(start);
    let max = 0;
    while (cursor <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const inYear = cursor.getFullYear() === year;
        const iso = isoLocal(cursor);
        const h = inYear ? (hoursByDate.get(iso) || 0) : null;
        if (h) max = Math.max(max, h);
        week.push({ iso, inYear, hours: h });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(week);
    }
    return { weeks: cols, maxHours: max };
  }, [year, hoursByDate]);

  const levelFor = (h) => {
    if (!h) return 0;
    const ratio = h / (maxHours || 1);
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  const bg = (level) => (level === 0 ? undefined : `rgba(var(--accent-rgb), ${(0.18 + level * 0.18).toFixed(2)})`);

  return (
    <div>
      <div className="heatmap-scroll">
        <div className="heatmap-wdays">
          {WEEKDAYS_IT.map((w, i) => <span key={i}>{i % 2 === 0 ? w : ''}</span>)}
        </div>
        <div className="heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`heatmap-cell ${!day.inYear ? 'out' : ''}`}
                  style={day.inYear ? { background: bg(levelFor(day.hours)) } : undefined}
                  title={day.inYear ? `${day.iso}${day.hours ? ` · ${day.hours}h` : ''}` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>meno</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="heatmap-cell" style={{ background: bg(l) || 'rgba(var(--ink), 0.06)' }} />
        ))}
        <span>più</span>
      </div>
    </div>
  );
}
