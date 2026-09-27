import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';

export default function ResetPasswordForm() {
  const { updatePassword, setRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try { await updatePassword(password); setDone(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
          <span className="auth-tagline">Imposta una nuova password</span>
        </div>

        {done ? (
          <>
            <div className="hint hint-info">Password aggiornata! Ora puoi continuare a usare Turnio.</div>
            <button className="btn btn-primary btn-block" onClick={() => setRecovery(false)}>Continua</button>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="hint hint-warn">{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Nuova password</label>
              <input type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', minWidth: 0 }} required />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label className="field-label">Conferma nuova password</label>
              <input type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} style={{ width: '100%', minWidth: 0 }} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '…' : 'Salva nuova password'}</button>
            <button type="button" className="auth-link" style={{ marginTop: 12 }} onClick={signOut}>Annulla</button>
          </form>
        )}
      </div>
    </div>
  );
}
