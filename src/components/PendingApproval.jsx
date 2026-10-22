import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import Icon from './icons/Icon.jsx';

export default function PendingApproval() {
  const { user, refreshProfile, signOut, profile, profileError } = useAuth();
  // profilo mai letto e server irraggiungibile: è un problema di connessione, non di approvazione
  const offline = profileError && !profile;
  const [checking, setChecking] = useState(false);

  const recheck = async () => { setChecking(true); await refreshProfile(); setChecking(false); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
        </div>
        <div className="hint hint-info" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="hourglass" size={16} className="inline-icon" style={{ flexShrink: 0, marginTop: 2 }} />
          {offline ? (
            <span>
              Non riesco a verificare il tuo account (<b>{user?.email}</b>): controlla la connessione
              e riprova. I tuoi dati sono al sicuro.
            </span>
          ) : (
            <span>
              Il tuo account (<b>{user?.email}</b>) è in attesa di approvazione.
              Chi ti ha invitato deve attivarlo dal pannello di amministrazione.
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-block" onClick={recheck} disabled={checking}>
          {checking ? '…' : offline ? 'Riprova' : 'Ricontrolla'}
        </button>
        <button className="auth-link" style={{ marginTop: 14 }} onClick={signOut}>Esci</button>
      </div>
    </div>
  );
}
