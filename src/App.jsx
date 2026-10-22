import React, { useState, useEffect, useMemo } from 'react';
import { loadState, saveState, resetState } from './lib/store.js';
import { computeMonthProgress } from './lib/calc.js';
import { useNow } from './lib/useNow.js';
import { loadTheme, applyTheme } from './lib/theme.js';
import { loadAccent, applyAccent } from './lib/accentColor.js';
import { loadDensity, applyDensity } from './lib/density.js';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { ConfirmProvider, useConfirm } from './lib/ConfirmContext.jsx';
import { useCloudSync, clearSyncPending } from './lib/useCloudSync.js';
import { useBackClose } from './lib/backStack.js';
import AuthScreen from './components/AuthScreen.jsx';
import ResetPasswordForm from './components/ResetPasswordForm.jsx';
import PendingApproval from './components/PendingApproval.jsx';
import AdminTab from './components/AdminTab.jsx';
import DashboardTab from './components/DashboardTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import GuadagniTab from './components/GuadagniTab.jsx';
import AnalisiTab from './components/AnalisiTab.jsx';
import StudioTab from './components/StudioTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import NotificheTab from './components/NotificheTab.jsx';
import PrivacyPolicyTab from './components/PrivacyPolicyTab.jsx';
import Icon from './components/icons/Icon.jsx';
import Splash from './components/Splash.jsx';
import OnboardingTour, { needsOnboarding } from './components/OnboardingTour.jsx';

applyTheme(loadTheme()); // applicato subito al caricamento del modulo, prima del primo render
applyAccent(loadAccent());
applyDensity(loadDensity());

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
  // sotto-scheda con cui aprire Guadagni/Analisi/Studio da un collegamento (es. "Studio → Sedi").
  // Fa parte della key del contenitore: cambiarla rimonta la scheda sulla sotto-scheda richiesta.
  const [subTab, setSubTab] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  // ora corrente, aggiornata ogni minuto e al ritorno in primo piano: le app restano aperte
  // in memoria anche per giorni, e "questo mese" deve cambiare quando cambia il mese
  const now = useNow();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const [syncNotice, setSyncNotice] = useState(false);

  // cache locale sempre aggiornata (funziona anche offline)
  useEffect(() => { saveState(state); }, [state]);

  // sincronizzazione cloud (vedi lib/useCloudSync.js). Dipende dall'id utente, non
  // dall'oggetto user: Supabase ne crea uno nuovo a ogni rinnovo del token (es. quando
  // l'iPhone riapre l'app) e non deve far ripartire caricamenti o salvataggi.
  const confirmAction = useConfirm();
  const { status: syncStatus, notice: syncMessage, flush: flushSync } = useCloudSync({
    userId: user?.id ?? null, enabled: !!isApproved, state, setState,
  });

  const navigate = (tab, sub = null) => {
    // ritoccare la scheda già aperta (senza sotto-scheda esplicita) non la rimonta:
    // porta solo in cima, senza perdere moduli non ancora salvati
    if (!(tab === active && sub == null)) { setSubTab(sub); setActive(tab); }
    window.scrollTo(0, 0);
  };
  // Indietro (Android): dalle schermate aperte dal Profilo torna al Profilo, dalle altre
  // schede torna alla Home; solo dalla Home esce dall'app.
  const goBackTo = (tab) => { setSubTab(null); setActive(tab); window.scrollTo(0, 0); };
  // (ordine voluto: la voce più interna viene chiusa per prima)
  useBackClose(() => goBackTo('settings'), active === 'admin' || active === 'privacy');
  useBackClose(() => goBackTo('dashboard'), active !== 'dashboard');
  const openMonthSummary = (y, m) => { setYear(y); setMonth(m); navigate('earnings', 'summary'); };
  // azioni della Home: aprono sempre il mese corrente, non l'ultimo mese consultato
  const openCurrentMonth = (tab, sub = null) => {
    const d = new Date();
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    navigate(tab, sub);
  };

  const doLogout = async () => {
    // prima di uscire invia le ultime modifiche: dopo l'uscita i dati vengono tolti dal telefono
    if (!(await flushSync()) && !(await confirmAction(
      'Alcune modifiche non sono ancora salvate sul cloud (connessione assente?). Se esci ora andranno perse.',
      { title: 'Modifiche non salvate', danger: true, confirmLabel: 'Esci comunque', cancelLabel: 'Resta' },
    ))) return;
    await signOut();
    clearSyncPending();
    setState(resetState()); // non lasciare i dati dell'account sul dispositivo condiviso
  };

  // intestazione: netto già guadagnato nel mese (turni finiti), non quello previsto
  const monthProgress = useMemo(
    () => computeMonthProgress(state.shifts, state.sites, state.settings, curYear, curMonth, state.occasionalWork, now),
    [state.shifts, state.sites, state.settings, state.occasionalWork, curYear, curMonth, now],
  );
  const monthSummary = monthProgress.total;

  // Il Profilo (account, aspetto, backup) si apre dall'avatar in alto a destra.
  const TABS = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'calendar', label: 'Calendario', icon: 'calendar' },
    { id: 'earnings', label: 'Guadagni', icon: 'euro' },
    { id: 'analisi', label: 'Analisi', icon: 'chart' },
    { id: 'studio', label: 'Studio', icon: 'briefcase' },
  ];

  const initial = (user?.email || '?').trim()[0]?.toUpperCase() || '?';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
          {(monthSummary.shiftCount > 0 || monthSummary.occasionalCount > 0) && (
            <span className="brand-sub">
              Questo mese: €{monthProgress.done.netTotal.toLocaleString('it-IT', { maximumFractionDigits: 0 })} netto finora
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
          <button className={`notif-bell-btn ${active === 'notifications' ? 'active' : ''}`}
            onClick={() => navigate('notifications')} title="Notifiche" aria-label="Notifiche">
            <Icon name="bell" size={16} />
          </button>
          <button className={`avatar ${['settings', 'admin', 'privacy'].includes(active) ? 'active' : ''}`}
            style={{ background: avatarColor(user?.email) }}
            onClick={() => navigate('settings')} title="Profilo" aria-label="Profilo">
            {initial}
          </button>
        </div>
      </header>

      <div className="app-body">
        <div key={`${active}:${subTab ?? ''}`} className="tab-fade">
          {active === 'dashboard' && (
            <DashboardTab state={state} setState={setState} userEmail={user?.email} isAdmin={isAdmin} onNavigate={navigate}
              onOpenCurrentMonth={openCurrentMonth} />
          )}
          {active === 'calendar' && (
            <ShiftsTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth}
              onNavigate={navigate} />
          )}
          {active === 'earnings' && (
            <GuadagniTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth}
              initialSub={subTab ?? undefined} onNavigate={navigate} />
          )}
          {active === 'analisi' && (
            <AnalisiTab state={state} initialSub={subTab ?? undefined} onOpenMonth={openMonthSummary} />
          )}
          {active === 'studio' && (
            <StudioTab state={state} setState={setState} initialSub={subTab ?? undefined} onNavigate={navigate} />
          )}
          {active === 'settings' && (
            <SettingsTab state={state} setState={setState} onLogout={doLogout} isAdmin={isAdmin}
              onOpenAdmin={() => navigate('admin')} onOpenPrivacy={() => navigate('privacy')}
              onOpenAnagrafica={() => navigate('studio', 'anagrafica')} />
          )}
          {active === 'admin' && isAdmin && <AdminTab onBack={() => navigate('settings')} />}
          {active === 'privacy' && <PrivacyPolicyTab onBack={() => navigate('settings')} />}
          {active === 'notifications' && (
            <NotificheTab state={state} onBack={() => navigate('dashboard')} />
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`bnav-btn ${active === t.id ? 'active' : ''}`} onClick={() => navigate(t.id)}>
            <span className="bnav-icon"><Icon name={t.icon} size={20} /></span>
            <span className="bnav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {showOnboarding && <OnboardingTour onDone={() => setShowOnboarding(false)} />}

      {syncMessage && <div className="save-toast">{syncMessage}</div>}

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
  const { configured, loading, session, recovery, isApproved, profile, profileLoading } = useAuth();

  if (!configured) return <NotConfigured />;
  if (loading) return <Splash />;
  if (recovery) return <ResetPasswordForm />;
  if (!session) return <AuthScreen onShowPrivacy={onShowPrivacy} />;
  // lo Splash solo al primo caricamento: se il profilo è già noto l'app resta montata
  if (profileLoading && !profile) return <Splash />;
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
