// Cronologia delle modifiche e cestino.
//
// Ogni modifica fatta su questo dispositivo (turno aggiunto, eliminato, segnato "non fatto",
// orario cambiato, sede, spesa…) lascia una riga in `state.history`; ogni elemento eliminato
// finisce in `state.trash` per 30 giorni e si può ripristinare. Si sincronizzano con gli altri
// dispositivi come il resto dei dati (vedi mergeState.js): così si vede anche cosa è stato
// cambiato dall'altro telefono, e quando.
//
// Le righe si ricavano confrontando lo stato prima e dopo ogni modifica (withHistory, chiamata
// da App per tutte le modifiche fatte dall'utente; i dati che arrivano dal cloud non passano di qui).

import { MONTHS_IT, WEEKDAYS_IT, dayMarkKind, EXPENSE_CATEGORIES } from './defaults.js';
import { deviceLabel } from './version.js';

export const HISTORY_DAYS = 60;
export const HISTORY_MAX = 300;
export const TRASH_DAYS = 30;
export const TRASH_MAX = 200;
// più di tanti elementi cambiati in un colpo solo (ripristino di una copia, azzeramento):
// una riga riassuntiva invece di centinaia
const BULK = 25;

const DAY = 86400000;
const LOGGED = ['shifts', 'occasionalWork', 'dayMarks', 'sites', 'expenses'];

const fmtEuro = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS_IT[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`;
}

// descrizione breve dell'elemento, con i nomi di adesso (le sedi si cercano nello stato)
function describe(col, item, sites) {
  if (!item) return '';
  if (col === 'shifts') {
    const site = sites.find((s) => s.id === item.siteId);
    return `${site?.name ?? 'sede eliminata'}, ${shortDate(item.date)} ${item.start}–${item.end}`;
  }
  if (col === 'occasionalWork') return `${item.description || 'prestazione'}, ${shortDate(item.date)}, ${fmtEuro(item.grossAmount)}`;
  if (col === 'dayMarks') return `${dayMarkKind(item.kind).label}, ${shortDate(item.date)}`;
  if (col === 'sites') return `${item.name} (${fmtEuro(item.rate)}/h)`;
  if (col === 'expenses') {
    const cat = EXPENSE_CATEGORIES.find((c) => c.id === item.category)?.label ?? 'Spesa';
    return `${cat} ${fmtEuro(item.amount)}, ${shortDate(item.date)}`;
  }
  return '';
}

const NOUN = {
  shifts: ['Turno', 'm'], occasionalWork: ['Prestazione', 'f'], dayMarks: ['Giorno segnato', 'm'],
  sites: ['Sede', 'f'], expenses: ['Spesa', 'f'],
};
const verb = (col, m, f) => (NOUN[col][1] === 'f' ? f : m);

// campi che contano per dire "è cambiato" (non i timestamp interni)
const IGNORE = new Set(['_u', 'askConfirm']);
function changedKeys(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => !IGNORE.has(k) && JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
}

function editText(col, before, after, sites) {
  const keys = changedKeys(before, after);
  if (!keys.length) return null;
  const what = describe(col, after, sites);
  if (col === 'shifts') {
    if (keys.includes('status')) {
      if (after.status === 'cancelled') return `Turno segnato «non fatto»: ${what}`;
      if (after.status === 'done') {
        const timeToo = keys.includes('start') || keys.includes('end');
        return timeToo ? `Turno confermato con orario diverso: ${what} (era ${before.start}–${before.end})` : `Turno confermato come fatto: ${what}`;
      }
      return `Turno rimesso da confermare: ${what}`;
    }
    if (keys.includes('start') || keys.includes('end')) return `Orario cambiato: ${what} (era ${before.start}–${before.end})`;
    if (keys.includes('siteId')) return `Sede del turno cambiata: ${what} (era ${describe(col, before, sites).split(',')[0]})`;
    if (keys.includes('rate')) {
      return after.rate != null ? `Paga del turno: ${fmtEuro(after.rate)}/h · ${what}` : `Paga del turno tornata quella della sede: ${what}`;
    }
    if (keys.includes('note')) return `Nota del turno cambiata: ${what}`;
  }
  if (col === 'sites') {
    if (keys.includes('archived')) return after.archived ? `Sede archiviata: ${after.name}` : `Sede tolta dall'archivio: ${after.name}`;
    if (keys.includes('rate')) return `Paga di ${after.name} cambiata: ${fmtEuro(before.rate)} → ${fmtEuro(after.rate)}/h`;
    if (keys.includes('name')) return `Sede rinominata: ${before.name} → ${after.name}`;
  }
  return `${NOUN[col][0]} ${verb(col, 'modificato', 'modificata')}: ${what}`;
}

const newId = (at) => `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// tiene solo le righe recenti (e quelle dopo un eventuale "Azzera tutti i dati")
export function pruneHistory(list = [], resetAt = 0, now = Date.now()) {
  return list.filter((h) => h.at > resetAt && h.at > now - HISTORY_DAYS * DAY)
    .sort((a, b) => b.at - a.at).slice(0, HISTORY_MAX);
}
export function pruneTrash(list = [], resetAt = 0, now = Date.now()) {
  return list.filter((t) => t.at > resetAt && t.at > now - TRASH_DAYS * DAY)
    .sort((a, b) => b.at - a.at).slice(0, TRASH_MAX);
}

/**
 * Stato `next` con le righe di cronologia e il cestino aggiornati in base a ciò che è cambiato
 * rispetto a `prev`. Se non è cambiato niente di registrabile ritorna `next` così com'è.
 */
export function withHistory(prev, next, { now = Date.now(), device = deviceLabel() } = {}) {
  if (!prev || !next || prev === next) return next;
  // "Azzera tutti i dati" / uscita dall'account: cronologia e cestino ripartono da zero
  if ((Number(next.historyResetAt) || 0) > (Number(prev.historyResetAt) || 0)) return next;

  const sites = next.sites ?? [];
  const entries = [];
  const trashed = [];
  const restored = []; // [col, id]
  const bulk = [];

  for (const col of LOGGED) {
    const a = prev[col] ?? [];
    const b = next[col] ?? [];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Map(b.map((x) => [x.id, x]));
    const added = b.filter((x) => !before.has(x.id));
    const removed = a.filter((x) => !after.has(x.id));
    const edited = b.filter((x) => before.has(x.id) && before.get(x.id) !== x)
      .map((x) => [before.get(x.id), x]).filter(([o, n]) => changedKeys(o, n).length > 0);

    if (added.length + removed.length + edited.length > BULK) {
      bulk.push({ col, added: added.length, removed: removed.length, edited: edited.length });
      continue;
    }
    const prevTomb = prev.tombstones?.[col] ?? {};
    for (const x of added) {
      const isRestore = prevTomb[x.id] != null;
      if (isRestore) restored.push([col, x.id]);
      entries.push({ col, itemId: x.id, act: isRestore ? 'restore' : 'add',
        text: `${NOUN[col][0]} ${isRestore ? verb(col, 'ripristinato', 'ripristinata') : verb(col, 'aggiunto', 'aggiunta')}: ${describe(col, x, sites)}` });
    }
    for (const x of removed) {
      const text = `${NOUN[col][0]} ${verb(col, 'eliminato', 'eliminata')}: ${describe(col, x, prev.sites ?? sites)}`;
      entries.push({ col, itemId: x.id, act: 'delete', text });
      trashed.push({ col, item: x, text: describe(col, x, prev.sites ?? sites) });
    }
    for (const [o, n] of edited) {
      const text = editText(col, o, n, sites);
      if (text) entries.push({ col, itemId: n.id, act: n.status === 'cancelled' && o.status !== 'cancelled' ? 'cancel' : 'edit', text });
    }
  }
  if (bulk.length) {
    const parts = bulk.map((b) => `${NOUN[b.col][0].toLowerCase()}: ${[b.removed && `${b.removed} tolti`, b.added && `${b.added} aggiunti`, b.edited && `${b.edited} cambiati`].filter(Boolean).join(', ')}`);
    entries.push({ col: 'all', itemId: null, act: 'bulk', text: `Molti dati cambiati insieme (es. ripristino di una copia) — ${parts.join(' · ')}` });
  }
  if (!entries.length) return next;

  const rows = entries.map((e, i) => ({ id: newId(now + i), at: now + i, dev: device, ...e, _u: now + i }));
  let trash = next.trash ?? [];
  // ciò che torna (ripristino dal cestino o "Annulla") esce dal cestino, anche sugli altri dispositivi
  if (restored.length) {
    const back = new Set(restored.map(([c, id]) => `${c}:${id}`));
    trash = trash.map((t) => (!t.restoredAt && back.has(`${t.col}:${t.item?.id}`) ? { ...t, restoredAt: now, _u: now } : t));
  }
  trash = [...trashed.map((t, i) => ({ id: newId(now + i), at: now + i, dev: device, ...t, _u: now + i })), ...trash];
  const resetAt = Number(next.historyResetAt) || 0;
  return {
    ...next,
    history: pruneHistory([...rows, ...(next.history ?? [])], resetAt, now),
    trash: pruneTrash(trash, resetAt, now),
  };
}

// righe della cronologia di un singolo elemento (es. "storia di questo turno")
export const historyOf = (state, col, itemId) => (state.history ?? []).filter((h) => h.col === col && h.itemId === itemId);

// cestino da mostrare: non ripristinati e non già tornati per altra via
export function visibleTrash(state) {
  return (state.trash ?? []).filter((t) => !t.restoredAt && t.item && !(state[t.col] ?? []).some((x) => x.id === t.item.id));
}

// "lun 26/10 alle 15:12" — quando, per le righe della cronologia
export function whenLabel(at) {
  const d = new Date(at);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `oggi alle ${hm}`;
  if (d.toDateString() === yest.toDateString()) return `ieri alle ${hm}`;
  return `${WEEKDAYS_IT[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()} alle ${hm}`;
}
