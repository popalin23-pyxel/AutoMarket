import React, { useState, useEffect, useRef } from 'react';
import { loadState, saveState, resetState } from './lib/store.js';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { fetchCloudState, saveCloudState } from './lib/cloudState.js';
import AuthScreen from './components/AuthScreen.jsx';
import ResetPasswordForm from './components/ResetPasswordForm.jsx';
import PendingApproval from './components/PendingApproval.jsx';
import AdminTab from './components/AdminTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import SitesTab from './components/SitesTab.jsx';
import SummaryTab from './components/SummaryTab.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const now = new Date();

function NotConfigured() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-logo">Turn<span className="accent">io</span></span></div>
        <div className="hint hint-warn" style={{ marginTop: 10 }}>
          L'app non è ancora configurata (mancano le chiavi Supabase). Chi gestisce il progetto deve
          impostare <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { user, isAdmin, isApproved, signOut } = useAuth();
  const [state, setState] = useState(loadState);
  const [active, setActive] = useState('shifts');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [syncError, setSyncError] = useState(false);
  const saveTimer = useRef(null);
  const cloudReady = useRef(false);

  // cache locale sempre aggiornata (funziona anche offline)
  useEffect(() => { saveState(state); }, [state]);

  // al login: carica lo stato cloud, oppure — se è il primo accesso di questo
  // utente e su questo dispositivo ci sono già dati locali — li adotta come suoi
  useEffect(() => {
    if (!user || !isApproved) { cloudReady.current = false; return; }
    let alive = true;
    (async () => {
      try {
        const cloud = await fetchCloudState(user.id);
        if (!alive) return;
        if (cloud) {
          setState(cloud.state);
        } else {
          await saveCloudState(user.id, state); // prima volta: pubblica lo stato locale attuale
        }
        cloudReady.current = true;
      } catch (e) {
        console.warn('Turnio: sync cloud iniziale fallita', e);
        setSyncError(true);
      }
    })();
    return () => { alive = false; };
  }, [user, isApproved]); // eslint-disable-line react-hooks/exhaustive-deps

  // a ogni modifica, sincronizza sul cloud (con un piccolo debounce)
  useEffect(() => {
    if (!user || !isApproved || !cloudReady.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await saveCloudState(user.id, state); setSyncError(false); }
      catch (e) { console.warn('Turnio: sync cloud fallita', e); setSyncError(true); }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [state, user, isApproved]);

  const goToMonth = (y, m) => { setYear(y); setMonth(m); setActive('shifts'); };

  const doLogout = async () => {
    await signOut();
    setState(resetState()); // non lasciare i dati dell'account sul dispositivo condiviso
  };

  const TABS = [
    { id: 'shifts', label: 'Turni' },
    { id: 'summary', label: 'Riepilogo' },
    { id: 'sites', label: 'Sedi' },
    { id: 'history', label: 'Storico' },
    { id: 'settings', label: 'Impostazioni' },
    ...(isAdmin ? [{ id: 'admin', label: '⚡ Admin' }] : []),
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
        </div>
        <div className="header-right">
          {syncError && <span className="sync-flag" title="Sincronizzazione non riuscita, riprovo automaticamente">⚠ offline</span>}
          <span className="brand-sub">{user?.email}</span>
        </div>
      </header>

      <div className="app-body">
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        {active === 'shifts' && (
          <ShiftsTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth} />
        )}
        {active === 'summary' && (
          <SummaryTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />
        )}
        {active === 'sites' && <SitesTab state={state} setState={setState} />}
        {active === 'history' && <HistoryTab state={state} onOpenMonth={goToMonth} />}
        {active === 'settings' && <SettingsTab state={state} setState={setState} onLogout={doLogout} />}
        {active === 'admin' && isAdmin && <AdminTab />}
      </div>

      <footer className="app-footer">
        Turnio — i tuoi dati sono privati, protetti dal tuo account.
      </footer>
    </div>
  );
}

function Gate() {
  const { configured, loading, session, recovery, isApproved, profileLoading } = useAuth();

  if (!configured) return <NotConfigured />;
  if (loading) return <div className="auth-wrap"><div className="loading-spinner" /></div>;
  if (recovery) return <ResetPasswordForm />;
  if (!session) return <AuthScreen />;
  if (profileLoading) return <div className="auth-wrap"><div className="loading-spinner" /></div>;
  if (!isApproved) return <PendingApproval />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
