import React, { useEffect, useRef, useState } from 'react';
import { sendReport, listMyReports } from '../lib/serverData.js';
import { versionLabel, APP_COMMIT, deviceLabel } from '../lib/version.js';
import { recentErrors } from '../lib/errorLog.js';
import { loadTheme } from '../lib/theme.js';
import { loadAccent } from '../lib/accentColor.js';
import { visibleTrash } from '../lib/history.js';
import Icon from './icons/Icon.jsx';

const STATUS = { nuovo: 'Inviata', visto: 'Vista', risolto: 'Risolta' };

// Foto dello schermo rimpicciolita (max 1280 px, JPEG): resta sotto ~300 KB anche da un telefono recente.
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile.')); };
    img.src = url;
  });
}

// Altro → Segnala un problema: il messaggio arriva nella pagina Amministrazione, con i dati
// tecnici utili a capire (versione, telefono, pagine aperte, ultimi errori) ma senza turni né guadagni.
export default function ReportPage({ state, user, recentPages = [], syncStatus }) {
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { type, text }
  const [mine, setMine] = useState(null);
  const fileRef = useRef(null);

  const loadMine = () => listMyReports(user.id).then(setMine).catch(() => setMine(null));
  useEffect(() => { if (user?.id) loadMine(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto(await shrinkImage(file)); } catch (err) { setResult({ type: 'warn', text: err.message }); }
  };

  const send = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setResult(null);
    const context = {
      versione: versionLabel(),
      commit: APP_COMMIT,
      dispositivo: deviceLabel(),
      browser: navigator.userAgent,
      schermo: `${window.innerWidth}×${window.innerHeight}`,
      tema: `${loadTheme()} · ${loadAccent()}`,
      online: navigator.onLine,
      sincronizzazione: syncStatus,
      pagine: recentPages,
      errori: recentErrors(),
      quanti: { sedi: state.sites.length, turni: state.shifts.length, cestino: visibleTrash(state).length },
    };
    try {
      await sendReport({ userId: user.id, email: user.email, message: message.trim(), context, screenshot: photo });
      setMessage('');
      setPhoto(null);
      setResult({ type: 'info', text: 'Grazie! La segnalazione è arrivata. Qui sotto vedi quando viene letta e risolta.' });
      loadMine();
    } catch (err) {
      setResult({ type: 'warn', text: navigator.onLine ? err.message : 'Sei senza connessione: riprova quando torna internet.' });
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="ncard report-card">
        <label className="field-label" htmlFor="report-msg">Cosa è successo?</label>
        <textarea id="report-msg" rows={6} value={message} maxLength={4000}
          placeholder="Es. Ho segnato un turno come fatto ma in Soldi non lo vedo. Ero nella pagina Turni, settimana del 26 ottobre."
          onChange={(e) => setMessage(e.target.value)} />

        <div className="report-photo">
          {photo ? (
            <>
              <img src={photo} alt="Foto dello schermo allegata" />
              <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)}>Togli la foto</button>
            </>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={16} /> Aggiungi una foto dello schermo
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
        </div>

        <p className="panel-desc" style={{ margin: '10px 0' }}>
          Insieme al messaggio inviamo la versione dell'app ({versionLabel()}), il tipo di telefono, le ultime pagine aperte
          e gli eventuali errori. Non inviamo i tuoi turni né i tuoi guadagni.
        </p>
        {result && <div className={`hint hint-${result.type}`}>{result.text}</div>}
        <button type="button" className="btn btn-primary btn-block report-send" onClick={send} disabled={!message.trim() || busy}>
          <Icon name="send" size={18} /> {busy ? 'Invio…' : 'Invia la segnalazione'}
        </button>
      </div>

      {mine && mine.length > 0 && (
        <>
          <div className="grp-title">Le tue segnalazioni</div>
          <div className="lcard">
            {mine.map((r) => (
              <div key={r.id} className="hist-row">
                <span className={`lrow-ic ${r.status === 'risolto' ? 'ic-grn' : r.status === 'visto' ? 'ic-blue' : 'ic-gold'}`}>
                  <Icon name={r.status === 'risolto' ? 'check' : 'alert'} size={18} strokeWidth={2.2} />
                </span>
                <span className="lrow-tx">
                  <span className="hist-t">{r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}</span>
                  <span className="lrow-s" style={{ display: 'block' }}>
                    {new Date(r.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {STATUS[r.status] ?? r.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
