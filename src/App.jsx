import React, { useState, useEffect, useRef, useMemo } from 'react';
import { loadState, saveState, resetState } from './lib/store.js';
import { computeMonthSummary } from './lib/calc.js';
import { loadTheme, applyTheme } from './lib/theme.js';
import { loadAccent, applyAccent } from './lib/accentColor.js';
import { loadDensity, applyDensity } from './lib/density.js';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { ConfirmProvider } from './lib/ConfirmContext.jsx';
import { fetchCloudState, saveCloudState, saveCloudStateSafely } from './lib/cloudState.js';
import AuthScreen from './components/AuthScreen.jsx';
import ResetPasswordForm from './components/ResetPasswordForm.jsx';
import PendingApproval from './components/PendingApproval.jsx';
import AdminTab from './components/AdminTab.jsx';
import DashboardTab from './components/DashboardTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import GuadagniTab from './components/GuadagniTab.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import FiscalSettingsTab from './components/FiscalSettingsTab.jsx';
import NotificheTab from './components/NotificheTab.jsx';
import PrivacyPolicyTab from './components/PrivacyPolicyTab.jsx';
import Icon from './components/icons/Icon.jsx';
import Splash from './components/Splash.jsx';
import OnboardingTour, { needsOnboarding } from './components/OnboardingTour.jsx';

applyTheme(loadTheme()); // applicato subito al caricamento del modulo, prima del primo render
applyAccent(loadAccent());
applyDensity(loadDensity());

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
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const [mergeNotice, setMergeNotice] = useState(false);
  const [syncNotice, setSyncNotice] = useState(false);
  const saveTimer = useRef(null);
  const syncOkTimer = useRef(null);
  const cloudReady = useRef(false);
  const loadedUserId = useRef(null);
  const lastKnownUpdatedAt = useRef(null);

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
          lastKnownUpdatedAt.current = cloud.updatedAt;
        } else {
          lastKnownUpdatedAt.current = await saveCloudState(user.id, state); // prima volta: pubblica lo stato locale attuale
        }
        cloudReady.current = true;
      } catch (e) {
        console.warn('Turnio: sync cloud iniziale fallita', e);
        setSyncStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [user, isApproved]); // eslint-disable-line react-hooks/exhaustive-deps

  // a ogni modifica, sincronizza sul cloud (con un piccolo debounce)
  useEffect(() => {
    if (!user || !isApproved || !cloudReady.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const result = await saveCloudStateSafely(user.id, state, lastKnownUpdatedAt.current);
        lastKnownUpdatedAt.current = result.updatedAt;
        if (result.merged) {
          setState(result.state); // un altro dispositivo aveva scritto nel frattempo: uniti i dati
          setMergeNotice(true);
          setTimeout(() => setMergeNotice(false), 4000);
        }
        setSyncStatus('ok');
        clearTimeout(syncOkTimer.current);
        syncOkTimer.current = setTimeout(() => setSyncStatus('idle'), 1800);
      } catch (e) {
        console.warn('Turnio: sync cloud fallita', e);
        setSyncStatus('error');
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [state, user, isApproved]);

  const goToMonth = (y, m) => { setYear(y); setMonth(m); setActive('calendar'); };

  const doLogout = async () => {
    await signOut();
    setState(resetState()); // non lasciare i dati dell'account sul dispositivo condiviso
  };

  const monthSummary = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, now.getFullYear(), now.getMonth() + 1),
    [state.shifts, state.sites, state.settings],
  );

  const TABS = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'calendar', label: 'Calendario', icon: 'calendar' },
    { id: 'earnings', label: 'Guadagni', icon: 'euro' },
    { id: 'stats', label: 'Statistiche', icon: 'history' },
    { id: 'settings', label: 'Profilo', icon: 'settings' },
  ];

  const initial = (user?.email || '?').trim()[0]?.toUpperCase() || '?';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
          {monthSummary.shiftCount > 0 && (
            <span className="brand-sub">
              Questo mese: €{monthSummary.net.toLocaleString('it-IT', { maximumFractionDigits: 0 })} netto
            </span>
          )}
        </div>
        <div className="header-right">
          {syncStatus !== 'idle' && (
            <button type="button" className={`sync-dot sync-${syncStatus}`}
              onClick={() => { setSyncNotice(true); setTimeout(() => setSyncNotice(false), 2500); }}
              title={syncStatus === 'error' ? 'Sincronizzazione non riuscita, riprovo automaticamente'
                : syncStatus === 'syncing' ? 'Sincronizzazione in corso…' : 'Sincronizzato'} />
          )}
          <button className="notif-bell-btn" onClick={() => setActive('notifications')} title="Notifiche">
            <Icon name="bell" size={16} />
          </button>
          <button className="avatar" style={{ background: avatarColor(user?.email) }}
            onClick={() => setActive('settings')} title={user?.email}>
            {initial}
          </button>
        </div>
      </header>

      <div className="app-body">
        <div key={active} className="tab-fade">
          {active === 'dashboard' && (
            <DashboardTab state={state} userEmail={user?.email} isAdmin={isAdmin} onNavigate={setActive} />
          )}
          {active === 'calendar' && (
            <ShiftsTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth} />
          )}
          {active === 'earnings' && (
            <GuadagniTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth} />
          )}
          {active === 'stats' && <HistoryTab state={state} onOpenMonth={goToMonth} />}
          {active === 'settings' && (
            <SettingsTab state={state} setState={setState} onLogout={doLogout} isAdmin={isAdmin}
              onOpenAdmin={() => setActive('admin')} onOpenFiscal={() => setActive('fiscal')}
              onOpenPrivacy={() => setActive('privacy')} />
          )}
          {active === 'fiscal' && (
            <FiscalSettingsTab state={state} setState={setState} onBack={() => setActive('settings')} />
          )}
          {active === 'admin' && isAdmin && <AdminTab onBack={() => setActive('settings')} />}
          {active === 'privacy' && <PrivacyPolicyTab onBack={() => setActive('settings')} />}
          {active === 'notifications' && (
            <NotificheTab state={state} onBack={() => setActive('dashboard')} />
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`bnav-btn ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
            <span className="bnav-icon"><Icon name={t.icon} size={20} /></span>
            <span className="bnav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {showOnboarding && <OnboardingTour onDone={() => setShowOnboarding(false)} />}

      {mergeNotice && (
        <div className="save-toast">🔗 Dati uniti da un altro dispositivo</div>
      )}

      {syncNotice && (
        <div className="save-toast">
          {syncStatus === 'error' ? '⚠️ Sincronizzazione non riuscita, riprovo automaticamente'
            : syncStatus === 'syncing' ? '⏳ Sincronizzazione in corso…' : '✓ Sincronizzato'}
        </div>
      )}
    </div>
  );
}

function Gate({ onShowPrivacy }) {
  const { configured, loading, session, recovery, isApproved, profileLoading } = useAuth();

  if (!configured) return <NotConfigured />;
  if (loading) return <Splash />;
  if (recovery) return <ResetPasswordForm />;
  if (!session) return <AuthScreen onShowPrivacy={onShowPrivacy} />;
  if (profileLoading) return <Splash />;
  if (!isApproved) return <PendingApproval />;
  return <Shell />;
}

export default function App() {
  const [showPrivacyPublic, setShowPrivacyPublic] = useState(false);

  if (showPrivacyPublic) {
    return (
      <div className="auth-wrap">
        <PrivacyPolicyTab onBack={() => setShowPrivacyPublic(false)} />
      </div>
    );
  }

  return (
    <AuthProvider>
      <ConfirmProvider>
        <Gate onShowPrivacy={() => setShowPrivacyPublic(true)} />
      </ConfirmProvider>
    </AuthProvider>
  );
}
