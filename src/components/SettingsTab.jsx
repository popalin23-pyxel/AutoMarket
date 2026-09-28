import React, { useRef, useState } from 'react';
import { updateSettings, exportBackup, importBackup, importBackupFromText, resetState } from '../lib/store.js';
import { loadTheme, applyTheme } from '../lib/theme.js';
import { loadAccent, applyAccent, ACCENT_COLORS } from '../lib/accentColor.js';
import { loadDensity, applyDensity } from '../lib/density.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import NumberInput from './NumberInput.jsx';

export default function SettingsTab({ state, setState, onLogout, isAdmin, onOpenAdmin, onOpenFiscal }) {
  const { user, updatePassword, deleteAccount } = useAuth();
  const confirmAction = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [theme, setTheme] = useState(loadTheme);
  const [accent, setAccent] = useState(loadAccent);
  const [density, setDensity] = useState(loadDensity);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const setDisplayName = (v) => setState((s) => updateSettings(s, { displayName: v }));
  const setMonthlyGoal = (v) => setState((s) => updateSettings(s, { monthlyGoal: v === '' ? 0 : v }));

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

  const doReset = async () => {
    const ok = await confirmAction('Sicuro di voler cancellare TUTTI i dati (sedi, turni, impostazioni)? Operazione irreversibile.',
      { title: 'Azzerare tutti i dati', danger: true, confirmLabel: 'Azzera tutto' });
    if (!ok) return;
    setState(resetState());
    setMsg({ type: 'info', text: 'Tutti i dati sono stati azzerati.' });
  };

  const doDeleteAccount = async () => {
    const ok = await confirmAction(
      'Il tuo account e TUTTI i tuoi dati (turni, sedi, impostazioni, backup) verranno cancellati per sempre, su ogni dispositivo. Non si può annullare.',
      { title: 'Eliminare il tuo account', danger: true, confirmLabel: 'Elimina definitivamente' },
    );
    if (!ok) return;
    setDeleting(true);
    try { await deleteAccount(); }
    catch (err) { setMsg({ type: 'warn', text: err.message }); setDeleting(false); }
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
        <h2 className="panel-title">Aspetto</h2>
        <p className="panel-desc">Scegli come vuoi vedere l'app.</p>
        <div className="theme-switch">
          <button className={`theme-opt ${theme === 'light' ? 'active' : ''}`} onClick={() => { applyTheme('light'); setTheme('light'); }}>
            ☀️ Chiaro
          </button>
          <button className={`theme-opt ${theme === 'dark' ? 'active' : ''}`} onClick={() => { applyTheme('dark'); setTheme('dark'); }}>
            🌙 Scuro
          </button>
        </div>

        <div className="field-label" style={{ marginTop: 16, marginBottom: 8 }}>Colore principale</div>
        <div className="accent-row">
          {ACCENT_COLORS.map((c) => (
            <button key={c.id} className={`accent-swatch ${accent === c.id ? 'active' : ''}`}
              style={{ background: c.swatch }} title={c.label}
              onClick={() => { applyAccent(c.id); setAccent(c.id); }} />
          ))}
        </div>

        <div className="field-label" style={{ marginTop: 16, marginBottom: 8 }}>Densità</div>
        <div className="theme-switch">
          <button className={`theme-opt ${density === 'comfortable' ? 'active' : ''}`}
            onClick={() => { applyDensity('comfortable'); setDensity('comfortable'); }}>
            Comoda
          </button>
          <button className={`theme-opt ${density === 'compact' ? 'active' : ''}`}
            onClick={() => { applyDensity('compact'); setDensity('compact'); }}>
            Compatta
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Account</h2>
        <p className="panel-desc">Accesso effettuato come <b>{user?.email}</b>. I tuoi dati sono privati e sincronizzati con il cloud.</p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">Il tuo nome (mostrato nel saluto della Home)</label>
          <input type="text" value={state.settings.displayName} placeholder="es. Alin"
            onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', minWidth: 0 }} />
        </div>

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

        {isAdmin && (
          <button className="btn btn-block" style={{ marginTop: 14 }} onClick={onOpenAdmin}>⚡ Pannello Amministrazione</button>
        )}
        <button className="btn btn-danger" style={{ marginTop: 14 }} onClick={onLogout}>Esci</button>

        <button className="danger-link" style={{ marginTop: 16 }} onClick={doDeleteAccount} disabled={deleting}>
          {deleting ? 'Eliminazione in corso…' : 'Elimina il mio account e tutti i dati'}
        </button>
      </div>

      <div className="panel">
        <h2 className="panel-title">Tasse e rivalsa</h2>
        <p className="panel-desc">
          Aliquota, contributi e rivalsa che l'app usa per stimare il netto — con la spiegazione di come
          si arriva al risultato.
        </p>
        <button className="btn btn-block" onClick={onOpenFiscal}>📐 Impostazioni fiscali →</button>
      </div>

      <div className="panel">
        <h2 className="panel-title">Obiettivo mensile</h2>
        <p className="panel-desc">
          Quanto vorresti guadagnare (netto) questo mese. Lo vedrai come barra di avanzamento nella Home.
          Lascia 0 per nascondere l'obiettivo.
        </p>
        <div className="field">
          <label className="field-label">Obiettivo netto (€)</label>
          <NumberInput value={state.settings.monthlyGoal} onChange={setMonthlyGoal} min={0} max={99999} allowEmpty />
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
