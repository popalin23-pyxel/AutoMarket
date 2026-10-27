import React, { useEffect, useState } from 'react';
import { listServerCopies, fetchServerCopy } from '../lib/serverData.js';
import { sanitizeState, replaceAllData } from '../lib/store.js';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';

function dayLabel(day) {
  const d = new Date(`${day}T00:00:00`);
  return `${WEEKDAYS_IT_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()}`;
}

// Copie automatiche fatte dal server: ogni giorno, alla prima modifica, i dati com'erano prima.
// Si tengono 30 giorni; da qui si può tornare a una di queste copie.
export default function ServerCopies({ state, setState, userId }) {
  const confirmAction = useConfirm();
  const [copies, setCopies] = useState(null);
  const [error, setError] = useState(null);
  const [busyDay, setBusyDay] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!userId) return;
    listServerCopies(userId).then(setCopies).catch((e) => { setError(e); setCopies([]); });
  }, [userId]);

  const restore = async (day) => {
    setBusyDay(day);
    setDone(null);
    try {
      const row = await fetchServerCopy(userId, day);
      if (!row) throw new Error('Copia non trovata.');
      const imported = sanitizeState(row.data);
      const ok = await confirmAction(
        `La copia di ${dayLabel(day).toLowerCase()} (i dati com'erano all'inizio di quel giorno) contiene ${imported.sites.length} sedi e ${imported.shifts.length} turni. `
        + `Sostituirà i dati attuali (${state.sites.length} sedi e ${state.shifts.length} turni), anche sugli altri dispositivi: le modifiche fatte dopo andranno perse.`,
        { title: 'Tornare a questa copia?', danger: true, confirmLabel: 'Ripristina', cancelLabel: 'Annulla' },
      );
      if (!ok) return;
      setState((cur) => replaceAllData(cur, imported));
      setDone(`Ripristinata la copia di ${dayLabel(day).toLowerCase()}.`);
    } catch (e) {
      setError(e);
    } finally { setBusyDay(null); }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Copie automatiche sul server</h2>
      <p className="panel-desc">
        Ogni giorno in cui cambi qualcosa, il server salva da solo i tuoi dati com'erano all'inizio della giornata.
        Si tengono gli ultimi 30 giorni: se qualcosa va storto puoi tornare indietro.
      </p>
      {done && <div className="hint hint-info">{done}</div>}
      {error && <div className="hint hint-warn">{error.message}</div>}
      {copies === null ? (
        <p className="panel-desc">Caricamento…</p>
      ) : copies.length === 0 ? (
        !error && <p className="panel-desc" style={{ marginBottom: 0 }}>Ancora nessuna copia: la prima arriva alla prossima modifica.</p>
      ) : (
        <div className="lcard" style={{ marginBottom: 0 }}>
          {copies.map((c) => (
            <div key={c.day} className="hist-row">
              <span className="lrow-ic ic-blue"><Icon name="cloud" size={18} strokeWidth={2.2} /></span>
              <span className="lrow-tx">
                <span className="hist-t">{dayLabel(c.day)}</span>
                <span className="lrow-s" style={{ display: 'block' }}>dati di inizio giornata</span>
              </span>
              <button type="button" className="pill-btn hist-restore" onClick={() => restore(c.day)} disabled={!!busyDay}>
                {busyDay === c.day ? '…' : 'Ripristina'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
