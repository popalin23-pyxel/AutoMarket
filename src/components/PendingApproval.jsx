import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import Icon from './icons/Icon.jsx';
import BrandLogo from './BrandLogo.jsx';
import { InstallBanner } from './InstallSheet.jsx';
import { PRIVACY_EMAIL } from '../lib/legal.js';

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
          <BrandLogo height={44} />
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
              Il tuo account (<b>{user?.email}</b>) non è attivo in questo momento.
              Se pensi che sia un errore, scrivi a <b>{PRIVACY_EMAIL}</b>; quando è di nuovo attivo, tocca il tasto qui sotto.
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-block" onClick={recheck} disabled={checking}>
          {checking ? '…' : offline ? 'Riprova' : 'Ricontrolla'}
        </button>
        <button className="auth-link" style={{ marginTop: 14 }} onClick={signOut}>Esci</button>
      </div>
      <InstallBanner />
    </div>
  );
}
