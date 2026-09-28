// Valori di default per Turnio

export const DEFAULT_SETTINGS = {
  taxPercent: 25,      // % accantonata sul fatturato totale (imposte + contributi, in un unico numero)
  rivalsaPercent: 4,   // maggiorazione di default in fattura (es. rivalsa INPS/ENPAPI); modificabile per sede
  displayName: '',     // nome mostrato nel saluto della Home
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
