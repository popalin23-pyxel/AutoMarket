// Installazione di Turnio come app (schermata Home). Su Android/Chrome il browser offre un
// evento "beforeinstallprompt" che permette di installare con un tocco: va catturato subito
// all'avvio (per questo il modulo è importato da main.jsx). Su iPhone si fa a mano da Condividi.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente banner automatico: lo proponiamo noi al momento giusto
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });
}

export const canPromptInstall = () => !!deferredPrompt;
export function onInstallPromptChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Mostra la finestra di installazione del browser. true = installata.
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  notify();
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function devicePlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const DISMISS_KEY = 'turnio_install_dismissed_at';
const DISMISS_DAYS = 30;
export function installCardDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY)) || 0;
    return Date.now() - at < DISMISS_DAYS * 86400000;
  } catch { return false; }
}
export function dismissInstallCard() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}
