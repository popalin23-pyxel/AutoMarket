// Colore principale dell'app, scelto dall'utente. Salvato sul dispositivo (come il tema).
const KEY = 'turnio_accent';

export const ACCENT_COLORS = [
  { id: 'sky', label: 'Azzurro', swatch: '#38bdf8' },
  { id: 'teal', label: 'Smeraldo', swatch: '#2dd4bf' },
  { id: 'violet', label: 'Viola', swatch: '#a78bfa' },
  { id: 'rose', label: 'Rosa', swatch: '#fb7185' },
  { id: 'amber', label: 'Ambra', swatch: '#fbbf24' },
  { id: 'emerald', label: 'Verde', swatch: '#34d399' },
];

export function loadAccent() {
  try {
    const v = localStorage.getItem(KEY);
    return ACCENT_COLORS.some((c) => c.id === v) ? v : 'sky';
  } catch { return 'sky'; }
}

export function applyAccent(id) {
  document.documentElement.setAttribute('data-accent', id);
  try { localStorage.setItem(KEY, id); } catch {}
}
