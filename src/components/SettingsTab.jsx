import React, { useRef, useState } from 'react';
import { updateSettings, exportBackup, importBackup, importBackupFromText, resetState } from '../lib/store.js';
import { useAuth } from '../lib/AuthContext.jsx';
import NumberInput from './NumberInput.jsx';

export default function SettingsTab({ state, setState, onLogout }) {
  const { user, updatePassword } = useAuth();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const setTax = (v) => setState((s) => updateSettings(s, { taxPercent: v }));
  const setRivalsa = (v) => setState((s) => updateSettings(s, { rivalsaPercent: v }));

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBackup(file);
      setState(imported);
      setMsg({ type: 'info', text: `Backup importato: ${imported.sites.length} sedi, ${imported.shifts.length} turni.` });
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    } finally { e.target.value = ''; }
  };

  const doImportText = () => {
    try {
      const imported = importBackupFromText(pasteText);
      setState(imported);
      setMsg({ type: 'info', text: `Backup importato: ${imported.sites.length} sedi, ${imported.shifts.length} turni.` });
      setPasteText('');
      setPasteOpen(false);
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    }
  };

  const doReset = () => {
    if (!confirm('Sicuro di voler cancellare TUTTI i dati (sedi, turni, impostazioni)? Operazione irreversibile.')) return;
    setState(resetState());
    setMsg({ type: 'info', text: 'Tutti i dati sono stati azzerati.' });
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 6) { setPwMsg({ type: 'warn', text: 'Almeno 6 caratteri.' }); return; }
    if (pw !== pw2) { setPwMsg({ type: 'warn', text: 'Le due password non coincidono.' }); return; }
    setPwBusy(true);
    try {
      await updatePassword(pw);
      setPwMsg({ type: 'info', text: 'Password aggiornata.' });
      setPw(''); setPw2('');
    } catch (err) {
      setPwMsg({ type: 'warn', text: err.message });
    } finally { setPwBusy(false); }
  };

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Account</h2>
        <p className="panel-desc">Accesso effettuato come <b>{user?.email}</b>. I tuoi dati sono privati e sincronizzati con il cloud.</p>

        <form onSubmit={changePassword} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label className="field-label">Nuova password</label>
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Conferma</label>
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button className="btn" disabled={pwBusy}>{pwBusy ? '…' : 'Cambia password'}</button>
        </form>
        {pwMsg && <div className={`hint hint-${pwMsg.type}`} style={{ marginTop: 10, marginBottom: 0 }}>{pwMsg.text}</div>}

        <button className="btn btn-danger" style={{ marginTop: 14 }} onClick={onLogout}>Esci</button>
      </div>

      <div className="panel">
        <h2 className="panel-title">Tasse e rivalsa</h2>
        <p className="panel-desc">
          Percentuale che l'app accantona sul fatturato totale (imposte + contributi in un unico numero,
          da adattare al tuo regime fiscale) e maggiorazione di default applicata in fattura.
        </p>
        <div className="form-row">
          <div className="field">
            <label className="field-label">Tasse (%)</label>
            <NumberInput value={state.settings.taxPercent} onChange={setTax} min={0} max={100} />
          </div>
          <div className="field">
            <label className="field-label">Rivalsa default (%)</label>
            <NumberInput value={state.settings.rivalsaPercent} onChange={setRivalsa} min={0} max={100} />
          </div>
        </div>
        <div className="hint hint-info" style={{ marginBottom: 0 }}>
          Ogni sede può avere una rivalsa diversa da questa (impostabile nella scheda "Sedi").
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Dati & Backup</h2>
        <p className="panel-desc">
          I tuoi dati sono sincronizzati sul tuo account. Esporta comunque un backup ogni tanto,
          come copia di sicurezza personale.
        </p>
        {msg && <div className={`hint hint-${msg.type}`}>{msg.text}</div>}
        <div className="form-row">
          <button className="btn btn-primary" onClick={() => exportBackup(state)}>⬇ Esporta backup (.json)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importa backup (file)</button>
          <button className="btn" onClick={() => setPasteOpen((v) => !v)}>📋 Importa da testo incollato</button>
          <button className="btn btn-danger" onClick={doReset}>Azzera tutti i dati</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} />
        </div>

        {pasteOpen && (
          <div style={{ marginTop: 12 }}>
            <p className="panel-desc" style={{ marginTop: 0 }}>
              Se il selettore file non funziona, incolla qui sotto tutto il contenuto del file di backup (.json)
              e tocca "Importa testo incollato".
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='{"app":"turnio", ...}'
              rows={6}
              style={{ width: '100%', minWidth: 0, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={doImportText} disabled={!pasteText.trim()}>
              Importa testo incollato
            </button>
          </div>
        )}
      </div>
    </>
  );
}
