// Versione dell'app (impostata da vite.config.js al momento della pubblicazione).
/* global __APP_VERSION__, __APP_COMMIT__, __APP_BUILT__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const APP_COMMIT = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : '';
export const APP_BUILT = typeof __APP_BUILT__ !== 'undefined' ? __APP_BUILT__ : '';

// "1.5.0 del 27/10/2026"
export function versionLabel() {
  const day = APP_BUILT ? new Date(APP_BUILT).toLocaleDateString('it-IT') : '';
  return day ? `${APP_VERSION} del ${day}` : APP_VERSION;
}

// Che telefono/computer è (per la cronologia delle modifiche e le segnalazioni).
export function deviceLabel() {
  try {
    const ua = navigator.userAgent || '';
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    let kind = 'Computer';
    if (/iPhone|iPod/.test(ua)) kind = 'iPhone';
    else if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) kind = 'iPad';
    else if (/Android/.test(ua)) kind = /Mobile/.test(ua) ? 'Android' : 'Tablet Android';
    return standalone ? `${kind} (app)` : `${kind} (browser)`;
  } catch { return 'Dispositivo'; }
}
