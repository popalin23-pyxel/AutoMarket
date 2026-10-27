// Ultimi errori dell'app (in memoria e per la sessione), da allegare a "Segnala un problema":
// chi riceve la segnalazione vede cosa è andato storto senza dover chiedere.
const KEY = 'turnio_recent_errors';
const MAX = 8;

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function logError(message) {
  const text = String(message || 'errore sconosciuto').slice(0, 300);
  const list = [{ at: new Date().toISOString(), text }, ...read()].slice(0, MAX);
  try { sessionStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export const recentErrors = () => read();

export function installErrorLog() {
  window.addEventListener('error', (e) => logError(e.message || e.error?.message));
  window.addEventListener('unhandledrejection', (e) => logError(e.reason?.message || String(e.reason)));
}
