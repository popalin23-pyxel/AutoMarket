import React, { useRef, useState } from 'react';
import { exportBackup, importBackup, parseBackup, resetState, replaceAllData, clearAllData } from '../lib/store.js';
import { roleLabel } from '../lib/defaults.js';
import { loadTheme, applyTheme } from '../lib/theme.js';
import { loadAccent, applyAccent, ACCENT_COLORS } from '../lib/accentColor.js';
import { loadDensity, applyDensity } from '../lib/density.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import { isStandalone } from '../lib/install.js';
import InstallGuide from './InstallGuide.jsx';

// Profilo: tu e l'app (account, aspetto, backup). Ciò che riguarda l'attività
// professionale (anagrafica, sedi, fiscale, obiettivo) sta nella scheda Studio.
// `section` ('account' | 'appearance' | 'backup') mostra una sola parte: nella nuova interfaccia
// ognuna si apre dal suo tasto in Altro.
export default function SettingsTab({ state, setState, onLogout, isAdmin, onOpenAdmin, onOpenPrivacy, onOpenAnagrafica, section }) {
  const show = (s) => !section || section === s;
  const { user, updatePassword, deleteAccount } = useAuth();
  const confirmAction = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [installGuide, setInstallGuide] = useState(false);
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

  const displayName = (state.settings.displayName || '').trim();
  const role = roleLabel(state.settings);

  // Il ripristino sostituisce tutto, anche sugli altri dispositivi: prima si chiede conferma
  // mostrando cosa c'è nel backup e cosa si perde.
  const restore = async ({ state: imported, exportedAt }) => {
    const when = exportedAt ? ` del ${new Date(exportedAt).toLocaleDateString('it-IT')}` : '';
    const ok = await confirmAction(
      `Il backup${when} contiene ${imported.sites.length} sedi e ${imported.shifts.length} turni. Sostituirà tutti i dati attuali `
      + `(${state.sites.length} sedi e ${state.shifts.length} turni), anche sugli altri dispositivi: ciò che hai aggiunto dopo il backup andrà perso.`,
      { title: 'Ripristinare il backup?', danger: true, confirmLabel: 'Ripristina', cancelLabel: 'Annulla' },
    );
    if (!ok) return false;
    setState((cur) => replaceAllData(cur, imported));
    setMsg({ type: 'info', text: `Backup ripristinato: ${imported.sites.length} sedi, ${imported.shifts.length} turni.` });
    return true;
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await restore(await importBackup(file));
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    } finally { e.target.value = ''; }
  };

  const doImportText = async () => {
    try {
      if (await restore(parseBackup(pasteText))) {
        setPasteText('');
        setPasteOpen(false);
      }
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    }
  };

  const doReset = async () => {
    const ok = await confirmAction('Sicuro di voler cancellare TUTTI i dati (sedi, turni, impostazioni), anche la cronologia delle modifiche e il cestino? '
      + 'Resta solo la copia automatica sul server degli ultimi giorni (qui sopra, in "Copie automatiche sul server").',
      { title: 'Azzerare tutti i dati', danger: true, confirmLabel: 'Azzera tutto' });
    if (!ok) return;
    setState(clearAllData); // azzeramento propagato anche agli altri dispositivi
    setMsg({ type: 'info', text: 'Tutti i dati sono stati azzerati.' });
  };

  const doDeleteAccount = async () => {
    const ok = await confirmAction(
      'Il tuo account e TUTTI i tuoi dati (turni, sedi, impostazioni, backup) verranno cancellati per sempre, su ogni dispositivo. Non si può annullare.',
      { title: 'Eliminare il tuo account', danger: true, confirmLabel: 'Elimina definitivamente' },
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAccount();
      setState(resetState()); // non lasciare sul dispositivo i dati dell'account appena cancellato
    } catch (err) { setMsg({ type: 'warn', text: err.message }); setDeleting(false); }
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
      {!section && (
      <div className="panel">
        <h2 className="panel-title">Profilo</h2>
        <div className="profile-id">
          <div className="profile-id-name">{displayName || 'Nome non impostato'}</div>
          <div className="profile-id-sub">{[role, user?.email].filter(Boolean).join(' · ')}</div>
        </div>
        <button className="link-btn" onClick={onOpenAnagrafica}>Nome, ruolo e P.IVA si modificano in Altro → I miei dati →</button>
      </div>
      )}

      {show('account') && (
      <div className="panel">
        <h2 className="panel-title">Account</h2>
        <p className="panel-desc">I tuoi dati sono privati e sincronizzati con il cloud.</p>

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
        {section === 'account' && user?.email && (
          <p className="panel-desc" style={{ marginTop: 12, marginBottom: 0 }}>Accedi con: <b>{user.email}</b></p>
        )}

        {!section && !isStandalone() && (
          <button className="btn btn-block" style={{ marginTop: 14 }} onClick={() => setInstallGuide(true)}>📲 Installa l'app sul telefono</button>
        )}
        {!section && <button className="btn btn-block" style={{ marginTop: 14 }} onClick={onOpenPrivacy}>📄 Privacy Policy</button>}
        {installGuide && <InstallGuide onClose={() => setInstallGuide(false)} />}

        {!section && isAdmin && (
          <button className="btn btn-block" style={{ marginTop: 10 }} onClick={onOpenAdmin}>⚡ Pannello Amministrazione</button>
        )}
        {!section && <button className="btn btn-danger" style={{ marginTop: 14 }} onClick={onLogout}>Esci</button>}
      </div>
      )}

      {show('appearance') && (
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
      )}

      {show('backup') && (
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
              className="paste-textarea"
              style={{ width: '100%', minWidth: 0, fontFamily: 'monospace' }}
            />
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={doImportText} disabled={!pasteText.trim()}>
              Importa testo incollato
            </button>
          </div>
        )}
      </div>
      )}

      {/* errore dell'eliminazione account (es. senza connessione): il messaggio del backup qui non si vede */}
      {section === 'account' && msg && <div className={`hint hint-${msg.type}`}>{msg.text}</div>}
      {show('account') && (
        <button className="danger-link" style={{ marginBottom: 18 }} onClick={doDeleteAccount} disabled={deleting}>
          {deleting ? 'Eliminazione in corso…' : 'Elimina il mio account e tutti i dati'}
        </button>
      )}
    </>
  );
}
