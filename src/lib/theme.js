// Preferenza tema (chiaro/scuro) salvata sul dispositivo, non sincronizzata sul cloud.
const KEY = 'turnio_theme';

export function loadTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch {}
}
