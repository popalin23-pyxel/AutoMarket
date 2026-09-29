import { describe, it, expect } from 'vitest';
import { mergeStates } from './mergeState.js';

const base = (over = {}) => ({
  sites: [], shifts: [], favorites: [], expenses: [], seq: { site: 1, shift: 1, favorite: 1, expense: 1 }, ...over,
});

describe('mergeStates', () => {
  it('unisce turni aggiunti su dispositivi diversi (nessuna perdita di dati)', () => {
    const local = base({ shifts: [{ id: 1, date: '2026-09-01' }] });
    const remote = base({ shifts: [{ id: 2, date: '2026-09-02' }] });
    const merged = mergeStates(local, remote);
    expect(merged.shifts.map((s) => s.id).sort()).toEqual([1, 2]);
  });

  it('in caso di stesso id, la versione locale vince', () => {
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

  it('ritorna lo stato locale se il remoto è nullo, e viceversa', () => {
    const local = base({ shifts: [{ id: 1 }] });
    expect(mergeStates(local, null)).toBe(local);
    const remote = base({ shifts: [{ id: 2 }] });
    expect(mergeStates(null, remote)).toBe(remote);
  });
});
