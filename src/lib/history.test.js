import { describe, it, expect } from 'vitest';
import { withHistory, visibleTrash, historyOf, pruneHistory } from './history.js';
import {
  sanitizeState, addSite, addShift, updateShift, removeShift, restoreShift, restoreFromTrash,
  replaceAllData, clearAllData, resetState,
} from './store.js';
import { mergeStates } from './mergeState.js';

const opts = (now = Date.now()) => ({ now, device: 'Android (app)' });
// applica una modifica come fa App: stato prima → modifica → cronologia
const apply = (state, fn, o) => withHistory(state, fn(state), o ?? opts());

function base() {
  let s = sanitizeState({});
  s = addSite(s, 'Ravera', 28);
  return s;
}

describe('cronologia delle modifiche', () => {
  it('turno aggiunto: una riga con sede, giorno e orario, niente cestino', () => {
    let s = base();
    s = apply(s, (x) => addShift(x, { date: '2026-10-26', siteId: x.sites[0].id, start: '07:30', end: '13:30', note: '' }));
    expect(s.history).toHaveLength(1); // solo il turno: la sede era già nello stato di partenza
    expect(s.history[0]).toMatchObject({ col: 'shifts', act: 'add', dev: 'Android (app)' });
    expect(s.history[0].text).toBe('Turno aggiunto: Ravera, lun 26/10 07:30–13:30');
    expect(s.trash).toEqual([]);
  });

  it('turno segnato "non fatto": riga riconoscibile, il turno resta', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '20:00', end: '08:00', note: '' });
    const id = s.shifts[0].id;
    s = apply(s, (x) => updateShift(x, id, { status: 'cancelled', askConfirm: undefined }));
    expect(s.history[0]).toMatchObject({ act: 'cancel', itemId: id });
    expect(s.history[0].text).toBe('Turno segnato «non fatto»: Ravera, mer 21/10 20:00–08:00');
    expect(historyOf(s, 'shifts', id)).toHaveLength(1);
  });

  it('turno eliminato: va nel cestino e si può ripristinare (anche la riga del cestino si chiude)', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '20:00', end: '08:00', note: 'notte' });
    const shift = s.shifts[0];
    s = apply(s, (x) => removeShift(x, shift.id));
    expect(s.shifts).toHaveLength(0);
    expect(s.history[0]).toMatchObject({ act: 'delete', text: 'Turno eliminato: Ravera, mer 21/10 20:00–08:00' });
    const [entry] = visibleTrash(s);
    expect(entry.item).toMatchObject({ id: shift.id, note: 'notte' });

    s = apply(s, (x) => restoreFromTrash(x, entry), opts(Date.now() + 1000));
    expect(s.shifts.map((x) => x.id)).toEqual([shift.id]);
    expect(s.history[0]).toMatchObject({ act: 'restore', text: 'Turno ripristinato: Ravera, mer 21/10 20:00–08:00' });
    expect(visibleTrash(s)).toHaveLength(0);
  });

  it('"Annulla" subito dopo l\'eliminazione: il turno torna e sparisce dal cestino', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    const shift = s.shifts[0];
    s = apply(s, (x) => removeShift(x, shift.id));
    s = apply(s, (x) => restoreShift(x, shift), opts(Date.now() + 10));
    expect(visibleTrash(s)).toHaveLength(0);
  });

  it('cambio d\'orario e conferma con orario diverso: si legge l\'orario di prima', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    const id = s.shifts[0].id;
    s = apply(s, (x) => updateShift(x, id, { start: '08:00', end: '14:00', status: 'done', askConfirm: undefined }));
    expect(s.history[0].text).toBe('Turno confermato con orario diverso: Ravera, mer 21/10 08:00–14:00 (era 07:00–14:00)');
  });

  it('salvare senza cambiare niente non lascia righe', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    const id = s.shifts[0].id;
    const after = apply(s, (x) => updateShift(x, id, { start: '07:00' }));
    expect(after.history).toEqual([]);
  });

  it('tanti cambiamenti insieme (ripristino di una copia): una sola riga riassuntiva, niente cestino', () => {
    let s = base();
    for (let i = 1; i <= 30; i++) s = addShift(s, { date: `2026-10-${String(i).padStart(2, '0')}`, siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    s = apply(s, (x) => replaceAllData(x, sanitizeState({ sites: x.sites, shifts: [] })));
    expect(s.history).toHaveLength(1);
    expect(s.history[0].act).toBe('bulk');
    expect(s.history[0].text).toMatch(/30 tolti/);
    expect(s.trash).toEqual([]);
  });

  it('il ripristino di una copia tiene la cronologia dell\'account', () => {
    let s = base();
    s = apply(s, (x) => addShift(x, { date: '2026-10-26', siteId: x.sites[0].id, start: '07:30', end: '13:30', note: '' }));
    const restored = replaceAllData(s, sanitizeState({ sites: s.sites, shifts: [], history: [{ id: 'vecchia', at: 1 }] }));
    expect(restored.history.map((h) => h.id)).toEqual(s.history.map((h) => h.id));
  });

  it('"Azzera tutti i dati" cancella cronologia e cestino, anche dopo l\'unione con l\'altro telefono', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    s = apply(s, (x) => removeShift(x, x.shifts[0].id));
    const other = s; // l'altro telefono ha ancora la cronologia
    const cleared = apply(s, clearAllData, opts(Date.now() + 5000));
    expect(cleared.history).toEqual([]);
    expect(cleared.trash).toEqual([]);
    const merged = mergeStates(other, cleared);
    expect(merged.history).toEqual([]);
    expect(merged.trash).toEqual([]);
  });

  it('uscita dall\'account: nessuna riga e niente dati nel cestino', () => {
    let s = base();
    s = addShift(s, { date: '2026-10-21', siteId: s.sites[0].id, start: '07:00', end: '14:00', note: '' });
    const out = withHistory(s, resetState(), opts(Date.now() + 5000));
    expect(out.trash).toEqual([]);
    expect(out.history).toEqual([]);
  });
});

describe('cronologia tra due telefoni', () => {
  it('le righe dei due telefoni si sommano, senza doppioni', () => {
    let a = base();
    let b = a;
    a = apply(a, (x) => addShift(x, { date: '2026-10-26', siteId: x.sites[0].id, start: '07:30', end: '13:30', note: '' }), { now: Date.now(), device: 'Android (app)' });
    b = apply(b, (x) => addShift(x, { date: '2026-10-27', siteId: x.sites[0].id, start: '14:30', end: '20:30', note: '' }), { now: Date.now() + 1, device: 'iPhone (app)' });
    const m1 = mergeStates(a, b);
    const m2 = mergeStates(m1, b);
    expect(m1.history.map((h) => h.dev).sort()).toEqual(['Android (app)', 'iPhone (app)']);
    expect(m2.history).toHaveLength(2);
  });

  it('un ripristino dal cestino fatto su un telefono chiude la riga anche sull\'altro', async () => {
    let a = base();
    a = addShift(a, { date: '2026-10-21', siteId: a.sites[0].id, start: '07:00', end: '14:00', note: '' });
    a = apply(a, (x) => removeShift(x, x.shifts[0].id));
    const b = a;
    await new Promise((r) => setTimeout(r, 5)); // il ripristino avviene dopo l'eliminazione
    const [entry] = visibleTrash(a);
    a = apply(a, (x) => restoreFromTrash(x, entry), opts(Date.now() + 2000));
    const merged = mergeStates(b, a);
    expect(visibleTrash(merged)).toHaveLength(0);
    expect(merged.shifts).toHaveLength(1);
  });

  it('si tengono solo gli ultimi 60 giorni', () => {
    const now = Date.now();
    const list = [{ id: 'a', at: now - 61 * 86400000 }, { id: 'b', at: now - 59 * 86400000 }];
    expect(pruneHistory(list, 0, now).map((h) => h.id)).toEqual(['b']);
  });
});
