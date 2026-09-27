import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';

export default function PendingApproval() {
  const { user, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const recheck = async () => { setChecking(true); await refreshProfile(); setChecking(false); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
        </div>
        <div className="hint hint-info" style={{ marginTop: 8 }}>
          ⏳ Il tuo account (<b>{user?.email}</b>) è in attesa di approvazione.
          Chi ti ha invitato deve attivarlo dal pannello di amministrazione.
        </div>
        <button className="btn btn-primary btn-block" onClick={recheck} disabled={checking}>
          {checking ? '…' : 'Ricontrolla'}
        </button>
        <button className="auth-link" style={{ marginTop: 14 }} onClick={signOut}>Esci</button>
      </div>
    </div>
  );
}
