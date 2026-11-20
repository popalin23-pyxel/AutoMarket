// Installazione di Horarya come app (schermata Home). Su Android/Chrome il browser offre un
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
  window.addEventListener('appinstalled', () => { deferredPrompt = null; markInstalled(); notify(); });
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
  if (choice?.outcome === 'accepted') markInstalled();
  return choice?.outcome === 'accepted';
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// iPad: da iPadOS 13 Safari si presenta come un Mac ("Macintosh" nello user agent). L'unico modo
// per riconoscerlo è lo schermo touch: i Mac non ne hanno (maxTouchPoints = 0).
export function devicePlatform(uaIn, navIn) {
  if (typeof navigator === 'undefined' && uaIn == null) return 'desktop';
  const nav = navIn ?? (typeof navigator !== 'undefined' ? navigator : {});
  const ua = uaIn ?? nav.userAgent ?? '';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
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

// Dove è aperto il link: telefono, browser, e se è il browser interno di un'app (WhatsApp,
// Instagram, Facebook…), da cui non si può installare.
// `nav` serve solo ai test (per simulare lo schermo touch dell'iPad).
export function browserInfo(ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '', nav) {
  const platform = devicePlatform(ua, nav);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter|Telegram/i.test(ua)
    || (platform === 'android' && /; wv\)/.test(ua));
  let browser = 'other';
  if (platform === 'ios') {
    if (/CriOS/.test(ua)) browser = 'chrome';
    else if (/FxiOS/.test(ua)) browser = 'firefox';
    else if (/EdgiOS/.test(ua)) browser = 'edge';
    else if (/Safari/.test(ua) && !inApp) browser = 'safari';
  } else if (platform === 'android') {
    if (/SamsungBrowser/.test(ua)) browser = 'samsung';
    else if (/Firefox/.test(ua)) browser = 'firefox';
    else if (/Chrome/.test(ua) && !inApp) browser = 'chrome';
  }
  // iPad: in Safari il tasto Condividi è in alto, non in basso come su iPhone
  const tablet = platform === 'ios' && !/iPhone|iPod/.test(ua);
  return { platform, browser, inApp, tablet };
}

// La finestra "Installa sul telefono" che sale da sola: una volta per apertura e, se si tocca
// "Più tardi", non prima di 3 giorni.
const SHEET_KEY = 'horarya_install_sheet_later';
const SHEET_DAYS = 3;
let shownThisVisit = false;
export function autoInstallSheetDue() {
  if (shownThisVisit || isStandalone() || devicePlatform() === 'desktop') return false;
  try { return Date.now() - (Number(localStorage.getItem(SHEET_KEY)) || 0) > SHEET_DAYS * 86400000; } catch { return true; }
}
export function markAutoInstallSheetShown() { shownThisVisit = true; }
// installata da questo browser: nel browser non la si ripropone per un mese
function markInstalled() {
  try { localStorage.setItem(SHEET_KEY, String(Date.now() + 27 * 86400000)); } catch {}
}
export function installSheetLater() {
  try { localStorage.setItem(SHEET_KEY, String(Date.now())); } catch {}
}
