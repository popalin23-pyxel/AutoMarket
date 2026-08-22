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

// Piani/reparti della struttura. Ogni persona può coprire uno o più piani.
export const DEFAULT_FLOORS = [{ id: 'p1', name: 'Piano 1' }];

export const DEFAULT_RULES = {
  max_nights: 6,       // max notti al mese per persona
  max_work_streak: 6,  // max giorni lavorativi consecutivi
  max_weekly_hours: 48, // tetto ore settimanali (conformità)
  prefer_alt_mp: true, // (legacy) alterna Mattina/Pomeriggio
  genMode: 'count',    // 'count' (persone) | 'hours' (ore) | 'rotation' (sequenza ciclica)
  // Copertura per piano → ruolo → turno → { feriale, weekend }. Vedi buildCoverage().
  coverage: {},
  // Copertura in ORE/giorno per piano → ruolo → { feriale, weekend }. Vedi buildCoverageHours().
  coverageHours: {},
  // Sequenza ciclica di turni per ruolo, es. { OSS: ['P','M','N','S','R'] }
  sequences: {},
};

// Ore di copertura di default per un piano: 0 per ogni ruolo (l'utente imposta).
export function defaultFloorHours(roles) {
  const cov = {};
  for (const role of Object.keys(roles)) cov[role] = { weekday: 0, weekend: 0 };
  return cov;
}
export function buildCoverageHours(floors, roles) {
  return Object.fromEntries(floors.map((f) => [f.id, defaultFloorHours(roles)]));
}

// Sequenza di default per ruolo = elenco turni ammessi al ruolo (già ordinato).
export function defaultSequences(roles) {
  return Object.fromEntries(Object.entries(roles).map(([role, codes]) => [role, [...codes]]));
}

// Copertura di default per un singolo piano: 1 persona per ruolo su ogni turno
// ammesso a quel ruolo (feriale e weekend), 0 dove il turno non è ammesso.
export function defaultFloorCoverage(roles, shifts) {
  const working = Object.keys(shifts).filter((c) => shifts[c]?.working);
  const cov = {};
  for (const role of Object.keys(roles)) {
    cov[role] = {};
    for (const c of working) {
      const allowed = (roles[role] ?? []).includes(c);
      cov[role][c] = { weekday: allowed ? 1 : 0, weekend: allowed ? 1 : 0 };
    }
  }
  return cov;
}

// Copertura di default per un elenco di piani.
export function buildCoverage(floors, roles, shifts) {
  return Object.fromEntries(floors.map((f) => [f.id, defaultFloorCoverage(roles, shifts)]));
}

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
