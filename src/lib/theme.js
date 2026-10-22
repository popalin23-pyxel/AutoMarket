// Preferenza tema (chiaro/scuro) salvata sul dispositivo, non sincronizzata sul cloud.
const KEY = 'turnio_theme';

export function loadTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

// colore della barra di stato del telefono (Android, Safari): uguale allo sfondo dell'app
const BAR_COLOR = { light: '#eef7fd', dark: '#081210' };

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme] ?? BAR_COLOR.light);
  try { localStorage.setItem(KEY, theme); } catch {}
}
