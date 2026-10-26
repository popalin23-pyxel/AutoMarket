// Store persistente su localStorage per Turnio.

import { DEFAULT_SETTINGS, SITE_COLORS } from './defaults.js';
import { addDaysISO, siteRateOn } from './calc.js';
import { markFirstUse, markBackupDone } from './backupReminder.js';
import { saveFile } from './saveFile.js';

const KEY = 'turnio_state_v1';

function freshState() {
  return {
    sites: [],   // [{ id, name, color, rate, rivalsaPercent: null|number }]
    shifts: [],  // [{ id, date: 'YYYY-MM-DD', siteId, start: 'HH:MM', end: 'HH:MM', note }]
    favorites: [], // [{ id, siteId, start: 'HH:MM', end: 'HH:MM', label }] — scorciatoie turno
    expenses: [], // [{ id, date: 'YYYY-MM-DD', category, amount, note }]
    // prestazioni occasionali: reddito diverso dal lavoro nelle sedi (niente sede/orario,
    // importo libero), tassato separatamente — vedi aggregateOccasional in calc.js
    occasionalWork: [], // [{ id, date: 'YYYY-MM-DD', description, grossAmount, note }]
    // giorni segnati (ferie, malattia, corso, non disponibile): non pagati, vedi DAY_MARK_KINDS
    dayMarks: [], // [{ id, date: 'YYYY-MM-DD', kind, note }]
    lastSiteId: null, // ultima sede usata, per pre-selezionarla nel prossimo turno
    settings: { ...DEFAULT_SETTINGS },
    seq: { site: 1, shift: 1, favorite: 1, expense: 1, occasionalWork: 1, dayMark: 1 },
    settingsUpdatedAt: 0, // ultima modifica alle impostazioni (per l'unione tra dispositivi)
    // id eliminati (con timestamp): evita che riappaiano dopo un'unione multi-dispositivo (vedi mergeState.js)
    tombstones: { sites: {}, shifts: {}, favorites: {}, expenses: {}, occasionalWork: {}, dayMarks: {} },
  };
}

// Id univoci anche tra dispositivi diversi: due telefoni che aggiungono un turno nello
// stesso momento non devono generare lo stesso id (con id progressivi uno sovrascriveva l'altro).
// Restano numeri interi crescenti, sempre maggiori di quelli già esistenti.
function nextId(state, key) {
  return Math.max(Number(state.seq?.[key]) || 1, Date.now() * 100 + Math.floor(Math.random() * 100));
}
// `_u` = quando l'elemento è stato creato/modificato l'ultima volta: nell'unione tra
// dispositivi vince la modifica più recente (vedi mergeState.js).
const touch = (item) => ({ ...item, _u: Date.now() });

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
  // il ruolo "Medica" è stato rimosso: chi l'aveva scelto passa a "Medico"
  if (settings.professionalRole === 'medica') settings.professionalRole = 'medico';
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
    occasionalWork: Array.isArray(parsed.occasionalWork) ? parsed.occasionalWork : [],
    dayMarks: Array.isArray(parsed.dayMarks) ? parsed.dayMarks : [],
    lastSiteId: parsed.lastSiteId ?? null,
    settings: sanitizeSettings(parsed.settings),
    seq: { site: 1, shift: 1, favorite: 1, expense: 1, occasionalWork: 1, dayMark: 1, ...(parsed.seq ?? {}) },
    settingsUpdatedAt: Number(parsed.settingsUpdatedAt) || 0,
    tombstones: {
      sites: {}, shifts: {}, favorites: {}, expenses: {}, occasionalWork: {}, dayMarks: {},
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

const COLLECTIONS = ['sites', 'shifts', 'favorites', 'expenses', 'occasionalWork', 'dayMarks'];

// Sostituisce tutti i dati di `current` con quelli di `next` (ripristino da backup,
// "Azzera tutti i dati") in modo che la sostituzione arrivi anche agli altri dispositivi:
// ciò che sparisce diventa un'eliminazione, ciò che resta o arriva diventa la versione più
// recente, e così le impostazioni. Senza questo l'unione con il cloud rimetteva tutto com'era.
export function replaceAllData(current, next) {
  const now = Date.now();
  const out = { ...next, settingsUpdatedAt: now, tombstones: {}, seq: { ...next.seq } };
  for (const [k, v] of Object.entries(current.seq ?? {})) out.seq[k] = Math.max(Number(out.seq[k]) || 1, Number(v) || 1);
  for (const key of COLLECTIONS) {
    const items = next[key] ?? [];
    const keep = new Set(items.map((x) => String(x.id)));
    const tomb = { ...(current.tombstones?.[key] ?? {}), ...(next.tombstones?.[key] ?? {}) };
    for (const item of current[key] ?? []) if (!keep.has(String(item.id))) tomb[item.id] = now;
    for (const id of keep) delete tomb[id];
    out.tombstones[key] = tomb;
    out[key] = items.map((item) => ({ ...item, _u: now }));
  }
  return out;
}

// "Azzera tutti i dati": come un ripristino da un backup vuoto.
export const clearAllData = (current) => replaceAllData(current, freshState());

// ── Sedi ──────────────────────────────────────────────────────────────
export function addSite(state, name, rate, opts = {}) {
  const id = nextId(state, 'site');
  const color = opts.color || SITE_COLORS[(state.sites.length) % SITE_COLORS.length];
  return {
    ...state,
    sites: [...state.sites, touch({
      id, name: name.trim(), color,
      rate: Number(rate) || 0,
      rivalsaPercent: opts.rivalsaPercent === '' || opts.rivalsaPercent == null ? null : Number(opts.rivalsaPercent),
    })],
    seq: { ...state.seq, site: id + 1 },
  };
}

export function updateSite(state, id, patch) {
  return { ...state, sites: state.sites.map((s) => (s.id === id ? touch({ ...s, ...patch }) : s)) };
}

// Nuova paga oraria. Con `fromISO` vale dai turni di quella data in poi: quelli prima
// mantengono la tariffa di allora. Senza data è una correzione e vale per tutti i turni.
export function changeSiteRate(state, id, newRate, fromISO = null) {
  const rate = Number(newRate) || 0;
  return {
    ...state,
    sites: state.sites.map((s) => {
      if (s.id !== id) return s;
      if (!fromISO) return touch({ ...s, rate, pastRates: [] });
      const prevRate = siteRateOn(s, addDaysISO(fromISO, -1));
      const kept = (s.pastRates ?? []).filter((r) => r.before < fromISO);
      const pastRates = prevRate === rate ? kept : [...kept, { before: fromISO, rate: prevRate }];
      return touch({ ...s, rate, pastRates });
    }),
  };
}

export function removeSite(state, id) {
  return removeWithTombstone(state, 'sites', id);
}

// ── Turni ─────────────────────────────────────────────────────────────
export function addShift(state, shift) {
  const id = nextId(state, 'shift');
  return {
    ...state,
    shifts: [...state.shifts, touch({ ...shift, id })],
    lastSiteId: shift.siteId ?? state.lastSiteId,
    seq: { ...state.seq, shift: id + 1 },
  };
}

export function updateShift(state, id, patch) {
  return {
    ...state,
    shifts: state.shifts.map((s) => (s.id === id ? touch({ ...s, ...patch }) : s)),
    lastSiteId: patch.siteId ?? state.lastSiteId,
  };
}

export function removeShift(state, id) {
  return removeWithTombstone(state, 'shifts', id);
}

// Ripristina un elemento eliminato di recente (stesso id, per l'azione "Annulla").
function restoreItem(state, collection, item) {
  if ((state[collection] ?? []).some((x) => x.id === item.id)) return state;
  const tomb = { ...(state.tombstones?.[collection] ?? {}) };
  delete tomb[item.id];
  return {
    ...state,
    // timestamp nuovo: il ripristino è più recente dell'eliminazione anche per l'altro dispositivo
    [collection]: [...(state[collection] ?? []), touch(item)],
    tombstones: { ...(state.tombstones ?? {}), [collection]: tomb },
  };
}

export const restoreShift = (state, shift) => restoreItem(state, 'shifts', shift);
export const restoreOccasionalWork = (state, entry) => restoreItem(state, 'occasionalWork', entry);
export const restoreDayMark = (state, mark) => restoreItem(state, 'dayMarks', mark);

// ── Scorciatoie turno (preferiti) ──────────────────────────────────────
export function addFavorite(state, fav) {
  const id = nextId(state, 'favorite');
  return {
    ...state,
    favorites: [...state.favorites, touch({ ...fav, id })],
    seq: { ...state.seq, favorite: id + 1 },
  };
}

export function removeFavorite(state, id) {
  return removeWithTombstone(state, 'favorites', id);
}

// ── Spese professionali ──────────────────────────────────────────────
export function addExpense(state, expense) {
  const id = nextId(state, 'expense');
  return {
    ...state,
    expenses: [...state.expenses, touch({ ...expense, id })],
    seq: { ...state.seq, expense: id + 1 },
  };
}

export function removeExpense(state, id) {
  return removeWithTombstone(state, 'expenses', id);
}

// ── Prestazioni occasionali ──────────────────────────────────────────
// Reddito diverso dal lavoro nelle sedi: niente sede/orario, importo libero
// inserito al momento, tassato separatamente (vedi calc.js).
export function addOccasionalWork(state, entry) {
  const id = nextId(state, 'occasionalWork');
  return {
    ...state,
    occasionalWork: [...state.occasionalWork, touch({ ...entry, id })],
    seq: { ...state.seq, occasionalWork: id + 1 },
  };
}

export function updateOccasionalWork(state, id, patch) {
  return { ...state, occasionalWork: state.occasionalWork.map((o) => (o.id === id ? touch({ ...o, ...patch }) : o)) };
}

export function removeOccasionalWork(state, id) {
  return removeWithTombstone(state, 'occasionalWork', id);
}

// ── Giorni segnati (ferie, malattia, corso, non disponibile) ──────────
// Un giorno per voce e un solo tipo per giorno: segnare un giorno con un altro tipo sostituisce
// il precedente. Un periodo (es. ferie dal 10 al 20) crea una voce per ogni giorno.
// L'id è "data|tipo": due telefoni che segnano lo stesso giorno producono la stessa voce
// (nessun doppione dopo l'unione).
const MAX_MARK_DAYS = 366;
export const dayMarkId = (date, kind) => `${date}|${kind}`;

export function addDayMarks(state, { kind, from, to = from, note = '' }) {
  if (!kind || !from) return state;
  let next = state;
  const end = to && to >= from ? to : from;
  let d = from;
  for (let i = 0; i < MAX_MARK_DAYS && d <= end; i++, d = addDaysISO(d, 1)) {
    const date = d;
    for (const other of (next.dayMarks ?? []).filter((m) => m.date === date && m.kind !== kind)) {
      next = removeWithTombstone(next, 'dayMarks', other.id);
    }
    if ((next.dayMarks ?? []).some((m) => m.date === date && m.kind === kind)) continue;
    const id = dayMarkId(date, kind);
    const tomb = { ...(next.tombstones?.dayMarks ?? {}) };
    delete tomb[id]; // segnato di nuovo dopo un'eliminazione
    next = {
      ...next,
      dayMarks: [...(next.dayMarks ?? []), touch({ id, date, kind, note })],
      tombstones: { ...(next.tombstones ?? {}), dayMarks: tomb },
    };
  }
  return next;
}

export function updateDayMark(state, id, patch) {
  const mark = (state.dayMarks ?? []).find((m) => m.id === id);
  if (!mark) return state;
  if (patch.kind && patch.kind !== mark.kind) {
    // cambio di tipo: la voce vecchia si elimina e se ne crea una del nuovo tipo
    return addDayMarks(removeWithTombstone(state, 'dayMarks', id), { kind: patch.kind, from: mark.date, note: patch.note ?? mark.note ?? '' });
  }
  return { ...state, dayMarks: state.dayMarks.map((m) => (m.id === id ? touch({ ...m, ...patch }) : m)) };
}

export function removeDayMark(state, id) {
  return removeWithTombstone(state, 'dayMarks', id);
}

// ── Impostazioni ─────────────────────────────────────────────────────
export function updateSettings(state, patch) {
  return { ...state, settings: { ...state.settings, ...patch }, settingsUpdatedAt: Date.now() };
}

// Aggiorna aliquota/contributi/regime e ricalcola il taxPercent totale usato dal motore di calcolo.
export function updateFiscalSettings(state, patch) {
  const settings = { ...state.settings, ...patch };
  settings.taxPercent = (Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0);
  return { ...state, settings, settingsUpdatedAt: Date.now() };
}

// ── Backup / Ripristino ─────────────────────────────────────────────
const BACKUP_VERSION = 1;

// Ritorna true se il file è stato salvato (false = condivisione annullata dall'utente).
export async function exportBackup(state) {
  const payload = { app: 'turnio', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const saved = await saveFile(blob, `turnio-backup-${new Date().toISOString().slice(0, 10)}.json`);
  if (saved) markBackupDone(); // il promemoria si sposta solo se il backup è stato fatto davvero
  return saved;
}

// Legge un backup: { state, exportedAt }. Un JSON qualsiasi (di un'altra app, `{}`, `[]`) viene
// rifiutato: ripristinarlo sostituirebbe tutti i dati con uno stato vuoto, su ogni dispositivo.
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Testo non valido: non è un JSON corretto.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Il testo non è un backup di Turnio.');
  if (parsed.app && parsed.app !== 'turnio') throw new Error('Il testo non è un backup di Turnio.');
  // formato dell'app { app: 'turnio', state }, oppure lo stato "nudo" dei backup più vecchi
  const raw = parsed.app === 'turnio' ? parsed.state : parsed;
  if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.sites) && !Array.isArray(raw.shifts))) {
    throw new Error('Il testo non è un backup di Turnio.');
  }
  return { state: sanitizeState(raw), exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null };
}

export function importBackupFromText(text) {
  return parseBackup(text).state;
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseBackup(String(reader.result)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('File non valido o danneggiato.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}
