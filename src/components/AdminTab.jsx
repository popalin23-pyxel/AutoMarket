import React, { useEffect, useState } from 'react';
import { fetchAllProfiles, updateProfile } from '../lib/adminStore.js';
import { useAuth } from '../lib/AuthContext.jsx';

export default function AdminTab({ onBack }) {
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
    <div className="panel">
      {onBack && <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>‹ Profilo</button>}
      <h2 className="panel-title">⚡ Super Admin</h2>
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
  );
}
