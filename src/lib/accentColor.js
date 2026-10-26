// Colore principale dell'app, scelto dall'utente. Salvato sul dispositivo (come il tema).
import { syncBarColor } from './theme.js';

// (chiave nuova col tema rosso: prima l'azzurro veniva salvato da solo per tutti,
// così ora tutti partono dal rosso e chi vuole sceglie di nuovo in Altro → Aspetto)
const KEY = 'turnio_accent_v2';

export const ACCENT_COLORS = [
  { id: 'red', label: 'Rosso', swatch: '#ef4444' },
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
    return ACCENT_COLORS.some((c) => c.id === v) ? v : 'red';
  } catch { return 'red'; }
}

export function applyAccent(id) {
  document.documentElement.setAttribute('data-accent', id);
  syncBarColor();
  try { localStorage.setItem(KEY, id); } catch {}
}
