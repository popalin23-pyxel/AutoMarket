import React, { useRef, useState } from 'react';
import { exportBackup, importBackup, resetState } from '../lib/store.js';
import {
  getCloudConfig, saveCloudConfig, isCloudConfigured, pullState, pushState, SETUP_SQL,
} from '../lib/cloud.js';

export default function DataTab({ state, setState }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [cloud, setCloud] = useState(getCloudConfig);
  const [cloudMsg, setCloudMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const setCloudField = (k, v) => {
    const next = { ...cloud, [k]: v };
    setCloud(next); saveCloudConfig(next);
  };

  const cloudPush = async () => {
    setBusy(true); setCloudMsg(null);
    try { await pushState(state, cloud); setCloudMsg({ type: 'info', text: 'Dati salvati sul cloud ✓' }); }
    catch (e) { setCloudMsg({ type: 'warn', text: e.message }); }
    finally { setBusy(false); }
  };

  const cloudPull = async () => {
    setBusy(true); setCloudMsg(null);
    try {
      const r = await pullState(cloud);
      if (!r) { setCloudMsg({ type: 'warn', text: 'Nessun dato sul cloud per questo codice team.' }); return; }
      setState(r.state);
      setCloudMsg({ type: 'info', text: `Dati caricati dal cloud ✓ (${new Date(r.updatedAt).toLocaleString('it-IT')})` });
    } catch (e) { setCloudMsg({ type: 'warn', text: e.message }); }
    finally { setBusy(false); }
  };

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

      <h2 className="panel-title" style={{ marginTop: 28 }}>Sincronizzazione cloud (opzionale)</h2>
      <p className="panel-desc">
        Tieni i dati sincronizzati tra più dispositivi tramite un progetto <b>Supabase</b> gratuito.
        Inserisci URL e chiave <i>anon</i> del progetto e un <b>codice team</b> (una password condivisa dal gruppo).
        {' '}Stato: {isCloudConfigured(cloud)
          ? <span className="green">configurato</span>
          : <span style={{ color: 'var(--text-mut)' }}>non configurato</span>}.
      </p>

      {cloudMsg && <div className={`hint hint-${cloudMsg.type}`}>{cloudMsg.text}</div>}

      <div className="form-row">
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label className="field-label">Supabase URL</label>
          <input type="text" value={cloud.url} placeholder="https://xxxx.supabase.co"
            onChange={(e) => setCloudField('url', e.target.value.trim())} />
        </div>
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label className="field-label">Anon key</label>
          <input type="password" value={cloud.key} placeholder="chiave pubblica anon"
            onChange={(e) => setCloudField('key', e.target.value.trim())} />
        </div>
        <div className="field">
          <label className="field-label">Codice team</label>
          <input type="text" value={cloud.team} placeholder="es. reparto-A-2026"
            onChange={(e) => setCloudField('team', e.target.value.trim())} />
        </div>
      </div>

      <div className="form-row" style={{ alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={cloudPush} disabled={busy || !isCloudConfigured(cloud)}>
          ☁ Salva sul cloud
        </button>
        <button className="btn" onClick={cloudPull} disabled={busy || !isCloudConfigured(cloud)}>
          ⬇ Carica dal cloud
        </button>
        <label className="inline-check" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={!!cloud.autoLoad}
            onChange={(e) => setCloudField('autoLoad', e.target.checked)} />
          Carica automaticamente all’avvio
        </label>
      </div>

      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 13 }}>
          Come configurare Supabase (una volta sola)
        </summary>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.7 }}>
          1. Crea un progetto gratuito su <b>supabase.com</b>.<br />
          2. In <b>Project Settings → API</b> copia <b>Project URL</b> e <b>anon public key</b> nei campi qui sopra.<br />
          3. In <b>SQL Editor</b> incolla ed esegui questo script:
          <pre style={{
            background: 'rgba(7,10,18,0.6)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 12, marginTop: 8, overflowX: 'auto',
            fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre',
          }}>{SETUP_SQL}</pre>
          4. Scegli un <b>codice team</b> non banale: chi lo conosce (con URL e chiave) può leggere/scrivere i dati.
          <br />5. Su ogni dispositivo inserisci gli stessi valori; usa “Salva sul cloud” dopo le modifiche e
          “Carica dal cloud” sugli altri dispositivi.
        </div>
      </details>
    </div>
  );
}
