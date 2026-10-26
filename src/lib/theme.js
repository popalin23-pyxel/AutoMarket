// Preferenza tema (chiaro/scuro) salvata sul dispositivo, non sincronizzata sul cloud.
const KEY = 'turnio_theme';

export function loadTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

// colore della barra di stato del telefono (Android, Safari): uguale alla barra in alto
// dell'app, che cambia con il tema e con il colore principale (--bar-color in styles.css)
const BAR_COLOR = { light: '#b91c1c', dark: '#2a1418' };

export function syncBarColor() {
  const root = document.documentElement;
  let c = '';
  try { c = getComputedStyle(root).getPropertyValue('--bar-color').trim(); } catch {}
  const fallback = BAR_COLOR[root.getAttribute('data-theme')] ?? BAR_COLOR.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c || fallback);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncBarColor();
  try { localStorage.setItem(KEY, theme); } catch {}
}
