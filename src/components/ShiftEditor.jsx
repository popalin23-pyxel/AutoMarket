import React, { useState } from 'react';
import { hoursOfShift } from '../lib/calc.js';

export default function ShiftEditor({ date, shift, sites, onSave, onDelete, onClose }) {
  const [siteId, setSiteId] = useState(shift?.siteId ?? sites[0]?.id ?? null);
  const [start, setStart] = useState(shift?.start ?? '07:00');
  const [end, setEnd] = useState(shift?.end ?? '14:00');
  const [note, setNote] = useState(shift?.note ?? '');

  const hours = hoursOfShift({ start, end });
  const canSave = siteId != null && start && end;

  const save = () => {
    if (!canSave) return;
    onSave({ date, siteId, start, end, note: note.trim() });
  };

  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{shift ? 'Modifica turno' : 'Nuovo turno'} · {date}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {sites.length === 0 ? (
          <p className="hint hint-warn">Aggiungi prima una sede nella scheda "Sedi".</p>
        ) : (
          <>
            <div className="editor-label">Sede</div>
            <div className="site-picker">
              {sites.map((s) => (
                <button key={s.id} type="button" className={`site-pick-btn ${siteId === s.id ? 'sel' : ''}`}
                  onClick={() => setSiteId(s.id)}>
                  <span className="site-dot" style={{ background: s.color }} />{s.name}
                </button>
              ))}
            </div>

            <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
              <div className="field">
                <label className="field-label">Inizio</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Fine</label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="editor-hours-preview">
              {hours > 0 ? `${hours}h di turno` : 'orario non valido'}
              {end < start && hours > 0 ? ' · a cavallo di mezzanotte' : ''}
            </div>

            <div className="editor-label">Nota (opzionale)</div>
            <input type="text" value={note} placeholder="es. cambio ultimo minuto"
              onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minWidth: 0 }} />

            <div className="editor-actions">
              <button className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>Salva</button>
              {shift && <button className="btn btn-danger" onClick={() => onDelete(shift.id)}>Elimina</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
