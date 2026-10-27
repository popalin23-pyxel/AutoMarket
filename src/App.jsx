import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadState, saveState, resetState } from './lib/store.js';
import { computeMonthProgress } from './lib/calc.js';
import { withHistory } from './lib/history.js';
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
import SoldiTab from './components/SoldiTab.jsx';
import SummaryTab from './components/SummaryTab.jsx';
import ExpensesTab from './components/ExpensesTab.jsx';
import EarningsSimulator from './components/EarningsSimulator.jsx';
import AnalisiTab from './components/AnalisiTab.jsx';
import AltroTab from './components/AltroTab.jsx';
import AnagraficaTab from './components/AnagraficaTab.jsx';
import SitesTab from './components/SitesTab.jsx';
import FiscalSettingsTab from './components/FiscalSettingsTab.jsx';
import { SitesMonthPreview, GoalPanel } from './components/WorkPanels.jsx';
import DocumentsPage from './components/DocumentsPage.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import NotificheTab from './components/NotificheTab.jsx';
import PrivacyPolicyTab from './components/PrivacyPolicyTab.jsx';
import AddSheet from './components/AddSheet.jsx';
import HistoryPage from './components/HistoryPage.jsx';
import ReportPage from './components/ReportPage.jsx';
import ServerCopies from './components/ServerCopies.jsx';
import { countNewReports } from './lib/serverData.js';
import SubPage from './components/ui/SubPage.jsx';
import Icon from './components/icons/Icon.jsx';
import Splash from './components/Splash.jsx';
import OnboardingTour, { needsOnboarding } from './components/OnboardingTour.jsx';

applyTheme(loadTheme()); // applicato subito al caricamento del modulo, prima del primo render
applyAccent(loadAccent());
applyDensity(loadDensity());

// Sotto-pagine di Soldi e Altro (si aprono a tutto schermo con "‹ Indietro")
const SUBPAGE_TITLES = {
  soldi: { dettaglio: 'Per sede', spese: 'Spese', grafici: 'Grafici', documenti: 'Esporta e foglio ore', simulatore: 'Simulatore' },
  altro: {
    anagrafica: 'I miei dati', sites: 'Sedi e paghe', fiscal: 'Tasse e cassa', goal: 'Obiettivo', documents: 'Documenti',
    account: 'Account', appearance: 'Aspetto', backup: 'Copia di sicurezza',
    history: 'Modifiche e cestino', report: 'Segnala un problema',
  },
};

// Collegamenti delle vecchie schede (Guadagni, Analisi, Studio, Profilo) alla nuova struttura
function mapRoute(tab, sub) {
  if (tab === 'studio') return ['altro', sub ?? null];
  if (tab === 'settings') return ['altro', null];
  if (tab === 'earnings') {
    return ['soldi', sub === 'sim' ? 'simulatore' : sub === 'expenses' ? 'spese' : null];
  }
  if (tab === 'analisi') return ['soldi', sub ? `grafici/${sub}` : 'grafici'];
  return [tab, sub];
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
  // sotto-pagina aperta in Soldi o Altro (es. 'spese', 'sites'; 'grafici/compare' per un grafico preciso).
  // Fa parte della key del contenitore: cambiarla rimonta la pagina.
  const [subTab, setSubTab] = useState(null);
  // strumento da aprire in Turni (timbro, disponibilità, copia settimana), chiesto da Altro
  const [turniAction, setTurniAction] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [newReports, setNewReports] = useState(0); // segnalazioni da leggere (solo amministratore)
  // ultime pagine aperte, da allegare a "Segnala un problema"
  const recentPages = useRef([]);
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

  // Tutte le modifiche fatte dall'utente passano di qui e lasciano una riga nella cronologia
  // (e ciò che si elimina va nel cestino): vedi lib/history.js. I dati che arrivano dal cloud
  // usano setState diretto: le loro righe le ha già scritte il dispositivo che li ha cambiati.
  const updateState = useCallback(
    (update) => setState((prev) => withHistory(prev, typeof update === 'function' ? update(prev) : update)),
    [],
  );

  // sincronizzazione cloud (vedi lib/useCloudSync.js). Dipende dall'id utente, non
  // dall'oggetto user: Supabase ne crea uno nuovo a ogni rinnovo del token (es. quando
  // l'iPhone riapre l'app) e non deve far ripartire caricamenti o salvataggi.
  const confirmAction = useConfirm();
  const { status: syncStatus, notice: syncMessage, flush: flushSync } = useCloudSync({
    userId: user?.id ?? null, enabled: !!isApproved, state, setState,
  });

  const navigate = (tab0, sub0 = null) => {
    const [tab, mapped] = mapRoute(tab0, sub0);
    let sub = mapped;
    if (tab === 'calendar' && sub) { setTurniAction(sub); sub = null; }
    // ritoccare la pagina già aperta non la rimonta: porta solo in cima, senza perdere
    // moduli non ancora salvati; da una sotto-pagina invece si torna alla pagina principale
    if (!(tab === active && sub == null && subTab == null)) { setSubTab(sub); setActive(tab); }
    window.scrollTo(0, 0);
  };
  // Indietro (Android): da una sotto-pagina torna alla sua pagina, da Privacy e Amministrazione
  // torna ad Altro, dalle altre pagine torna a Oggi; solo da Oggi esce dall'app.
  const goBackTo = (tab) => { setSubTab(null); setActive(tab); window.scrollTo(0, 0); };
  const inSubpage = (active === 'soldi' || active === 'altro') && subTab != null;
  useEffect(() => {
    const page = subTab ? `${active}/${subTab}` : active;
    if (recentPages.current[recentPages.current.length - 1] !== page) recentPages.current = [...recentPages.current, page].slice(-6);
  }, [active, subTab]);
  // segnalazioni da leggere: si ricontano ogni volta che si torna sulla pagina Altro
  useEffect(() => {
    if (isAdmin && active === 'altro' && !subTab) countNewReports().then(setNewReports).catch(() => {});
  }, [isAdmin, active, subTab]);
  // (ordine voluto: la voce più interna viene aggiunta per ultima e chiusa per prima)
  useBackClose(() => goBackTo('dashboard'), active !== 'dashboard');
  useBackClose(() => goBackTo('altro'), active === 'admin' || active === 'privacy');
  useBackClose(() => goBackTo(active), inSubpage);
  const openMonthSummary = (y, m) => { setYear(y); setMonth(m); navigate('soldi'); };
  const [subPage, subArg] = (subTab ?? '').split('/');
  const subPageView = (tab, content) => (
    <SubPage title={SUBPAGE_TITLES[tab][subPage]} onBack={() => goBackTo(tab)}>{content}</SubPage>
  );
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

  // Oggi · Turni · [+ Aggiungi] · Soldi · Altro
  const TABS = [
    { id: 'dashboard', label: 'Oggi', icon: 'sun' },
    { id: 'calendar', label: 'Turni', icon: 'calendar' },
    { id: 'soldi', label: 'Soldi', icon: 'euro' },
    { id: 'altro', label: 'Altro', icon: 'menu' },
  ];
  const tabActive = (id) => id === active || (id === 'altro' && (active === 'admin' || active === 'privacy'));
  const tabButton = (t) => (
    <button key={t.id} className={`bnav-btn ${tabActive(t.id) ? 'active' : ''}`} onClick={() => navigate(t.id)}>
      <span className="bnav-icon"><Icon name={t.icon} size={22} strokeWidth={2} /></span>
      <span className="bnav-label">{t.label}</span>
    </button>
  );
  const flashSaved = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 1400); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
          {(monthSummary.shiftCount > 0 || monthSummary.occasionalCount > 0) && (
            <span className="brand-sub">
              Questo mese: €{monthProgress.done.netTotal.toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 })} netto finora
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
        </div>
      </header>

      <div className="app-body">
        <div key={`${active}:${subTab ?? ''}`} className="tab-fade">
          {active === 'dashboard' && (
            <DashboardTab state={state} setState={updateState} userEmail={user?.email} isAdmin={isAdmin} onNavigate={navigate}
              onOpenCurrentMonth={openCurrentMonth} onAdd={() => setAddOpen(true)} />
          )}
          {active === 'calendar' && (
            <ShiftsTab state={state} setState={updateState} year={year} month={month} setYear={setYear} setMonth={setMonth}
              onNavigate={navigate} action={turniAction} onActionDone={() => setTurniAction(null)} now={now} />
          )}

          {active === 'soldi' && !subPage && (
            <SoldiTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} now={now}
              onOpen={(sub) => navigate('soldi', sub)} />
          )}
          {active === 'soldi' && subPage === 'dettaglio' && subPageView('soldi',
            <SummaryTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />)}
          {active === 'soldi' && subPage === 'spese' && subPageView('soldi', <ExpensesTab state={state} setState={updateState} />)}
          {active === 'soldi' && subPage === 'grafici' && subPageView('soldi',
            <AnalisiTab state={state} initialSub={subArg || undefined} onOpenMonth={openMonthSummary} />)}
          {active === 'soldi' && subPage === 'documenti' && subPageView('soldi',
            <DocumentsPage state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />)}
          {active === 'soldi' && subPage === 'simulatore' && subPageView('soldi', <EarningsSimulator state={state} onNavigate={navigate} />)}

          {active === 'altro' && !subPage && (
            <AltroTab state={state} user={user} isAdmin={isAdmin} newReports={newReports} onOpen={(sub) => navigate('altro', sub)}
              onTool={(t) => openCurrentMonth('calendar', t)} onOpenPrivacy={() => navigate('privacy')}
              onOpenAdmin={() => navigate('admin')} onLogout={doLogout} />
          )}
          {active === 'altro' && subPage === 'anagrafica' && subPageView('altro', <AnagraficaTab state={state} setState={updateState} />)}
          {active === 'altro' && subPage === 'sites' && subPageView('altro', <>
            <SitesTab state={state} setState={updateState} />
            <SitesMonthPreview state={state} onNavigate={navigate} />
          </>)}
          {active === 'altro' && subPage === 'fiscal' && subPageView('altro', <FiscalSettingsTab state={state} setState={updateState} />)}
          {active === 'altro' && subPage === 'goal' && subPageView('altro', <GoalPanel state={state} setState={updateState} />)}
          {active === 'altro' && subPage === 'documents' && subPageView('altro',
            <DocumentsPage state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />)}
          {active === 'altro' && ['account', 'appearance', 'backup'].includes(subPage) && subPageView('altro', <>
            {subPage === 'backup' && <ServerCopies state={state} setState={updateState} userId={user?.id} />}
            <SettingsTab state={state} setState={updateState} onLogout={doLogout} isAdmin={isAdmin} section={subPage} />
          </>)}
          {active === 'altro' && subPage === 'history' && subPageView('altro', <HistoryPage state={state} setState={updateState} />)}
          {active === 'altro' && subPage === 'report' && subPageView('altro',
            <ReportPage state={state} user={user} recentPages={recentPages.current.slice(0, -1)} syncStatus={syncStatus} />)}

          {active === 'admin' && isAdmin && (
            <SubPage title="Amministrazione" onBack={() => goBackTo('altro')}><AdminTab onReportsCount={setNewReports} /></SubPage>
          )}
          {active === 'privacy' && <PrivacyPolicyTab onBack={() => goBackTo('altro')} />}
          {active === 'notifications' && (
            <NotificheTab state={state} onBack={() => navigate('dashboard')} />
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {TABS.slice(0, 2).map(tabButton)}
        <button type="button" className="bnav-btn bnav-add" onClick={() => setAddOpen(true)} aria-label="Aggiungi">
          <span className="bnav-fab"><Icon name="plus" size={28} strokeWidth={2.6} /></span>
          <span className="bnav-label">Aggiungi</span>
        </button>
        {TABS.slice(2).map(tabButton)}
      </nav>

      {addOpen && (
        <AddSheet state={state} setState={updateState} onClose={() => setAddOpen(false)} onSaved={flashSaved}
          onGoSites={() => { setAddOpen(false); navigate('altro', 'sites'); }} />
      )}

      {savedToast && <div className="save-toast">✓ Salvato</div>}

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
