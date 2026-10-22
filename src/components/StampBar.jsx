import React from 'react';
import Portal from '../lib/Portal.jsx';
import SiteAvatar from './SiteAvatar.jsx';

// Barra della "modalità timbro": si sceglie cosa timbrare (una scorciatoia, un orario a
// scelta o un giorno di ferie/assenza) e poi ogni tocco su un giorno del calendario lo
// aggiunge; un secondo tocco sullo stesso giorno lo toglie.
export function stampLabel(stamp, sites, markKinds = []) {
  if (!stamp) return '';
  if (stamp.type === 'mark') return markKinds.find((k) => k.id === stamp.kind)?.label ?? '';
  const site = sites.find((s) => s.id === stamp.siteId);
  return `${site?.name ?? 'Sede'} ${stamp.start}–${stamp.end}`;
}

export default function StampBar({ sites, favorites, markKinds = [], stamp, setStamp, count, onDone }) {
  const isFav = (f) => stamp?.type === 'shift' && !stamp.custom
    && stamp.siteId === f.siteId && stamp.start === f.start && stamp.end === f.end;
  const custom = stamp?.type === 'shift' && stamp.custom;
  const firstSiteId = sites[0]?.id ?? null;

  const pickCustom = () => setStamp({
    type: 'shift', custom: true,
    siteId: stamp?.type === 'shift' ? stamp.siteId : firstSiteId,
    start: stamp?.type === 'shift' ? stamp.start : '07:00',
    end: stamp?.type === 'shift' ? stamp.end : '14:00',
  });
  const patchCustom = (p) => setStamp({ ...stamp, ...p });
  const customValid = custom && stamp.siteId != null && stamp.start && stamp.end && stamp.start !== stamp.end;

  return (
    <Portal>
      <div className="stamp-bar" role="region" aria-label="Modalità timbro">
        <div className="stamp-bar-head">
          <span className="stamp-bar-title">✋ Modalità timbro</span>
          {count !== 0 && <span className="stamp-bar-count">{count > 0 ? `+${count}` : count}</span>}
          <button className="btn btn-sm btn-primary" onClick={onDone}>Fine</button>
        </div>
        <div className="stamp-bar-hint">
          {stamp && (stamp.type === 'mark' || !custom || customValid)
            ? <>Tocca i giorni per aggiungere <b>{stampLabel(stamp, sites, markKinds)}</b>. Un secondo tocco lo toglie.</>
            : 'Scegli cosa timbrare, poi tocca i giorni del calendario.'}
        </div>
        <div className="stamp-chips">
          {favorites.map((f) => {
            const site = sites.find((s) => s.id === f.siteId);
            if (!site) return null;
            return (
              <button key={f.id} type="button" className={`stamp-chip ${isFav(f) ? 'sel' : ''}`}
                onClick={() => setStamp({ type: 'shift', siteId: f.siteId, start: f.start, end: f.end })}>
                <SiteAvatar site={site} size={16} />
                {f.label || `${site.name} ${f.start}–${f.end}`}
              </button>
            );
          })}
          {sites.length > 0 && (
            <button type="button" className={`stamp-chip ${custom ? 'sel' : ''}`} onClick={pickCustom}>
              ⏱ Altro orario…
            </button>
          )}
          {markKinds.map((k) => (
            <button key={k.id} type="button"
              className={`stamp-chip stamp-chip-mark ${stamp?.type === 'mark' && stamp.kind === k.id ? 'sel' : ''}`}
              style={{ '--mark-color': k.color }}
              onClick={() => setStamp({ type: 'mark', kind: k.id })}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        {custom && (
          <div className="stamp-custom">
            <select value={stamp.siteId ?? ''} onChange={(e) => patchCustom({ siteId: Number(e.target.value) })}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="time" value={stamp.start} onChange={(e) => patchCustom({ start: e.target.value })} aria-label="Inizio" />
            <input type="time" value={stamp.end} onChange={(e) => patchCustom({ end: e.target.value })} aria-label="Fine" />
          </div>
        )}
      </div>
    </Portal>
  );
}
