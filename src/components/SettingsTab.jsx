import React, { useRef, useState } from 'react';
import { updateSettings, exportBackup, importBackup, resetState } from '../lib/store.js';
import NumberInput from './NumberInput.jsx';

export default function SettingsTab({ state, setState }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

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

  const doReset = () => {
    if (!confirm('Sicuro di voler cancellare TUTTI i dati (sedi, turni, impostazioni)? Operazione irreversibile.')) return;
    setState(resetState());
    setMsg({ type: 'info', text: 'Tutti i dati sono stati azzerati.' });
  };

  return (
    <>
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
          I dati restano solo su questo dispositivo. Esporta un backup per spostarli su un altro
          telefono/PC o per tenerne una copia di sicurezza.
        </p>
        {msg && <div className={`hint hint-${msg.type}`}>{msg.text}</div>}
        <div className="form-row">
          <button className="btn btn-primary" onClick={() => exportBackup(state)}>⬇ Esporta backup (.json)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importa backup</button>
          <button className="btn btn-danger" onClick={doReset}>Azzera tutti i dati</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} />
        </div>
      </div>
    </>
  );
}
