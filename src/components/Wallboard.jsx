import React, { useState } from 'react';
import { weekdayOf } from '../lib/scheduler.js';

// Vista "muro": schermata grande per bacheca/TV con chi è di turno in un giorno,
// raggruppato per piano e per turno. Navigabile giorno per giorno.
export default function Wallboard({ data, shifts, floors, months, weekdays, onClose }) {
  const today = new Date();
  const initial = (today.getFullYear() === data.year && today.getMonth() + 1 === data.month)
    ? Math.min(data.days, today.getDate()) - 1 : 0;
  const [idx, setIdx] = useState(initial);

  const workingCodes = Object.keys(shifts).filter((c) => shifts[c]?.working);
  const floorList = (floors && floors.length) ? floors : [{ id: '', name: '' }];

  // map: floorId -> code -> [nomi]
  const board = {};
  for (const s of Object.values(data.schedule)) {
    const code = s.days[idx];
    if (!shifts[code]?.working) continue;
    const fid = (s.floors && s.floors[idx]) || (floorList[0]?.id ?? '');
    (((board[fid] ??= {})[code] ??= [])).push(`${s.name} (${s.role})`);
  }

  const wd = weekdays[weekdayOf(data.year, data.month, idx + 1)];

  return (
    <div className="wall-overlay">
      <div className="wall-top">
        <button className="btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
        <div className="wall-date">
          <span className="wall-day">{idx + 1}</span>
          <span className="wall-mon">{wd} · {months[data.month - 1]} {data.year}</span>
        </div>
        <button className="btn" onClick={() => setIdx((i) => Math.min(data.days - 1, i + 1))} disabled={idx === data.days - 1}>›</button>
        <button className="btn btn-primary wall-close" onClick={onClose}>✕</button>
      </div>

      <div className="wall-grid">
        {floorList.map((f) => (
          <div key={f.id} className="wall-floor">
            {f.name && <div className="wall-floor-name">{f.name}</div>}
            {workingCodes.map((c) => {
              const names = board[f.id]?.[c] || [];
              if (names.length === 0) return null;
              return (
                <div key={c} className="wall-shift">
                  <span className={`cell cell-${c} wall-code`}>{c}</span>
                  <div className="wall-names">
                    {names.map((n, i) => <span key={i} className="wall-name">{n}</span>)}
                  </div>
                </div>
              );
            })}
            {!board[f.id] && <div className="wall-empty">—</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
