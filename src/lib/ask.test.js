import { describe, it, expect } from 'vitest';
import { answer, answerText, questionText, defaultParams, periodPresets, periodText, askSites, QUESTIONS } from './ask.js';
import { sanitizeState } from './store.js';

// "adesso": mercoledì 28 ottobre 2026, ore 10
const NOW = new Date(2026, 9, 28, 10, 0);
const preset = (id) => periodPresets(NOW).find((p) => p.id === id).period;

function sample() {
  return sanitizeState({
    sites: [
      { id: 1, name: 'CDS', color: '#2dd4bf', rate: 27 },
      { id: 2, name: 'Ravera', color: '#f59e0b', rate: 28 },
      { id: 3, name: 'Mai usata', color: '#818cf8', rate: 30 },
    ],
    shifts: [
      { id: 1, date: '2026-09-10', siteId: 1, start: '07:00', end: '14:00' },   // 7h
      { id: 2, date: '2026-09-12', siteId: 1, start: '20:00', end: '08:00' },   // notte 12h
      { id: 3, date: '2026-10-05', siteId: 1, start: '07:00', end: '14:00' },   // 7h
      { id: 4, date: '2026-10-06', siteId: 2, start: '07:30', end: '13:30' },   // 6h
      { id: 5, date: '2026-10-10', siteId: 2, start: '20:00', end: '08:00' },   // notte 12h
      { id: 6, date: '2026-10-12', siteId: 1, start: '07:00', end: '14:00', status: 'cancelled' }, // non fatto
      { id: 7, date: '2026-10-30', siteId: 1, start: '07:00', end: '14:00' },   // in programma, 7h
      { id: 8, date: '2025-11-03', siteId: 1, start: '07:00', end: '15:00' },   // anno scorso, 8h
    ],
    expenses: [
      { id: 1, date: '2026-10-02', category: 'carburante', amount: 60 },
      { id: 2, date: '2026-10-20', category: 'carburante', amount: 25.4 },
      { id: 3, date: '2026-10-21', category: 'parcheggio', amount: 12 },
    ],
    settings: { taxMode: 'semplice', taxRatePercent: 15, contributionsPercent: 10, rivalsaPercent: 4, monthlyGoal: 2000 },
  });
}
const ask = (id, params, state = sample()) => answer(id, { ...defaultParams(id, NOW), ...params }, state, NOW);
const text = (id, params, state) => answerText(ask(id, params, state));

describe('Chiedi a Turnio: periodi e domande', () => {
  it('il periodo si legge in italiano', () => {
    expect(periodText(preset('thisMonth'), NOW)).toBe('a ottobre');
    expect(periodText({ type: 'month', y: 2026, m: 4 }, NOW)).toBe('ad aprile');
    expect(periodText({ type: 'month', y: 2025, m: 11 }, NOW)).toBe('a novembre 2025');
    expect(periodText(preset('thisYear'), NOW)).toBe('quest’anno');
    expect(periodText(preset('lastYear'), NOW)).toBe('nel 2025');
  });

  it('la domanda si scrive con periodo e sede', () => {
    const s = sample();
    expect(questionText('earned', { period: preset('thisMonth'), siteId: 1 }, s, NOW)).toBe('Quanto ho guadagnato a ottobre da CDS?');
    expect(questionText('nights', { period: preset('thisYear'), siteId: null }, s, NOW)).toBe('Quante notti ho fatto quest’anno?');
    expect(questionText('bestMonth', { period: { type: 'all' } }, s, NOW)).toBe('Qual è stato il mio mese migliore di sempre?');
  });

  it('tra le sedi da scegliere ci sono solo quelle con turni', () => {
    expect(askSites(sample()).map((x) => x.name)).toEqual(['CDS', 'Ravera']);
  });

  it('ogni domanda dà una risposta anche senza dati', () => {
    const empty = sanitizeState({});
    for (const q of QUESTIONS) expect(answerText(answer(q.id, defaultParams(q.id, NOW), empty, NOW)).length).toBeGreaterThan(10);
  });
});

describe('Chiedi a Turnio: risposte', () => {
  it('guadagnato questo mese: solo i turni fatti, con quelli in programma a parte', () => {
    // ottobre fatto: 7h×27 + 6h×28 + 12h×28 = 189 + 504 = 693 → +4% = 720,72; tasse 25% → netto 540,54
    const t = text('earned');
    expect(t).toContain('A ottobre finora hai lavorato 25 ore e fatturato €720,72, rivalsa compresa.');
    expect(t).toContain('ti restano €540,54');
    // in programma 7h×27 = 189 → 196,56 → netto 147,42; totale 687,96
    expect(t).toContain('In programma ci sono altre 7 ore: con quelle arrivi a €687,96 netti.');
    expect(ask('earned').table.rows).toEqual([['Ravera', '€524,16'], ['CDS', '€196,56']]);
  });

  it('guadagnato da una sede sola, mese passato', () => {
    const t = text('earned', { period: preset('lastMonth'), siteId: 1 });
    expect(t).toContain('A settembre da CDS hai lavorato 19 ore e fatturato €533,52');
    expect(t).toContain('ti sono rimasti €400,14');
    expect(t).not.toContain('In programma');
  });

  it('il turno "non fatto" non conta', () => {
    expect(text('worked')).toContain('hai fatto 3 turni in 3 giorni, per 25 ore.');
  });

  it('lavorato: turni, giorni, ore, notti e programma', () => {
    const a = ask('worked');
    expect(answerText(a)).toContain('Di questi, 1 era una notte.');
    expect(answerText(a)).toContain('In programma c’è un altro turno (7 ore).');
    expect(a.table.rows).toEqual([['Ravera', '2 turni · 18 ore'], ['CDS', '1 turno · 7 ore']]);
  });

  it('notti dell\'anno, con il confronto con i turni di giorno', () => {
    // notti 2026: 12h×27 (CDS) + 12h×28 (Ravera) = 660 → netto 660×1,04×0,75 = 514,80 → 21,45/h
    const t = text('nights');
    expect(t).toContain('Quest’anno finora hai fatto 2 notti (24 ore).');
    expect(t).toContain('ti hanno reso €514,80, cioè €21,45 netti l’ora');
    expect(t).toContain('i turni di giorno: ');
    expect(ask('nights').table.rows.map((r) => r[0])).toEqual(['Ravera · 1 notte', 'CDS · 1 notte']);
  });

  it('quale struttura paga di più all\'ora', () => {
    const a = ask('bestSite');
    expect(answerText(a)).toContain('la struttura che ti rende di più è Ravera: €21,84 netti per ogni ora (paga €28,00).');
    expect(a.table.rows).toEqual([['Ravera', '€21,84'], ['CDS', '€21,06']]);
  });

  it('mese migliore dell\'anno e di sempre', () => {
    const a = ask('bestMonth');
    expect(answerText(a)).toContain('Quest’anno il tuo mese migliore è ottobre: €540,54 netti con 25 ore (ed è ancora in corso).');
    expect(a.table.rows[1]).toEqual(['Settembre', '€400,14']);
    expect(text('bestMonth', { period: { type: 'all' } })).toContain('Il tuo mese migliore di sempre è ottobre 2026');
    expect(text('bestMonth', { period: preset('lastYear') })).toContain('Nel 2025 il tuo mese migliore è stato novembre: ');
  });

  it('obiettivo: quanto manca e quante ore servono', () => {
    const t = text('goal');
    expect(t).toContain('Finora a ottobre sei a €540,54 netti su €2.000,00 (27%).');
    expect(t).toContain('Con i turni in programma arrivi a €687,96: ti mancano ancora €1.312,04.');
    expect(t).toMatch(/sono circa \d+ ore di lavoro in più \(\d+ turni da 8 ore\)\./);
  });

  it('obiettivo non impostato: porta a impostarlo', () => {
    const s = sample(); s.settings.monthlyGoal = 0;
    const a = ask('goal', {}, s);
    expect(answerText(a)).toBe('Non hai ancora impostato un obiettivo mensile.');
    expect(a.action.route).toEqual(['altro', 'goal']);
  });

  it('spese del mese per tipo', () => {
    const a = ask('spent');
    expect(answerText(a)).toBe('A ottobre hai speso €97,40 in 3 spese.');
    expect(a.table.rows).toEqual([['Carburante', '€85,40'], ['Parcheggio', '€12,00']]);
    expect(text('spent', { period: preset('lastMonth') })).toBe('A settembre non hai registrato spese.');
  });
});
