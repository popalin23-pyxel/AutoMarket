import React, { useMemo, useState } from 'react';
import { startOfWeek, endOfWeek, addDaysISO, shiftsInRange, activeShifts, monthDays } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';

export function weekLabel(startISO) {
  const endISO = addDaysISO(startISO, 6);
  const sd = Number(startISO.slice(8)), sm = Number(startISO.slice(5, 7));
  const ed = Number(endISO.slice(8)), em = Number(endISO.slice(5, 7));
  return sm === em
    ? `${sd}–${ed} ${MONTHS_IT[em - 1].slice(0, 3).toLowerCase()}`
    : `${sd} ${MONTHS_IT[sm - 1].slice(0, 3).toLowerCase()} – ${ed} ${MONTHS_IT[em - 1].slice(0, 3).toLowerCase()}`;
}

// Copia i turni di una settimana (lunedì–domenica) del mese aperto nella settimana dopo.
export default function WeekDuplicateDialog({ shifts, year, month, today, onConfirm, onClose }) {
  const pad = (n) => String(n).padStart(2, '0');
  const weeks = useMemo(() => {
    const out = [];
    const last = `${year}-${pad(month)}-${pad(monthDays(year, month))}`;
    for (let ws = startOfWeek(`${year}-${pad(month)}-01`); ws <= last; ws = addDaysISO(ws, 7)) {
      out.push({ start: ws, count: activeShifts(shiftsInRange(shifts, ws, endOfWeek(ws))).length });
    }
    return out;
  }, [shifts, year, month]);
  const [sel, setSel] = useState(() => {
    const cur = weeks.find((w) => w.start === startOfWeek(today) && w.count > 0);
    return (cur ?? weeks.find((w) => w.count > 0))?.start ?? null;
  });
  useLockBodyScroll();
  useBackClose(onClose);

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Duplica una settimana</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="panel-desc">Scegli la settimana da copiare: i turni (stessi giorni, sede e orario) vanno nella settimana dopo. I turni già presenti non vengono doppiati.</p>
        <div className="rate-mode">
          {weeks.map((w) => (
            <label key={w.start} className={`rate-mode-opt ${sel === w.start ? 'sel' : ''} ${w.count === 0 ? 'disabled' : ''}`}>
              <input type="radio" name="dup-week" checked={sel === w.start} disabled={w.count === 0} onChange={() => setSel(w.start)} />
              <span>
                <b>{weekLabel(w.start)}</b>
                <small>{w.count === 0 ? 'nessun turno' : `${w.count} ${w.count === 1 ? 'turno' : 'turni'} → ${weekLabel(addDaysISO(w.start, 7))}`}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="editor-actions">
          <button className="btn btn-primary btn-block" disabled={!sel} onClick={() => onConfirm(sel)}>Duplica</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
