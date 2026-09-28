import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import Icon from './icons/Icon.jsx';

export default function AuthScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | forgot | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const reset = () => { setError(null); setInfo(null); };

  const submitLogin = async (e) => {
    e.preventDefault(); reset();
    if (!email || !password) return;
    setBusy(true);
    try { await signIn(email.trim(), password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submitSignup = async (e) => {
    e.preventDefault(); reset();
    if (!email || !password) return;
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      const data = await signUp(email.trim(), password);
      if (!data.session) {
        setInfo('Account creato! Controlla la tua email per confermarlo prima di accedere.');
        setMode('sent');
      }
      // se la conferma email è disattivata, Supabase crea subito la sessione
      // e l'AuthContext passa automaticamente alla app (o alla schermata di attesa approvazione).
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submitForgot = async (e) => {
    e.preventDefault(); reset();
    if (!email) return;
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setInfo('Ti abbiamo inviato un\'email con il link per reimpostare la password.');
      setMode('sent');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const switchTo = (m) => { setMode(m); reset(); setPassword(''); setConfirm(''); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero-icon"><Icon name="calendar" size={26} /></div>
        <div className="auth-brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
          <span className="auth-tagline">Turni e compensi — Partita IVA</span>
        </div>

        {mode === 'sent' ? (
          <div className="hint hint-info" style={{ marginTop: 10 }}>{info}</div>
        ) : (
          <>
            {error && <div className="hint hint-warn">{error}</div>}

            {mode === 'forgot' ? (
              <form onSubmit={submitForgot}>
                <p className="auth-desc">Inserisci l'email con cui ti sei registrato: ti mandiamo un link per reimpostare la password.</p>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label">Email</label>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', minWidth: 0 }} required />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '…' : 'Invia link'}</button>
                <button type="button" className="auth-link" onClick={() => switchTo('login')}>← Torna al login</button>
              </form>
            ) : (
              <form onSubmit={mode === 'login' ? submitLogin : submitSignup}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label">Email</label>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', minWidth: 0 }} required />
                </div>
                <div className="field" style={{ marginBottom: mode === 'signup' ? 12 : 6 }}>
                  <label className="field-label">Password</label>
                  <div className="pw-field">
                    <input type={showPw ? 'text' : 'password'} value={password}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', minWidth: 0 }} required />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)}>{showPw ? '🙈' : '👁'}</button>
                  </div>
                </div>

                {mode === 'signup' && (
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label className="field-label">Conferma password</label>
                    <input type={showPw ? 'text' : 'password'} value={confirm} autoComplete="new-password"
                      onChange={(e) => setConfirm(e.target.value)} style={{ width: '100%', minWidth: 0 }} required />
                  </div>
                )}

                {mode === 'login' && (
                  <button type="button" className="auth-link" style={{ marginBottom: 14 }} onClick={() => switchTo('forgot')}>
                    Password dimenticata?
                  </button>
                )}

                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? '…' : mode === 'login' ? 'Accedi' : 'Crea account'}
                </button>
              </form>
            )}

            {mode !== 'forgot' && (
              <div className="auth-switch">
                {mode === 'login' ? (
                  <>Non hai un account? <button className="auth-link" onClick={() => switchTo('signup')}>Registrati</button></>
                ) : (
                  <>Hai già un account? <button className="auth-link" onClick={() => switchTo('login')}>Accedi</button></>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'sent' && (
          <button className="btn btn-block" style={{ marginTop: 14 }} onClick={() => switchTo('login')}>Torna al login</button>
        )}
      </div>
    </div>
  );
}
