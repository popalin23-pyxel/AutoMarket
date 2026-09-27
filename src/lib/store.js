// Store persistente su localStorage per Turnio.

import { DEFAULT_SETTINGS, SITE_COLORS } from './defaults.js';

const KEY = 'turnio_state_v1';

function freshState() {
  return {
    sites: [],   // [{ id, name, color, rate, rivalsaPercent: null|number }]
    shifts: [],  // [{ id, date: 'YYYY-MM-DD', siteId, start: 'HH:MM', end: 'HH:MM', note }]
    settings: { ...DEFAULT_SETTINGS },
    seq: { site: 1, shift: 1 },
  };
}

function sanitizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return freshState();
  return {
    ...freshState(),
    ...parsed,
    sites: Array.isArray(parsed.sites) ? parsed.sites : [],
    shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    seq: { site: 1, shift: 1, ...(parsed.seq ?? {}) },
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
  return { ...state, sites: state.sites.filter((s) => s.id !== id) };
}

// ── Turni ─────────────────────────────────────────────────────────────
export function addShift(state, shift) {
  const id = state.seq.shift;
  return {
    ...state,
    shifts: [...state.shifts, { id, ...shift }],
    seq: { ...state.seq, shift: id + 1 },
  };
}

export function updateShift(state, id, patch) {
  return { ...state, shifts: state.shifts.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function removeShift(state, id) {
  return { ...state, shifts: state.shifts.filter((s) => s.id !== id) };
}

// ── Impostazioni ─────────────────────────────────────────────────────
export function updateSettings(state, patch) {
  return { ...state, settings: { ...state.settings, ...patch } };
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
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const raw = parsed && parsed.state ? parsed.state : parsed;
        if (parsed?.app && parsed.app !== 'turnio') return reject(new Error('Il file non è un backup di Turnio.'));
        resolve(sanitizeState(raw));
      } catch {
        reject(new Error('File non valido o danneggiato.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}
