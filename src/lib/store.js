// Store persistente su localStorage — equivalente browser del SQLite/config del desktop.
// Un solo oggetto stato serializzato, con API semplici e id incrementali.

import {
  DEFAULT_SHIFTS, DEFAULT_ROLES, DEFAULT_RULES, DEFAULT_FLOORS, buildCoverage, defaultFloorCoverage,
} from './defaults.js';

const KEY = 'turnify_state_v1';

function freshState() {
  const floors = structuredClone(DEFAULT_FLOORS);
  return {
    staff: [],           // [{ id, name, role, contractHours, preferredShift, floors: [floorId] }]
    unavailability: [],  // [{ id, staffId, day: 'YYYY-MM-DD', kind }]
    shifts: structuredClone(DEFAULT_SHIFTS),
    roles: structuredClone(DEFAULT_ROLES),
    floors,              // [{ id, name }]
    rules: { ...structuredClone(DEFAULT_RULES), coverage: buildCoverage(floors, DEFAULT_ROLES, DEFAULT_SHIFTS) },
    history: [],         // [{ id, name, year, month, savedAt, data }]
    lang: 'it',
    seq: { staff: 1, unav: 1 },
  };
}

// Merge difensivo: garantisce che tutte le chiavi esistano e siano valide
function sanitizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return freshState();
  const shifts = parsed.shifts ?? structuredClone(DEFAULT_SHIFTS);
  const roles = parsed.roles ?? structuredClone(DEFAULT_ROLES);

  // Piani: se assenti (dato pre-piani) usa il default
  const floors = Array.isArray(parsed.floors) && parsed.floors.length > 0
    ? parsed.floors
    : structuredClone(DEFAULT_FLOORS);

  // Copertura: nuova struttura è per-piano (chiavi = id piano). Se manca o è
  // nel vecchio formato (chiavi = codici turno), ricostruisci i default.
  const parsedCov = parsed.rules?.coverage;
  const isNewCoverage = parsedCov && typeof parsedCov === 'object'
    && floors.some((f) => parsedCov[f.id] && typeof parsedCov[f.id] === 'object');
  const coverage = isNewCoverage ? parsedCov : buildCoverage(floors, roles, shifts);

  return {
    ...freshState(),
    ...parsed,
    staff: Array.isArray(parsed.staff) ? parsed.staff : [],
    unavailability: Array.isArray(parsed.unavailability) ? parsed.unavailability : [],
    shifts,
    roles,
    floors,
    rules: { ...DEFAULT_RULES, ...(parsed.rules ?? {}), coverage },
    history: Array.isArray(parsed.history) ? parsed.history : [],
    lang: parsed.lang === 'en' ? 'en' : 'it',
    seq: parsed.seq ?? { staff: 1, unav: 1 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return freshState();
  }
}

// ── Backup / Ripristino (portabilità dei dati tra dispositivi) ──────────
const BACKUP_VERSION = 1;

export function exportBackup(state) {
  const payload = {
    app: 'turnify',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `turnify-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Legge un file di backup e restituisce lo stato pulito (Promise).
// Accetta sia il formato con wrapper { app, state } sia uno stato "nudo".
export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const raw = parsed && parsed.state ? parsed.state : parsed;
        if (parsed && parsed.app && parsed.app !== 'turnify') {
          return reject(new Error('Il file non è un backup di Turnify.'));
        }
        resolve(sanitizeState(raw));
      } catch {
        reject(new Error('File non valido o danneggiato.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Turnify: impossibile salvare lo stato', e);
  }
}

export function resetState() {
  const s = freshState();
  saveState(s);
  return s;
}

// Helper immutabili per aggiornare lo stato (usati con setState di React)

export function addStaff(state, name, role, opts = {}) {
  const id = state.seq.staff;
  return {
    ...state,
    staff: [...state.staff, {
      id, name, role,
      contractHours: Number(opts.contractHours) || 0, // 0 = nessun target
      preferredShift: opts.preferredShift || '',       // '', 'M', 'P', 'N'
      floors: Array.isArray(opts.floors) ? opts.floors : [], // [] = tutti i piani
    }],
    seq: { ...state.seq, staff: id + 1 },
  };
}

// ── Piani / reparti ─────────────────────────────────────────────────────
export function addFloor(state, name) {
  const nm = (name || '').trim();
  if (!nm) return state;
  const id = 'f' + Date.now().toString(36);
  const roles = state.roles, shifts = state.shifts;
  return {
    ...state,
    floors: [...state.floors, { id, name: nm }],
    rules: {
      ...state.rules,
      coverage: { ...state.rules.coverage, [id]: defaultFloorCoverage(roles, shifts) },
    },
  };
}

export function renameFloor(state, id, name) {
  return { ...state, floors: state.floors.map((f) => (f.id === id ? { ...f, name } : f)) };
}

export function removeFloor(state, id) {
  const coverage = { ...state.rules.coverage };
  delete coverage[id];
  return {
    ...state,
    floors: state.floors.filter((f) => f.id !== id),
    rules: { ...state.rules, coverage },
    // rimuove il piano dalle assegnazioni del personale
    staff: state.staff.map((s) => (
      Array.isArray(s.floors) ? { ...s, floors: s.floors.filter((x) => x !== id) } : s
    )),
  };
}

// Imposta la copertura per piano → ruolo → turno → { feriale|weekend }
export function setCoverage(state, floorId, role, code, kind, value) {
  const cov = state.rules.coverage ?? {};
  const floorCov = cov[floorId] ?? {};
  const roleCov = floorCov[role] ?? {};
  const cell = roleCov[code] ?? { weekday: 0, weekend: 0 };
  return {
    ...state,
    rules: {
      ...state.rules,
      coverage: {
        ...cov,
        [floorId]: {
          ...floorCov,
          [role]: { ...roleCov, [code]: { ...cell, [kind]: Math.max(0, Number(value) || 0) } },
        },
      },
    },
  };
}

export function updateStaff(state, id, patch) {
  return {
    ...state,
    staff: state.staff.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function removeStaff(state, id) {
  return {
    ...state,
    staff: state.staff.filter((s) => s.id !== id),
    // rimuove anche le indisponibilità collegate
    unavailability: state.unavailability.filter((u) => u.staffId !== id),
  };
}

export function addUnav(state, staffId, day, kind) {
  const id = state.seq.unav;
  return {
    ...state,
    unavailability: [...state.unavailability, { id, staffId, day, kind }],
    seq: { ...state.seq, unav: id + 1 },
  };
}

export function removeUnav(state, id) {
  return {
    ...state,
    unavailability: state.unavailability.filter((u) => u.id !== id),
  };
}

// ── Storico planning ────────────────────────────────────────────────────
export function saveSchedule(state, data, name) {
  const entry = {
    id: Date.now(),
    name: name || `${data.year}-${String(data.month).padStart(2, '0')}`,
    year: data.year,
    month: data.month,
    savedAt: new Date().toISOString(),
    data,
  };
  return { ...state, history: [entry, ...(state.history ?? [])].slice(0, 60) };
}

export function removeSchedule(state, id) {
  return { ...state, history: (state.history ?? []).filter((h) => h.id !== id) };
}

export function setLang(state, lang) {
  return { ...state, lang: lang === 'en' ? 'en' : 'it' };
}
