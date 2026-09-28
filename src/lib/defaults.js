// Valori di default per Turnio

export const DEFAULT_SETTINGS = {
  taxPercent: 25,      // % accantonata sul fatturato totale (imposte + contributi, in un unico numero)
  rivalsaPercent: 4,   // maggiorazione di default in fattura (es. rivalsa INPS/ENPAPI); modificabile per sede
  displayName: '',     // nome mostrato nel saluto della Home
  monthlyGoal: 0,      // obiettivo di netto mensile (€); 0 = nessun obiettivo impostato
};

// Palette di colori pronti per le sedi (coordinata col tema dell'app)
export const SITE_COLORS = [
  '#2dd4bf', '#f59e0b', '#818cf8', '#fb7185', '#a3e635', '#22d3ee', '#c084fc', '#fbbf24',
];

export const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export const WEEKDAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const WEEKDAYS_IT_LONG = [
  'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica',
];

// '#2dd4bf' -> 'rgba(45, 212, 191, 0.14)'
export function hexToRgba(hex, alpha = 1) {
  const clean = (hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(107, 114, 128, ${alpha})`;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
