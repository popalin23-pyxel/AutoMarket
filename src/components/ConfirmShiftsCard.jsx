import React, { useMemo, useRef, useState } from 'react';
import { shiftsToConfirm, weekdayOf } from '../lib/calc.js';
import { WEEKDAYS_IT } from '../lib/defaults.js';
import { updateShift } from '../lib/store.js';
import Portal from '../lib/Portal.jsx';
import { useConfirm } from '../lib/ConfirmContext.jsx';

const MAX_ROWS = 5;

function shortDate(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS_IT[weekdayOf(y, m, d)]} ${d}/${m}`;
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

  // "Da fare": i turni finiti da confermare, con tre tasti grandi (Fatto / Orario diverso / Non fatto)
  return (
    <>
      <div className="og-todo-h">
        <span className="grp-title">Da fare</span>
        <span className="og-count">{list.length}</span>
        {list.length > 1
          ? <button type="button" className="og-allok" onClick={confirmAll} disabled={!!editing}>✓ Tutti fatti</button>
          : <span className="og-todo-hint">Hai fatto questo turno?</span>}
      </div>
      <div className="ncard og-todo">
        {list.slice(0, MAX_ROWS).map((sh) => {
          const site = siteById.get(sh.siteId) ?? { name: 'Sede eliminata', color: '#6b7280' };
          const isEditing = editing?.id === sh.id;
          return (
            <div key={sh.id} className="og-ti">
              <div className="og-tt">
                <span className="og-dot" style={{ background: site.color }} />
                <b>{shortDate(sh.date)}</b>
                <span className="og-tt-site">· {site.name}</span>
                <span className="og-tt-tm">{sh.start}–{sh.end}</span>
              </div>
              {isEditing ? (
                <div className="og-tb-edit">
                  <input type="time" value={editing.start} aria-label="Inizio" onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
                  <input type="time" value={editing.end} aria-label="Fine" onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
                  <button type="button" className="btn btn-primary" onClick={saveTimes} disabled={!timesValid}>Salva</button>
                  <button type="button" className="btn" onClick={() => setEditing(null)} aria-label="Annulla">✕</button>
                  {!timesValid && <span className="confirm-shift-err">Inizio e fine devono essere diversi.</span>}
                </div>
              ) : (
                <div className="og-tb">
                  <button type="button" className="ok" onClick={() => setStatus(sh, 'done')}>✓ Fatto</button>
                  <button type="button" onClick={() => setEditing({ id: sh.id, start: sh.start, end: sh.end })}>Orario diverso</button>
                  <button type="button" className="no" onClick={() => setStatus(sh, 'cancelled')}>Non fatto</button>
                </div>
              )}
            </div>
          );
        })}
        {list.length > MAX_ROWS && <p className="og-more-note">…e altri {list.length - MAX_ROWS}: li trovi in Turni.</p>}
      </div>
      {undoToast}
    </>
  );
}
