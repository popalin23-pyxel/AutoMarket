import { useEffect, useRef, useState } from 'react';
import { fetchCloudState, saveCloudState, saveCloudStateSafely } from './cloudState.js';
import { mergeStates, sameData } from './mergeState.js';
import { sanitizeState, resetState } from './store.js';

// Utente con modifiche locali non ancora confermate sul cloud (es. app chiusa prima del
// salvataggio): al riavvio vanno unite ai dati cloud, non sostituite.
const PENDING_KEY = 'turnio_sync_pending';
const readPending = () => { try { return localStorage.getItem(PENDING_KEY); } catch { return null; } };
const writePending = (userId) => {
  try { if (userId) localStorage.setItem(PENDING_KEY, userId); else localStorage.removeItem(PENDING_KEY); } catch {}
};
// Account a cui appartengono i dati salvati sul telefono: se accede un account diverso
// (es. sessione scaduta e poi accesso con un'altra email) quei dati non vanno adottati.
const OWNER_KEY = 'turnio_state_owner';
const readOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
const writeOwner = (userId) => {
  try { if (userId) localStorage.setItem(OWNER_KEY, userId); else localStorage.removeItem(OWNER_KEY); } catch {}
};
export const clearSyncPending = () => { writePending(null); writeOwner(null); };

const PULL_MIN_INTERVAL = 2000; // evita doppie letture se si esce e rientra di continuo
const INIT_RETRY_DELAYS = [5000, 15000, 30000, 60000]; // poi ogni minuto

// Sincronizzazione con il cloud: caricamento iniziale, salvataggio dopo ogni modifica,
// aggiornamento quando l'app torna in primo piano, salvataggio immediato quando va in
// background. Tutte le operazioni cloud passano da una coda, una alla volta.
export function useCloudSync({ userId, enabled, state, setState }) {
  const [status, setStatus] = useState('idle'); // idle | syncing | ok | error
  const [notice, setNotice] = useState(null);   // testo dell'avviso o null

  const stateRef = useRef(state);
  stateRef.current = state;
  const ready = useRef(false);        // caricamento iniziale riuscito
  const version = useRef(null);       // versione cloud (updated_at in ms) nota a questo dispositivo
  const synced = useRef(null);        // stato che sappiamo già presente sul cloud
  const startState = useRef(null);    // stato locale al momento dell'accesso (non è una "modifica")
  const queue = useRef(Promise.resolve());
  const timer = useRef(null);
  const retryTimer = useRef(null);
  const initTimer = useRef(null);
  const initAttempts = useRef(0);
  const okTimer = useRef(null);
  const noticeTimer = useRef(null);
  const lastPull = useRef(0);
  const active = useRef({ userId: null, enabled: false });
  active.current = { userId, enabled };

  const run = (task) => { queue.current = queue.current.then(task, task); return queue.current; };
  const isCurrent = (uid) => active.current.userId === uid && active.current.enabled;

  const showNotice = (text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };
  const markOk = () => {
    setStatus('ok');
    clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => setStatus('idle'), 1800);
  };

  // Integra nello stato locale un risultato arrivato dal cloud, tenendo le modifiche
  // fatte nel frattempo. `cloudState` è ciò che ora sta sul server.
  const integrate = (cloudState, uid) => {
    const latest = stateRef.current;
    const next = mergeStates(latest, cloudState);
    const changed = !sameData(next, latest);
    const inCloud = sameData(next, cloudState);
    if (changed) {
      if (inCloud) synced.current = next;
      setState(next);
    } else if (inCloud) {
      synced.current = latest;
    }
    if (inCloud) writePending(null); else writePending(uid);
    return { changed, inCloud };
  };

  const init = (uid) => run(async () => {
    if (!isCurrent(uid) || ready.current) return;
    try {
      const cloud = await fetchCloudState(uid);
      if (!isCurrent(uid)) return;
      if (cloud) {
        // i dati cloud possono venire da una versione più vecchia dell'app: sanitizeState
        // riempie i campi mancanti (es. tombstones), altrimenti alcune azioni andrebbero in errore
        const remote = sanitizeState(cloud.state);
        version.current = cloud.version;
        if (readPending() === uid) {
          const merged = mergeStates(stateRef.current, remote, { preferRemoteOnTie: true });
          if (sameData(merged, remote)) { synced.current = merged; writePending(null); }
          setState(merged);
        } else {
          synced.current = remote;
          setState(remote);
        }
      } else {
        // primo accesso di questo account: pubblica i dati presenti sul dispositivo,
        // ma solo se non appartengono a un altro account
        const owner = readOwner();
        const local = owner && owner !== uid ? resetState() : stateRef.current;
        version.current = await saveCloudState(uid, local);
        if (!isCurrent(uid)) return;
        synced.current = local;
        if (local !== stateRef.current) setState(local);
        writePending(null);
      }
      writeOwner(uid);
      ready.current = true;
      initAttempts.current = 0;
      setStatus('idle');
    } catch (e) {
      console.warn('Turnio: caricamento dal cloud non riuscito, riprovo più tardi', e);
      setStatus('error');
      // nuovo tentativo da solo, a intervalli crescenti (anche se l'app resta aperta)
      const delay = INIT_RETRY_DELAYS[Math.min(initAttempts.current, INIT_RETRY_DELAYS.length - 1)];
      initAttempts.current += 1;
      clearTimeout(initTimer.current);
      initTimer.current = setTimeout(() => init(uid), delay);
    }
  });

  const push = (uid) => run(async () => {
    if (!isCurrent(uid) || !ready.current) return;
    const local = stateRef.current;
    if (local === synced.current) return;
    setStatus('syncing');
    try {
      const res = await saveCloudStateSafely(uid, local, version.current);
      if (!isCurrent(uid)) return;
      version.current = res.version;
      if (res.merged) {
        const { changed, inCloud } = integrate(res.state, uid);
        if (changed) showNotice('🔗 Aggiornato con le modifiche dall\'altro dispositivo');
        if (!inCloud) push(uid); // modifiche fatte durante il salvataggio: le invia subito dopo
      } else {
        synced.current = local;
        if (stateRef.current === local) writePending(null);
      }
      markOk();
    } catch (e) {
      console.warn('Turnio: salvataggio sul cloud non riuscito, riprovo più tardi', e);
      setStatus('error');
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => push(uid), 20000);
    }
  });

  const pull = (uid) => run(async () => {
    if (!isCurrent(uid) || !ready.current) return;
    try {
      const cloud = await fetchCloudState(uid);
      if (!isCurrent(uid) || !cloud || cloud.version === version.current) return;
      version.current = cloud.version;
      const { changed, inCloud } = integrate(sanitizeState(cloud.state), uid);
      if (changed) showNotice('🔗 Aggiornato con le modifiche dall\'altro dispositivo');
      if (!inCloud) push(uid); // modifiche locali non ancora sul cloud
    } catch (e) {
      console.warn('Turnio: aggiornamento dal cloud non riuscito', e);
    }
  });

  // accesso / cambio utente: azzera e carica
  useEffect(() => {
    ready.current = false;
    version.current = null;
    synced.current = null;
    initAttempts.current = 0;
    clearTimeout(initTimer.current);
    // lo stato già presente all'accesso non è una "modifica" da salvare
    // (va impostato qui, prima che l'effetto di salvataggio qui sotto lo veda)
    startState.current = state;
    if (!userId || !enabled) return undefined;
    init(userId);
    return undefined;
  }, [userId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // a ogni modifica locale reale: salva sul cloud dopo una breve pausa
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    if (state === synced.current || state === startState.current) return undefined;
    writePending(userId);
    if (!ready.current) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push(userId), 600);
    return () => clearTimeout(timer.current);
  }, [state, userId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // primo piano / background / rete tornata
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    const flush = () => {
      if (ready.current && stateRef.current !== synced.current) { clearTimeout(timer.current); push(userId); }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { flush(); return; }
      if (!ready.current) { init(userId); return; }
      if (Date.now() - lastPull.current < PULL_MIN_INTERVAL) return;
      lastPull.current = Date.now();
      pull(userId);
    };
    const onOnline = () => { if (!ready.current) init(userId); else flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(timer.current); clearTimeout(retryTimer.current); clearTimeout(initTimer.current);
    clearTimeout(okTimer.current); clearTimeout(noticeTimer.current);
  }, []);

  // Invia subito le modifiche in sospeso (es. prima di uscire dall'account).
  // true = sul cloud c'è tutto.
  const flush = async () => {
    if (userId && enabled && ready.current) {
      clearTimeout(timer.current);
      await push(userId);
      await queue.current;
    }
    return readPending() !== userId;
  };

  return { status, notice, flush };
}
