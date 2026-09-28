// Densità del layout (comoda/compatta), salvata sul dispositivo come il tema.
const KEY = 'turnio_density';

export function loadDensity() {
  try { return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable'; } catch { return 'comfortable'; }
}

export function applyDensity(d) {
  document.documentElement.setAttribute('data-density', d);
  try { localStorage.setItem(KEY, d); } catch {}
}
