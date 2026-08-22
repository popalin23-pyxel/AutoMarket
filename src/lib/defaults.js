// Configurazioni di default — equivalenti ai file config/*.json del desktop Turnify 3.3

export const DEFAULT_SHIFTS = {
  M: { description: 'Mattina',     working: true,  hours: 7,  is_night: false },
  P: { description: 'Pomeriggio',  working: true,  hours: 7,  is_night: false },
  N: { description: 'Notte',       working: true,  hours: 10, is_night: true  },
  S: { description: 'Smonto notte', working: false, hours: 0, is_night: false },
  R: { description: 'Riposo',      working: false, hours: 0,  is_night: false },
};

export const DEFAULT_ROLES = {
  OSS:          ['M', 'P', 'N', 'S', 'R'],
  Infermiere:   ['M', 'P', 'S', 'R'],
  Coordinatore: ['M', 'R'],
};

export const DEFAULT_RULES = {
  max_nights: 6,       // max notti al mese per persona
  max_work_streak: 6,  // max giorni lavorativi consecutivi
  prefer_alt_mp: true, // alterna Mattina/Pomeriggio
};

export const UNAV_KINDS = ['ferie', 'malattia', 'permesso', 'indisp'];

export const UNAV_LABELS = {
  ferie:    'Ferie',
  malattia: 'Malattia',
  permesso: 'Permesso',
  indisp:   'Indisponibilità',
};

export const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export const WEEKDAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
