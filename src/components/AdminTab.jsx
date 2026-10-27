import React, { useEffect, useState } from 'react';
import { fetchAllProfiles, updateProfile } from '../lib/adminStore.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import { checkServerUpgrade, listAllReports, setReportStatus, deleteReport } from '../lib/serverData.js';
import { UPGRADE_SQL_2 } from '../lib/cloudState.js';
import { versionLabel } from '../lib/version.js';

const STATUS_LABEL = { nuovo: 'Nuova', visto: 'Vista', risolto: 'Risolta' };

// Aggiornamento del database per la versione 1.5 (copie giornaliere e segnalazioni): finché non è
// stato eseguito, qui c'è lo script da copiare nel SQL Editor di Supabase.
function UpgradeCard() {
  const [check, setCheck] = useState(null);
  const [copied, setCopied] = useState(false);
  const run = () => checkServerUpgrade().then(setCheck).catch(() => setCheck(null));
  useEffect(() => { run(); }, []);
  if (!check || (check.backups && check.reports)) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(UPGRADE_SQL_2); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };
  return (
    <div className="panel upgrade-card">
      <h2 className="panel-title">Da fare: aggiornare il database</h2>
      <p className="panel-desc">
        Le copie automatiche giornaliere e le segnalazioni funzionano dopo questo passaggio, una volta sola:
      </p>
      <ol className="upgrade-steps">
        <li>Tocca "Copia lo script".</li>
        <li>Apri <b>supabase.com</b> → il progetto di Turnio → <b>SQL Editor</b> → <b>New query</b>.</li>
        <li>Incolla e premi <b>Run</b>. Deve comparire "Success".</li>
        <li>Torna qui e tocca "Controlla di nuovo".</li>
      </ol>
      <div className="upgrade-actions">
        <button type="button" className="btn btn-primary" onClick={copy}>{copied ? '✓ Copiato' : 'Copia lo script'}</button>
        <button type="button" className="btn" onClick={run}>Controlla di nuovo</button>
      </div>
      <textarea className="paste-textarea upgrade-sql" readOnly rows={6} value={UPGRADE_SQL_2} onFocus={(e) => e.target.select()} />
    </div>
  );
}

// Le segnalazioni inviate dagli utenti con "Segnala un problema".
function ReportsPanel({ onCountChange }) {
  const confirmAction = useConfirm();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [show, setShow] = useState('open'); // 'open' | 'all'

  const load = () => listAllReports().then((r) => { setRows(r); setError(null); }).catch((e) => { setError(e); setRows([]); });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (rows) onCountChange?.(rows.filter((r) => r.status === 'nuovo').length); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (r, status) => {
    try { await setReportStatus(r.id, status); setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x))); }
    catch (e) { setError(e); }
  };
  const remove = async (r) => {
    if (!(await confirmAction('La segnalazione verrà eliminata per sempre.', { title: 'Eliminare la segnalazione?', danger: true, confirmLabel: 'Elimina' }))) return;
    try { await deleteReport(r.id); setRows((rs) => rs.filter((x) => x.id !== r.id)); }
    catch (e) { setError(e); }
  };

  if (error?.missing) return null; // database da aggiornare: c'è il riquadro sopra
  const list = (rows ?? []).filter((r) => show === 'all' || r.status !== 'risolto');
  return (
    <div className="panel">
      <h2 className="panel-title">Segnalazioni</h2>
      <div className="filter-row" style={{ marginBottom: 10 }}>
        <button type="button" className={`filter-chip ${show === 'open' ? 'active' : ''}`} onClick={() => setShow('open')}>Da guardare</button>
        <button type="button" className={`filter-chip ${show === 'all' ? 'active' : ''}`} onClick={() => setShow('all')}>Tutte</button>
      </div>
      {error && <div className="hint hint-warn">{error.message}</div>}
      {rows === null ? <p className="panel-desc">Caricamento…</p> : list.length === 0 ? (
        <p className="panel-desc" style={{ marginBottom: 0 }}>{show === 'open' ? 'Nessuna segnalazione da guardare.' : 'Nessuna segnalazione.'}</p>
      ) : (
        <div className="report-list">
          {list.map((r) => {
            const c = r.context ?? {};
            return (
              <div key={r.id} className={`report-item st-${r.status}`}>
                <div className="report-head">
                  <span className={`report-status st-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  <span className="report-when">{new Date(r.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="report-from">{r.email || 'utente'}</div>
                <p className="report-msg">{r.message}</p>
                {r.screenshot && (
                  <button type="button" className="report-thumb" onClick={() => setZoom(r.screenshot)} aria-label="Ingrandisci la foto">
                    <img src={r.screenshot} alt="Foto allegata" />
                  </button>
                )}
                <details className="report-details">
                  <summary>Dati tecnici · {c.versione || 'versione ?'} · {c.dispositivo || ''}</summary>
                  <ul>
                    {c.schermo && <li>Schermo: {c.schermo} · tema {c.tema}</li>}
                    {c.pagine?.length > 0 && <li>Ultime pagine: {c.pagine.join(' → ')}</li>}
                    {c.sincronizzazione && <li>Sincronizzazione: {c.sincronizzazione}{c.online === false ? ' · senza connessione' : ''}</li>}
                    {c.quanti && <li>Dati: {c.quanti.sedi} sedi, {c.quanti.turni} turni, {c.quanti.cestino} nel cestino</li>}
                    {c.errori?.length > 0 && <li>Errori: {c.errori.map((e) => e.text).join(' | ')}</li>}
                    {c.browser && <li className="report-ua">{c.browser}</li>}
                  </ul>
                </details>
                <div className="report-actions">
                  {r.status !== 'visto' && r.status !== 'risolto' && <button type="button" className="btn btn-sm" onClick={() => setStatus(r, 'visto')}>Vista</button>}
                  {r.status !== 'risolto'
                    ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setStatus(r, 'risolto')}>✓ Risolta</button>
                    : <button type="button" className="btn btn-sm" onClick={() => setStatus(r, 'visto')}>Riapri</button>}
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(r)}>Elimina</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {zoom && (
        <div className="editor-overlay" onClick={() => setZoom(null)}>
          <img className="report-zoom" src={zoom} alt="Foto allegata ingrandita" />
        </div>
      )}
    </div>
  );
}

export default function AdminTab({ onBack, onReportsCount }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> { role, approved } non ancora salvato

  const load = async () => {
    setError(null);
    try { setRows(await fetchAllProfiles()); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const draftFor = (row) => drafts[row.id] ?? { role: row.role, approved: row.approved };
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draftFor(rows.find((r) => r.id === id)), ...patch } }));

  const save = async (row) => {
    setSavingId(row.id);
    setError(null);
    try {
      const draft = draftFor(row);
      await updateProfile(row.id, draft);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...draft } : r)));
      setDrafts((d) => { const n = { ...d }; delete n[row.id]; return n; });
    } catch (e) { setError(e.message); }
    finally { setSavingId(null); }
  };

  return (
    <>
    {onBack && <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>‹ Altro</button>}
    <UpgradeCard />
    <ReportsPanel onCountChange={onReportsCount} />
    <div className="panel">
      <h2 className="panel-title">⚡ Utenti</h2>
      <p className="panel-desc">Approva i nuovi account e assegna i ruoli. Finché un utente non è "Approvato" non può usare Turnio.</p>

      {error && <div className="hint hint-warn">{error}</div>}

      {rows === null ? (
        <p style={{ color: 'var(--text-dim)' }}>Caricamento…</p>
      ) : (
        <div className="admin-list">
          {rows.map((row) => {
            const draft = draftFor(row);
            const dirty = draft.role !== row.role || draft.approved !== row.approved;
            const isSelf = row.id === user?.id;
            return (
              <div key={row.id} className="admin-row">
                <div className="admin-email">
                  {row.email} {isSelf && <span className="admin-you">(tu)</span>}
                </div>
                <div className="admin-controls">
                  <select value={draft.approved ? 'approved' : 'pending'}
                    onChange={(e) => setDraft(row.id, { approved: e.target.value === 'approved' })}>
                    <option value="pending">⏳ In attesa</option>
                    <option value="approved">✅ Approvato</option>
                  </select>
                  <select value={draft.role} onChange={(e) => setDraft(row.id, { role: e.target.value })}>
                    <option value="user">Utente</option>
                    <option value="admin">👑 Amministratore</option>
                  </select>
                  <button className="btn btn-sm btn-primary" onClick={() => save(row)} disabled={!dirty || savingId === row.id}>
                    {savingId === row.id ? '…' : 'Salva'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <p className="app-version">Turnio · versione {versionLabel()}</p>
    </>
  );
}
