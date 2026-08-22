import React, { useRef, useState } from 'react';
import { exportBackup, importBackup, resetState } from '../lib/store.js';

export default function DataTab({ state, setState }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBackup(file);
      setState(imported);
      setMsg({ type: 'info', text: `Backup importato: ${imported.staff.length} persone, ${imported.unavailability.length} indisponibilità.` });
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    } finally {
      e.target.value = ''; // consente di reimportare lo stesso file
    }
  };

  const doReset = () => {
    if (!confirm('Sicuro di voler cancellare TUTTI i dati (personale, turni, regole, indisponibilità)? Operazione irreversibile.')) return;
    setState(resetState());
    setMsg({ type: 'info', text: 'Tutti i dati sono stati azzerati.' });
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Dati & Backup</h2>
      <p className="panel-desc">
        I dati sono salvati solo in questo dispositivo. Usa il backup per spostarli
        su un altro dispositivo (es. dal PC al telefono) o per tenerne una copia di sicurezza.
      </p>

      {msg && <div className={`hint hint-${msg.type}`}>{msg.text}</div>}

      <div className="stats-row">
        <div className="stat"><div className="stat-label">Personale</div><div className="stat-value">{state.staff.length}</div></div>
        <div className="stat"><div className="stat-label">Turni</div><div className="stat-value">{Object.keys(state.shifts).length}</div></div>
        <div className="stat"><div className="stat-label">Ruoli</div><div className="stat-value">{Object.keys(state.roles).length}</div></div>
        <div className="stat"><div className="stat-label">Indisponibilità</div><div className="stat-value">{state.unavailability.length}</div></div>
      </div>

      <div className="form-row">
        <button className="btn btn-primary" onClick={() => exportBackup(state)}>
          ⬇ Esporta backup (.json)
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ Importa backup
        </button>
        <button className="btn btn-danger" onClick={doReset}>
          Azzera tutti i dati
        </button>
        <input
          ref={fileRef} type="file" accept="application/json,.json"
          onChange={doImport} style={{ display: 'none' }}
        />
      </div>

      <div className="hint hint-info" style={{ marginBottom: 0 }}>
        <b>Come spostare i dati sul telefono:</b> sul PC premi “Esporta backup”, invia il
        file al telefono (email/WhatsApp/cloud), aprilo qui con “Importa backup”.
        <br />L’importazione <b>sostituisce</b> i dati attuali su questo dispositivo.
      </div>
    </div>
  );
}
