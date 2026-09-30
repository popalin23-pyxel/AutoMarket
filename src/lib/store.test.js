import { describe, it, expect } from 'vitest';
import {
  removeShift, addShift, restoreShift, removeSite, removeFavorite, removeExpense,
  importBackupFromText,
} from './store.js';

const baseState = () => ({
  sites: [{ id: 1, name: 'CDS', color: '#14b8a6', rate: 27, rivalsaPercent: 4 }],
  shifts: [{ id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00', note: '' }],
  favorites: [{ id: 1, siteId: 1, start: '06:00', end: '14:00', label: 'CDS mattina' }],
  expenses: [{ id: 1, date: '2026-09-01', category: 'altro', amount: 50, note: '' }],
  lastSiteId: 1,
  settings: { taxRatePercent: 15, contributionsPercent: 10, taxPercent: 25, rivalsaPercent: 4, monthlyGoal: 4000 },
  seq: { site: 2, shift: 2, favorite: 2, expense: 2 },
  tombstones: { sites: {}, shifts: {}, favorites: {}, expenses: {} },
});

describe('eliminazioni: tracciano un tombstone (per la sync multi-dispositivo)', () => {
  it('eliminare un turno lo toglie dall\'elenco e registra un tombstone con timestamp', () => {
    const next = removeShift(baseState(), 1);
    expect(next.shifts).toHaveLength(0);
    expect(next.tombstones.shifts[1]).toBeTypeOf('number');
    expect(next.tombstones.shifts[1]).toBeGreaterThan(0);
  });

  it('"Annulla" dopo un\'eliminazione rimuove il tombstone (il turno può tornare a sincronizzarsi)', () => {
    const deleted = removeShift(baseState(), 1);
    const shift = baseState().shifts[0];
    const restored = restoreShift(deleted, shift);
    expect(restored.shifts).toHaveLength(1);
    expect(restored.tombstones.shifts[1]).toBeUndefined();
  });

  it('eliminare una sede / scorciatoia / spesa registra il tombstone nella collezione giusta', () => {
    expect(removeSite(baseState(), 1).tombstones.sites[1]).toBeTypeOf('number');
    expect(removeFavorite(baseState(), 1).tombstones.favorites[1]).toBeTypeOf('number');
    expect(removeExpense(baseState(), 1).tombstones.expenses[1]).toBeTypeOf('number');
  });

  it('eliminare un turno non va in errore anche se lo stato arriva senza tombstones (es. dati cloud salvati da una versione più vecchia dell\'app)', () => {
    const { tombstones, ...withoutTombstones } = baseState();
    expect(() => removeShift(withoutTombstones, 1)).not.toThrow();
    const next = removeShift(withoutTombstones, 1);
    expect(next.shifts).toHaveLength(0);
    expect(next.tombstones.shifts[1]).toBeTypeOf('number');
  });

  it('aggiungere un nuovo turno con lo stesso id "resuscitato" da un vecchio tombstone funziona normalmente', () => {
    // scenario limite: un id riciclato (es. dopo import di un vecchio backup) non deve restare bloccato
    const deleted = removeShift(baseState(), 1);
    const withNew = addShift({ ...deleted, seq: { ...deleted.seq, shift: 1 } }, { date: '2026-10-01', siteId: 1, start: '06:00', end: '14:00', note: '' });
    expect(withNew.shifts.some((s) => s.date === '2026-10-01')).toBe(true);
  });
});

describe('importBackupFromText: ripristino da file di backup', () => {
  const wrap = (state) => JSON.stringify({ app: 'turnio', version: 1, exportedAt: new Date().toISOString(), state });

  it('un backup valido (formato esportato dall\'app) viene ripristinato identico', () => {
    const state = baseState();
    const imported = importBackupFromText(wrap(state));
    expect(imported.sites).toHaveLength(1);
    expect(imported.shifts).toHaveLength(1);
    expect(imported.expenses).toHaveLength(1);
    expect(imported.favorites).toHaveLength(1);
    expect(imported.settings.monthlyGoal).toBe(4000);
    expect(imported.tombstones).toEqual(state.tombstones);
  });

  it('testo non JSON valido dà un errore comprensibile, non un crash', () => {
    expect(() => importBackupFromText('questo non è json{{{')).toThrow(/JSON/i);
  });

  it('un JSON valido ma di un\'altra app viene rifiutato', () => {
    expect(() => importBackupFromText(JSON.stringify({ app: 'altrapp', state: baseState() })))
      .toThrow(/non è un backup di Turnio/i);
  });

  it('un backup vecchio senza tombstones/expenses (versioni precedenti dell\'app) si ripristina comunque, senza crash', () => {
    const oldState = {
      sites: [{ id: 1, name: 'CDS', color: '#14b8a6', rate: 27 }],
      shifts: [{ id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00' }],
      settings: { taxPercent: 25 }, // vecchio formato: solo taxPercent unico, niente taxRatePercent/contributionsPercent
      seq: { site: 2, shift: 2 },
      // niente favorites, expenses, tombstones: mancano del tutto
    };
    const imported = importBackupFromText(wrap(oldState));
    expect(imported.favorites).toEqual([]);
    expect(imported.expenses).toEqual([]);
    expect(imported.tombstones).toEqual({ sites: {}, shifts: {}, favorites: {}, expenses: {} });
    expect(imported.settings.taxRatePercent).toBe(25); // compatibilità: l'aliquota unica diventa taxRatePercent
    expect(imported.settings.contributionsPercent).toBe(0);
  });

  it('accetta anche il file senza l\'involucro {app, state} (solo lo stato grezzo)', () => {
    const imported = importBackupFromText(JSON.stringify(baseState()));
    expect(imported.shifts).toHaveLength(1);
  });
});
