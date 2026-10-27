import React, { useMemo, useRef, useState } from 'react';
import { shiftsToConfirm, weekdayOf } from '../lib/calc.js';
import { WEEKDAYS_IT } from '../lib/defaults.js';
import { updateShift } from '../lib/store.js';
import Portal from '../lib/Portal.jsx';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import SiteAvatar from './SiteAvatar.jsx';

const MAX_ROWS = 5;

function shortDate(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS_IT[weekdayOf(y, m, d)].toLowerCase()} ${d}/${m}`;
}

// "Confermi?": i turni finiti da poco, segnati in anticipo, chiedono se sono andati così.
// Fatto = confermato; Orario = correggi inizio/fine; Non fatto = annullato (resta nel
// calendario barrato e non conta nei guadagni).
export default function ConfirmShiftsCard({ state, setState, now }) {
  const list = useMemo(() => shiftsToConfirm(state.shifts, now), [state.shifts, now]);
  const [editing, setEditing] = useState(null); // { id, start, end }
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);
  const confirmAction = useConfirm();

  const showUndo = (shift) => {
    setUndo(shift);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
  };
  // askConfirm: undefined = la risposta è data (vedi shiftsToConfirm)
  const setStatus = async (shift, status) => {
    // "non fatto" toglie il turno da ore e guadagni: un tocco per sbaglio non deve bastare
    if (status === 'cancelled') {
      const site = siteById.get(shift.siteId)?.name ?? 'sede eliminata';
      const ok = await confirmAction(
        `${site}, ${shortDate(shift.date)} ${shift.start}–${shift.end}: resterà nel calendario barrato e non verrà contato in ore e guadagni.`,
        { title: 'Non hai fatto questo turno?', danger: true, confirmLabel: 'Sì, non l\'ho fatto', cancelLabel: 'No, torna indietro' },
      );
      if (!ok) return;
    }
    setState((s) => updateShift(s, shift.id, { status, askConfirm: undefined }));
    if (status === 'cancelled') showUndo(shift);
  };
  const confirmAll = () => setState((s) => list.reduce((acc, sh) => updateShift(acc, sh.id, { status: 'done', askConfirm: undefined }), s));
  const timesValid = !!editing?.start && !!editing?.end && editing.start !== editing.end;
  const saveTimes = () => {
    if (!timesValid) return;
    setState((s) => updateShift(s, editing.id, { start: editing.start, end: editing.end, status: 'done', askConfirm: undefined }));
    setEditing(null);
  };
  // "Annulla" dopo "Non fatto": il turno torna da confermare (non diventa "fatto" in silenzio)
  const undoCancel = () => {
    if (!undo) return;
    setState((s) => updateShift(s, undo.id, { status: undefined, askConfirm: true }));
    setUndo(null);
    clearTimeout(undoTimer.current);
  };

  const undoToast = undo && (
    <Portal>
      <div className="undo-toast">
        <span>Segnato come non fatto</span>
        <button className="undo-btn" onClick={undoCancel}>Annulla</button>
      </div>
    </Portal>
  );
  if (!list.length) return undoToast || null;

  return (
    <div className="panel confirm-shifts">
      <div className="confirm-shifts-head">
        <h2 className="panel-title">{list.length === 1 ? 'Turno da confermare' : `${list.length} turni da confermare`}</h2>
        {list.length > 1 && <button className="btn btn-sm" onClick={confirmAll} disabled={!!editing}>✓ Tutti fatti</button>}
      </div>
      <p className="panel-desc">È andato tutto come previsto? Così i conti del mese sono giusti.</p>
      <div className="confirm-shifts-list">
        {list.slice(0, MAX_ROWS).map((sh) => {
          const site = siteById.get(sh.siteId) ?? { name: 'Sede eliminata', color: '#6b7280' };
          const isEditing = editing?.id === sh.id;
          return (
            <div key={sh.id} className="confirm-shift-row">
              <div className="confirm-shift-info">
                <SiteAvatar site={site} size={18} />
                <span className="confirm-shift-site">{site.name}</span>
                <span className="confirm-shift-when">{shortDate(sh.date)} · {sh.start}–{sh.end}</span>
              </div>
              {isEditing ? (
                <div className="confirm-shift-edit">
                  <input type="time" value={editing.start} aria-label="Inizio" onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
                  <input type="time" value={editing.end} aria-label="Fine" onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
                  <button className="btn btn-sm btn-primary" onClick={saveTimes} disabled={!timesValid}>Salva</button>
                  <button className="btn btn-sm" onClick={() => setEditing(null)}>✕</button>
                  {!timesValid && <span className="confirm-shift-err">Inizio e fine devono essere diversi.</span>}
                </div>
              ) : (
                <div className="confirm-shift-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => setStatus(sh, 'done')}>✓ Fatto</button>
                  <button className="btn btn-sm" onClick={() => setEditing({ id: sh.id, start: sh.start, end: sh.end })}>Orario</button>
                  <button className="btn btn-sm" onClick={() => setStatus(sh, 'cancelled')}>✗ Non fatto</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {list.length > MAX_ROWS && (
        <p className="panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>…e altri {list.length - MAX_ROWS}.</p>
      )}
      {undoToast}
    </div>
  );
}
