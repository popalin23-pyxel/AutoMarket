// Store persistente su localStorage — equivalente browser del SQLite/config del desktop.
// Un solo oggetto stato serializzato, con API semplici e id incrementali.

import { DEFAULT_SHIFTS, DEFAULT_ROLES, DEFAULT_RULES } from './defaults.js';

const KEY = 'turnify_state_v1';

function freshState() {
  return {
    staff: [],           // [{ id, name, role }]
    unavailability: [],  // [{ id, staffId, day: 'YYYY-MM-DD', kind }]
    shifts: structuredClone(DEFAULT_SHIFTS),
    roles: structuredClone(DEFAULT_ROLES),
    rules: structuredClone(DEFAULT_RULES),
    seq: { staff: 1, unav: 1 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    // merge difensivo: garantisce che tutte le chiavi esistano
    return {
      ...freshState(),
      ...parsed,
      shifts: parsed.shifts ?? structuredClone(DEFAULT_SHIFTS),
      roles: parsed.roles ?? structuredClone(DEFAULT_ROLES),
      rules: { ...DEFAULT_RULES, ...(parsed.rules ?? {}) },
      seq: parsed.seq ?? { staff: 1, unav: 1 },
    };
  } catch {
    return freshState();
  }
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

export function addStaff(state, name, role) {
  const id = state.seq.staff;
  return {
    ...state,
    staff: [...state.staff, { id, name, role }],
    seq: { ...state.seq, staff: id + 1 },
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
