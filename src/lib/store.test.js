import { describe, it, expect } from 'vitest';
import {
  removeShift, addShift, updateShift, restoreShift, removeSite, removeFavorite, removeExpense,
  addOccasionalWork, removeOccasionalWork, updateSettings,
  importBackupFromText, replaceAllData, clearAllData, sanitizeState,
} from './store.js';
import { mergeStates, sameData } from './mergeState.js';

const baseState = () => ({
  sites: [{ id: 1, name: 'CDS', color: '#14b8a6', rate: 27, rivalsaPercent: 4 }],
  shifts: [{ id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00', note: '' }],
  favorites: [{ id: 1, siteId: 1, start: '06:00', end: '14:00', label: 'CDS mattina' }],
  expenses: [{ id: 1, date: '2026-09-01', category: 'altro', amount: 50, note: '' }],
  occasionalWork: [{ id: 1, date: '2026-09-01', description: 'Consulenza', grossAmount: 200, note: '' }],
  lastSiteId: 1,
  settings: { taxRatePercent: 15, contributionsPercent: 10, taxPercent: 25, rivalsaPercent: 4, monthlyGoal: 4000, occasionalTaxRatePercent: 23 },
  seq: { site: 2, shift: 2, favorite: 2, expense: 2, occasionalWork: 2 },
  tombstones: { sites: {}, shifts: {}, favorites: {}, expenses: {}, occasionalWork: {} },
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

  it('eliminare una sede / scorciatoia / spesa / prestazione occasionale registra il tombstone nella collezione giusta', () => {
    expect(removeSite(baseState(), 1).tombstones.sites[1]).toBeTypeOf('number');
    expect(removeFavorite(baseState(), 1).tombstones.favorites[1]).toBeTypeOf('number');
    expect(removeExpense(baseState(), 1).tombstones.expenses[1]).toBeTypeOf('number');
    expect(removeOccasionalWork(baseState(), 1).tombstones.occasionalWork[1]).toBeTypeOf('number');
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

describe('prestazioni occasionali', () => {
  it('addOccasionalWork aggiunge una voce con id nuovo e univoco, senza sede/orario', () => {
    const next = addOccasionalWork(baseState(), { date: '2026-09-15', description: 'Corso formazione', grossAmount: 150, note: '' });
    expect(next.occasionalWork).toHaveLength(2);
    const added = next.occasionalWork[1];
    expect(added).toMatchObject({ description: 'Corso formazione', grossAmount: 150 });
    expect(added.id).not.toBe(1);
    expect(next.seq.occasionalWork).toBe(added.id + 1);
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
    expect(imported.occasionalWork).toHaveLength(1);
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
    expect(imported.occasionalWork).toEqual([]);
    expect(imported.tombstones).toEqual({ sites: {}, shifts: {}, favorites: {}, expenses: {}, occasionalWork: {} });
    expect(imported.settings.taxRatePercent).toBe(25); // compatibilità: l'aliquota unica diventa taxRatePercent
    expect(imported.settings.contributionsPercent).toBe(0);
  });

  it('dati salvati prima dell\'Anagrafica: nome e turni restano, i nuovi campi arrivano vuoti', () => {
    const before = { ...baseState(), settings: { taxPercent: 25, displayName: 'Maria Rossi', monthlyGoal: 3000 } };
    const imported = importBackupFromText(wrap(before));
    expect(imported.settings.displayName).toBe('Maria Rossi');
    expect(imported.settings.monthlyGoal).toBe(3000);
    expect(imported.settings.professionalRole).toBe('');
    expect(imported.settings.professionalRoleOther).toBe('');
    expect(imported.settings.vatNumber).toBe('');
    expect(imported.shifts).toHaveLength(1);
    expect(imported.sites).toHaveLength(1);
  });

  it('il ruolo "Medica", non più disponibile, diventa "Medico"', () => {
    const imported = importBackupFromText(wrap({ ...baseState(), settings: { taxPercent: 25, professionalRole: 'medica' } }));
    expect(imported.settings.professionalRole).toBe('medico');
  });

  it('accetta anche il file senza l\'involucro {app, state} (solo lo stato grezzo)', () => {
    const imported = importBackupFromText(JSON.stringify(baseState()));
    expect(imported.shifts).toHaveLength(1);
  });
});

describe('sincronizzazione tra dispositivi: id e timestamp di modifica', () => {
  it('due dispositivi che aggiungono un turno partendo dallo stesso stato ottengono id diversi', () => {
    const start = baseState();
    const a = addShift(start, { date: '2026-10-01', siteId: 1, start: '07:00', end: '14:00' });
    const b = addShift(start, { date: '2026-10-02', siteId: 1, start: '19:00', end: '07:00' });
    expect(a.shifts[1].id).not.toBe(b.shifts[1].id);
  });

  it('aggiunte ripetute nello stesso istante (es. "ripeti ogni settimana") hanno id tutti diversi e crescenti', () => {
    let s = baseState();
    for (let i = 0; i < 12; i++) s = addShift(s, { date: `2026-10-${String(i + 1).padStart(2, '0')}`, siteId: 1, start: '07:00', end: '14:00' });
    const ids = s.shifts.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1]);
  });

  it('creazione e modifica registrano quando è avvenuta (_u), le impostazioni settingsUpdatedAt', () => {
    const before = Date.now();
    const s1 = addShift(baseState(), { date: '2026-10-01', siteId: 1, start: '07:00', end: '14:00' });
    expect(s1.shifts[1]._u).toBeGreaterThanOrEqual(before);
    const s2 = updateShift(s1, 1, { note: 'cambio' });
    expect(s2.shifts.find((x) => x.id === 1)._u).toBeGreaterThanOrEqual(before);
    expect(updateSettings(baseState(), { monthlyGoal: 5000 }).settingsUpdatedAt).toBeGreaterThanOrEqual(before);
  });

  it('il ripristino ("Annulla") è più recente dell\'eliminazione', () => {
    const deleted = removeShift(baseState(), 1);
    const restored = restoreShift(deleted, baseState().shifts[0]);
    expect(restored.shifts[0]._u).toBeGreaterThanOrEqual(deleted.tombstones.shifts[1]);
  });
});

describe('ripristino backup e "Azzera tutti i dati" arrivano anche all\'altro telefono', () => {
  // l'altro telefono / il cloud hanno ancora i dati di prima, modificati prima dell'operazione
  const old = () => sanitizeState({
    ...baseState(),
    shifts: [{ id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00', _u: 100 }, { id: 7, date: '2026-09-07', siteId: 1, start: '06:00', end: '14:00', _u: 100 }],
    settingsUpdatedAt: 100,
  });

  it('azzerare: dopo l\'unione con i dati vecchi resta tutto vuoto (prima ricompariva tutto)', () => {
    const cleared = clearAllData(old());
    expect(cleared.shifts).toHaveLength(0);
    expect(cleared.sites).toHaveLength(0);
    const merged = mergeStates(old(), cleared); // l'altro telefono riceve l'azzeramento
    expect(merged.shifts).toHaveLength(0);
    expect(merged.sites).toHaveLength(0);
    expect(merged.occasionalWork).toHaveLength(0);
    expect(merged.settings.monthlyGoal).toBe(cleared.settings.monthlyGoal);
    expect(sameData(mergeStates(cleared, old()), cleared)).toBe(true); // e viceversa
  });

  it('ripristino backup: tornano i dati del backup, spariscono quelli aggiunti dopo', () => {
    const backup = sanitizeState({ ...baseState(), settings: { ...baseState().settings, monthlyGoal: 1234 } }); // solo turno 1
    const deletedLater = removeShift(old(), 1); // turno 1 eliminato dopo il backup
    const restored = replaceAllData(deletedLater, backup);
    expect(restored.shifts.map((x) => x.id)).toEqual([1]);
    const merged = mergeStates(old(), restored);
    expect(merged.shifts.map((x) => x.id)).toEqual([1]);
    expect(merged.settings.monthlyGoal).toBe(1234);
  });
});
