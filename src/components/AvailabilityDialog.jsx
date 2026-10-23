import React, { useEffect, useMemo, useState } from 'react';
import { freeDays, availabilityText, monthDays, todayISO } from '../lib/calc.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';

// "Le mie disponibilità": i giorni liberi di un periodo in un messaggio da mandare alle
// strutture (WhatsApp, email…). Il testo si può ritoccare prima di inviarlo.
export default function AvailabilityDialog({ state, year, month, onClose }) {
  const today = todayISO();
  const pad = (n) => String(n).padStart(2, '0');
  const viewedEnd = `${year}-${pad(month)}-${pad(monthDays(year, month))}`;
  const viewedStart = `${year}-${pad(month)}-01`;
  // di base il mese che si sta guardando (da oggi in poi); se è passato, il mese prossimo
  const [from, setFrom] = useState(() => (viewedEnd < today ? today : (viewedStart > today ? viewedStart : today)));
  const [to, setTo] = useState(() => {
    if (viewedEnd >= today) return viewedEnd;
    const n = new Date(); const ny = n.getMonth() === 11 ? n.getFullYear() + 1 : n.getFullYear(); const nm = (n.getMonth() + 1) % 12 + 1;
    return `${ny}-${pad(nm)}-${pad(monthDays(ny, nm))}`;
  });
  const [partial, setPartial] = useState(false);
  const [copied, setCopied] = useState(false);
  useLockBodyScroll();
  useBackClose(onClose);

  const validRange = !!from && !!to && from <= to;
  const days = useMemo(() => (from && to && from <= to
    ? freeDays(state.shifts, state.dayMarks, from, to, { includePartial: partial, today }) : []),
  [state.shifts, state.dayMarks, from, to, partial, today]);
  const generated = useMemo(() => availabilityText(days, { name: (state.settings.displayName || '').trim() }), [days, state.settings.displayName]);
  const [text, setText] = useState(generated);
  useEffect(() => { setText(generated); setCopied(false); }, [generated]);

  const share = async () => {
    try { await navigator.share({ text }); } catch (e) { if (e?.name !== 'AbortError') copy(); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Le mie disponibilità</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="panel-desc">
          I giorni senza turni, ferie o assenze (e non di smonto dopo una notte), pronti da mandare alle strutture.
        </p>
        <div className="form-row" style={{ marginBottom: 6 }}>
          <div className="field"><label className="field-label">Dal</label>
            <input type="date" value={from} min={today} onChange={(e) => {
              const v = e.target.value;
              setFrom(v);
              // spostando l'inizio dopo la fine, la fine va alla fine di quel mese
              if (v && to && v > to) { const [yy, mm] = v.split('-').map(Number); setTo(`${yy}-${pad(mm)}-${pad(monthDays(yy, mm))}`); }
            }} /></div>
          <div className="field"><label className="field-label">Al</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
          Anche i giorni liberi solo in parte (dopo un turno di mattina o prima di uno di pomeriggio)
        </label>

        {!validRange ? (
          <p className="hint hint-warn" style={{ marginTop: 10 }}>Scegli le due date: la fine non può venire prima dell'inizio.</p>
        ) : (
          <>
            <div className="editor-label">Messaggio ({days.length} {days.length === 1 ? 'giorno' : 'giorni'})</div>
            <textarea className="availability-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
          </>
        )}

        <div className="editor-actions">
          {canShare && <button className="btn btn-primary btn-block" onClick={share} disabled={!validRange}>📤 Condividi</button>}
          <button className={`btn btn-block ${canShare ? '' : 'btn-primary'}`} onClick={copy} disabled={!validRange}>{copied ? '✓ Copiato' : '📋 Copia'}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
