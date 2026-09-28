import React, { useState, useEffect, useRef } from 'react';
import { loadState, saveState, resetState } from './lib/store.js';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { fetchCloudState, saveCloudState } from './lib/cloudState.js';
import AuthScreen from './components/AuthScreen.jsx';
import ResetPasswordForm from './components/ResetPasswordForm.jsx';
import PendingApproval from './components/PendingApproval.jsx';
import AdminTab from './components/AdminTab.jsx';
import DashboardTab from './components/DashboardTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import SitesTab from './components/SitesTab.jsx';
import SummaryTab from './components/SummaryTab.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const now = new Date();
const AVATAR_PALETTE = ['#2dd4bf', '#f59e0b', '#818cf8', '#fb7185', '#a3e635', '#22d3ee', '#c084fc', '#fbbf24'];

function avatarColor(email) {
  let hash = 0;
  for (const ch of email || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

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
  const [active, setActive] = useState('dashboard');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [syncError, setSyncError] = useState(false);
  const saveTimer = useRef(null);
  const cloudReady = useRef(false);
  const loadedUserId = useRef(null);

  // cache locale sempre aggiornata (funziona anche offline)
  useEffect(() => { saveState(state); }, [state]);

  // al login: carica lo stato cloud, oppure — se è il primo accesso di questo
  // utente e su questo dispositivo ci sono già dati locali — li adotta come suoi.
  // Va eseguito una sola volta per utente: Supabase genera un nuovo oggetto
  // `session`/`user` a ogni refresh del token (es. quando il telefono torna in
  // foreground dopo aver aperto il selettore file), e senza questa guardia
  // l'effetto ripartiva ogni volta sovrascrivendo con i vecchi dati cloud
  // qualunque modifica locale (incluso un backup appena importato).
  useEffect(() => {
    if (!user || !isApproved) { cloudReady.current = false; loadedUserId.current = null; return; }
    if (loadedUserId.current === user.id) return;
    loadedUserId.current = user.id;
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
    { id: 'dashboard', label: 'Home', icon: '📊' },
    { id: 'shifts', label: 'Turni', icon: '📅' },
    { id: 'summary', label: 'Riepilogo', icon: '💶' },
    { id: 'sites', label: 'Sedi', icon: '📍' },
    { id: 'history', label: 'Storico', icon: '🕑' },
    { id: 'settings', label: 'Profilo', icon: '⚙️' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: '⚡' }] : []),
  ];

  const initial = (user?.email || '?').trim()[0]?.toUpperCase() || '?';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
        </div>
        <div className="header-right">
          {syncError && <span className="sync-flag" title="Sincronizzazione non riuscita, riprovo automaticamente">⚠ offline</span>}
          <button className="avatar" style={{ background: avatarColor(user?.email) }}
            onClick={() => setActive('settings')} title={user?.email}>
            {initial}
          </button>
        </div>
      </header>

      <div className="app-body">
        {active === 'dashboard' && <DashboardTab state={state} userEmail={user?.email} />}
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

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`bnav-btn ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
            <span className="bnav-icon">{t.icon}</span>
            <span className="bnav-label">{t.label}</span>
          </button>
        ))}
      </nav>
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
