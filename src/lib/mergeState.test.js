import { describe, it, expect } from 'vitest';
import { mergeStates, sameData } from './mergeState.js';

const base = (over = {}) => ({
  sites: [], shifts: [], favorites: [], expenses: [], seq: { site: 1, shift: 1, favorite: 1, expense: 1 },
  tombstones: { sites: {}, shifts: {}, favorites: {}, expenses: {} },
  ...over,
});

describe('mergeStates', () => {
  it('unisce turni aggiunti su dispositivi diversi (nessuna perdita di dati)', () => {
    const local = base({ shifts: [{ id: 1, date: '2026-09-01' }] });
    const remote = base({ shifts: [{ id: 2, date: '2026-09-02' }] });
    const merged = mergeStates(local, remote);
    expect(merged.shifts.map((s) => s.id).sort()).toEqual([1, 2]);
  });

  it('stesso id senza data di modifica (dati di versioni precedenti): la versione locale vince', () => {
    const local = base({ shifts: [{ id: 1, note: 'locale' }] });
    const remote = base({ shifts: [{ id: 1, note: 'remoto' }] });
    const merged = mergeStates(local, remote);
    expect(merged.shifts).toHaveLength(1);
    expect(merged.shifts[0].note).toBe('locale');
  });

  it('unisce sedi, scorciatoie e spese allo stesso modo', () => {
    const local = base({
      sites: [{ id: 1, name: 'CDS' }],
      favorites: [{ id: 1, label: 'A' }],
      expenses: [{ id: 1, amount: 10 }],
    });
    const remote = base({
      sites: [{ id: 2, name: 'Ravera' }],
      favorites: [{ id: 2, label: 'B' }],
      expenses: [{ id: 2, amount: 20 }],
    });
    const merged = mergeStates(local, remote);
    expect(merged.sites).toHaveLength(2);
    expect(merged.favorites).toHaveLength(2);
    expect(merged.expenses).toHaveLength(2);
  });

  it('la sequenza id risultante è sempre il massimo tra le due, per evitare collisioni future', () => {
    const local = base({ seq: { site: 3, shift: 10, favorite: 1, expense: 1 } });
    const remote = base({ seq: { site: 2, shift: 15, favorite: 4, expense: 1 } });
    const merged = mergeStates(local, remote);
    expect(merged.seq).toEqual({ site: 3, shift: 15, favorite: 4, expense: 1 });
  });

  it('un turno eliminato su un dispositivo non ricompare se l\'altro lo aveva ancora (bug reale corretto)', () => {
    const local = base({
      shifts: [{ id: 1, date: '2026-09-01' }],
      tombstones: { sites: {}, shifts: { 2: Date.now() }, favorites: {}, expenses: {} },
    });
    const remote = base({ shifts: [{ id: 1, date: '2026-09-01' }, { id: 2, date: '2026-09-02' }] });
    const merged = mergeStates(local, remote);
    expect(merged.shifts.map((s) => s.id).sort()).toEqual([1]);
  });

  it('un turno eliminato sul dispositivo remoto non ricompare se il locale lo aveva ancora', () => {
    const local = base({ shifts: [{ id: 1 }, { id: 2 }] });
    const remote = base({
      shifts: [{ id: 1 }],
      tombstones: { sites: {}, shifts: { 2: Date.now() }, favorites: {}, expenses: {} },
    });
    const merged = mergeStates(local, remote);
    expect(merged.shifts.map((s) => s.id).sort()).toEqual([1]);
  });

  it('i tombstone di entrambi i dispositivi si uniscono, senza perderne nessuno', () => {
    const local = base({ tombstones: { sites: {}, shifts: { 1: 100 }, favorites: {}, expenses: {} } });
    const remote = base({ tombstones: { sites: {}, shifts: { 2: 200 }, favorites: {}, expenses: {} } });
    const merged = mergeStates(local, remote);
    expect(Object.keys(merged.tombstones.shifts).sort()).toEqual(['1', '2']);
  });

  it('ritorna lo stato locale se il remoto è nullo, e viceversa', () => {
    const local = base({ shifts: [{ id: 1 }] });
    expect(mergeStates(local, null)).toBe(local);
    const remote = base({ shifts: [{ id: 2 }] });
    expect(mergeStates(null, remote)).toBe(remote);
  });
});

describe('mergeStates: stesso elemento modificato su due telefoni', () => {
  it('vince la modifica più recente, da qualunque parte arrivi', () => {
    const local = base({ shifts: [{ id: 1, note: 'vecchia', _u: 100 }, { id: 2, note: 'nuova locale', _u: 300 }] });
    const remote = base({ shifts: [{ id: 1, note: 'nuova remota', _u: 200 }, { id: 2, note: 'vecchia', _u: 250 }] });
    const merged = mergeStates(local, remote);
    const byId = Object.fromEntries(merged.shifts.map((s) => [s.id, s.note]));
    expect(byId).toEqual({ 1: 'nuova remota', 2: 'nuova locale' });
  });

  it('un\'eliminazione vince sulle modifiche precedenti, ma non su un ripristino successivo', () => {
    const tomb = { sites: {}, shifts: { 1: 500, 2: 500 }, favorites: {}, expenses: {} };
    const local = base({ tombstones: tomb });
    const remote = base({ shifts: [{ id: 1, _u: 400 }, { id: 2, _u: 600 }] });
    const merged = mergeStates(local, remote);
    expect(merged.shifts.map((s) => s.id)).toEqual([2]);
  });

  it('a parità, all\'avvio con modifiche non salvate si può preferire il cloud', () => {
    const local = base({ shifts: [{ id: 1, note: 'locale' }] });
    const remote = base({ shifts: [{ id: 1, note: 'remoto' }] });
    expect(mergeStates(local, remote, { preferRemoteOnTie: true }).shifts[0].note).toBe('remoto');
  });

  it('impostazioni: vince quella modificata più di recente, non sempre la locale', () => {
    const local = base({ settings: { monthlyGoal: 3000 }, settingsUpdatedAt: 100 });
    const remote = base({ settings: { monthlyGoal: 4500 }, settingsUpdatedAt: 200 });
    expect(mergeStates(local, remote).settings.monthlyGoal).toBe(4500);
    expect(mergeStates(remote, local).settings.monthlyGoal).toBe(4500);
    expect(mergeStates(local, remote).settingsUpdatedAt).toBe(200);
  });

  it('unire due volte dà lo stesso risultato (nessun "ping-pong" tra telefoni)', () => {
    const local = base({ shifts: [{ id: 1, _u: 100 }, { id: 3, _u: 50 }], settings: { a: 1 }, settingsUpdatedAt: 10 });
    const remote = base({ shifts: [{ id: 1, _u: 90 }, { id: 2, _u: 70 }], settings: { a: 2 }, settingsUpdatedAt: 20 });
    const once = mergeStates(local, remote);
    expect(sameData(mergeStates(once, remote), once)).toBe(true);
    expect(sameData(mergeStates(remote, once), once)).toBe(true);
  });
});

describe('sameData', () => {
  it('ignora l\'ordine degli elementi e delle chiavi', () => {
    const a = base({ shifts: [{ id: 1, a: 1, b: 2 }, { id: 2 }], settings: { x: 1, y: 2 } });
    const b = base({ shifts: [{ id: 2 }, { b: 2, a: 1, id: 1 }], settings: { y: 2, x: 1 } });
    expect(sameData(a, b)).toBe(true);
  });

  it('riconosce una differenza reale', () => {
    expect(sameData(base({ shifts: [{ id: 1, note: 'a' }] }), base({ shifts: [{ id: 1, note: 'b' }] }))).toBe(false);
    expect(sameData(base({ settings: { x: 1 } }), base({ settings: { x: 2 } }))).toBe(false);
  });
});
