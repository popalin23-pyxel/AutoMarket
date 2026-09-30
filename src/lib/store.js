// Store persistente su localStorage per Turnio.

import { DEFAULT_SETTINGS, SITE_COLORS } from './defaults.js';
import { markFirstUse, markBackupDone } from './backupReminder.js';

const KEY = 'turnio_state_v1';

function freshState() {
  return {
    sites: [],   // [{ id, name, color, rate, rivalsaPercent: null|number }]
    shifts: [],  // [{ id, date: 'YYYY-MM-DD', siteId, start: 'HH:MM', end: 'HH:MM', note }]
    favorites: [], // [{ id, siteId, start: 'HH:MM', end: 'HH:MM', label }] — scorciatoie turno
    expenses: [], // [{ id, date: 'YYYY-MM-DD', category, amount, note }]
    lastSiteId: null, // ultima sede usata, per pre-selezionarla nel prossimo turno
    settings: { ...DEFAULT_SETTINGS },
    seq: { site: 1, shift: 1, favorite: 1, expense: 1 },
    // id eliminati (con timestamp): evita che riappaiano dopo un'unione multi-dispositivo (vedi mergeState.js)
    tombstones: { sites: {}, shifts: {}, favorites: {}, expenses: {} },
  };
}

function removeWithTombstone(state, collection, id) {
  return {
    ...state,
    [collection]: (state[collection] ?? []).filter((item) => item.id !== id),
    tombstones: {
      ...(state.tombstones ?? {}),
      [collection]: { ...(state.tombstones?.[collection] ?? {}), [id]: Date.now() },
    },
  };
}

function sanitizeSettings(rawSettings) {
  const settings = { ...DEFAULT_SETTINGS, ...(rawSettings ?? {}) };
  // Compatibilità: chi aveva già un "Tasse (%)" unico mantiene lo stesso risultato,
  // diventa l'aliquota imposta con contributi a 0 finché non li imposta esplicitamente.
  if (rawSettings?.taxRatePercent == null) {
    settings.taxRatePercent = Number(settings.taxPercent) || 0;
    settings.contributionsPercent = 0;
  }
  settings.taxPercent = (Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0);
  return settings;
}

export function sanitizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return freshState();
  return {
    ...freshState(),
    ...parsed,
    sites: Array.isArray(parsed.sites) ? parsed.sites : [],
    shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    lastSiteId: parsed.lastSiteId ?? null,
    settings: sanitizeSettings(parsed.settings),
    seq: { site: 1, shift: 1, favorite: 1, expense: 1, ...(parsed.seq ?? {}) },
    tombstones: {
      sites: {}, shifts: {}, favorites: {}, expenses: {},
      ...(parsed.tombstones ?? {}),
    },
  };
}

export function loadState() {
  markFirstUse();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return freshState();
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Turnio: salvataggio fallito', e); }
}

export function resetState() {
  const s = freshState();
  saveState(s);
  return s;
}

// ── Sedi ──────────────────────────────────────────────────────────────
export function addSite(state, name, rate, opts = {}) {
  const id = state.seq.site;
  const color = opts.color || SITE_COLORS[(state.sites.length) % SITE_COLORS.length];
  return {
    ...state,
    sites: [...state.sites, {
      id, name: name.trim(), color,
      rate: Number(rate) || 0,
      rivalsaPercent: opts.rivalsaPercent === '' || opts.rivalsaPercent == null ? null : Number(opts.rivalsaPercent),
    }],
    seq: { ...state.seq, site: id + 1 },
  };
}

export function updateSite(state, id, patch) {
  return { ...state, sites: state.sites.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function removeSite(state, id) {
  return removeWithTombstone(state, 'sites', id);
}

// ── Turni ─────────────────────────────────────────────────────────────
export function addShift(state, shift) {
  const id = state.seq.shift;
  return {
    ...state,
    shifts: [...state.shifts, { id, ...shift }],
    lastSiteId: shift.siteId ?? state.lastSiteId,
    seq: { ...state.seq, shift: id + 1 },
  };
}

export function updateShift(state, id, patch) {
  return {
    ...state,
    shifts: state.shifts.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    lastSiteId: patch.siteId ?? state.lastSiteId,
  };
}

export function removeShift(state, id) {
  return removeWithTombstone(state, 'shifts', id);
}

// Ripristina un turno eliminato di recente (stesso id, per l'azione "Annulla").
export function restoreShift(state, shift) {
  if (state.shifts.some((s) => s.id === shift.id)) return state;
  const shiftTombstones = { ...state.tombstones.shifts };
  delete shiftTombstones[shift.id];
  return {
    ...state,
    shifts: [...state.shifts, shift],
    tombstones: { ...state.tombstones, shifts: shiftTombstones },
  };
}

// ── Scorciatoie turno (preferiti) ──────────────────────────────────────
export function addFavorite(state, fav) {
  const id = state.seq.favorite;
  return {
    ...state,
    favorites: [...state.favorites, { id, ...fav }],
    seq: { ...state.seq, favorite: id + 1 },
  };
}

export function removeFavorite(state, id) {
  return removeWithTombstone(state, 'favorites', id);
}

// ── Spese professionali ──────────────────────────────────────────────
export function addExpense(state, expense) {
  const id = state.seq.expense;
  return {
    ...state,
    expenses: [...state.expenses, { id, ...expense }],
    seq: { ...state.seq, expense: id + 1 },
  };
}

export function removeExpense(state, id) {
  return removeWithTombstone(state, 'expenses', id);
}

// ── Impostazioni ─────────────────────────────────────────────────────
export function updateSettings(state, patch) {
  return { ...state, settings: { ...state.settings, ...patch } };
}

// Aggiorna aliquota/contributi/regime e ricalcola il taxPercent totale usato dal motore di calcolo.
export function updateFiscalSettings(state, patch) {
  const settings = { ...state.settings, ...patch };
  settings.taxPercent = (Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0);
  return { ...state, settings };
}

// ── Backup / Ripristino ─────────────────────────────────────────────
const BACKUP_VERSION = 1;

export function exportBackup(state) {
  const payload = { app: 'turnio', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turnio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  markBackupDone();
}

export function importBackupFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Testo non valido: non è un JSON corretto.');
  }
  const raw = parsed && parsed.state ? parsed.state : parsed;
  if (parsed?.app && parsed.app !== 'turnio') throw new Error('Il testo non è un backup di Turnio.');
  return sanitizeState(raw);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(importBackupFromText(String(reader.result)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('File non valido o danneggiato.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}
