import React, { useState } from 'react';
import { DAY_MARK_KINDS } from '../lib/defaults.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';

// Ferie, malattia, corso, non disponibile: un giorno solo o un periodo (dal… al…).
// Con `mark` si modifica (o elimina) un giorno già segnato.
export default function MarkEditor({ date, mark, onSave, onUpdate, onDelete, onClose }) {
  const [kind, setKind] = useState(mark?.kind ?? 'ferie');
  const [from, setFrom] = useState(mark?.date ?? date);
  const [to, setTo] = useState(mark?.date ?? date);
  const [note, setNote] = useState(mark?.note ?? '');
  useLockBodyScroll();
  useBackClose(onClose);

  const validRange = from && (!to || to >= from);
  const days = validRange && to ? Math.round((new Date(to) - new Date(from)) / 86400000) + 1 : 1;

  const save = () => {
    if (!validRange) return;
    if (mark) onUpdate(mark.id, { kind, note: note.trim() });
    else onSave({ kind, from, to: to || from, note: note.trim() });
  };

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{mark ? `Giorno segnato · ${mark.date}` : 'Ferie e assenze'}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="editor-label">Tipo</div>
        <div className="site-picker">
          {DAY_MARK_KINDS.map((k) => (
            <button key={k.id} type="button" className={`site-pick-btn ${kind === k.id ? 'sel' : ''}`}
              onClick={() => setKind(k.id)}>
              <span>{k.icon}</span>{k.label}
            </button>
          ))}
        </div>

        {!mark && (
          <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="field">
              <label className="field-label">Dal</label>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to && e.target.value > to) setTo(e.target.value); }} />
            </div>
            <div className="field">
              <label className="field-label">Al (compreso)</label>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        {!mark && validRange && days > 1 && (
          <div className="editor-hours-preview" style={{ marginTop: 8 }}>{days} giorni</div>
        )}
        {!validRange && (
          <p className="hint hint-warn" style={{ marginTop: 10 }}>
            {!from ? 'Scegli il giorno di inizio.' : 'La data di fine viene prima di quella di inizio.'}
          </p>
        )}

        <div className="editor-label">Nota (opzionale)</div>
        <input type="text" value={note} placeholder="es. corso BLSD, viaggio"
          onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minWidth: 0 }} />

        <p className="panel-desc" style={{ marginTop: 10, marginBottom: 0 }}>
          Non vale soldi: serve a vedere i giorni sul calendario, contarli nell'anno e a non proporli come liberi nelle disponibilità.
        </p>

        <div className="editor-actions">
          <button className="btn btn-primary btn-block" onClick={save} disabled={!validRange}>Salva</button>
          {mark && <button className="btn btn-danger" onClick={() => onDelete(mark.id)}>Elimina</button>}
        </div>
      </div>
    </div>
    </Portal>
  );
}
