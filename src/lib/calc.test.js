import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hoursOfShift, monthDays, weekdayOf, startOfWeek, endOfWeek, addDaysISO,
  holidaysOfYear, isHoliday, dayKind,
  shiftsInMonth, shiftsOnDay, shiftsInRange, shiftsToday, nextShiftAfter,
  computeMonthSummary, computeYearSummary, compareMonths, compareWeeks,
  computeMonthProgress, shiftsToConfirm, isShiftDone, shiftEndDate, siteRateOn, shiftRate, computeTimesheet,
  computeTaxes, freeDays, availabilityText, countMarks,
} from './calc.js';
import { changeSiteRate } from './store.js';

describe('prestazioni occasionali — tassate separatamente dal regime forfettario', () => {
  const sites = [{ id: 1, name: 'CDS', color: '#000', rate: 20, rivalsaPercent: 4 }];
  const settings = { taxPercent: 25, rivalsaPercent: 4, occasionalTaxRatePercent: 23 };
  const shifts = [{ id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00' }]; // 160€ + rivalsa
  const occasionalWork = [
    { id: 1, date: '2026-09-05', description: 'Consulenza', grossAmount: 200 },
    { id: 2, date: '2026-09-20', description: 'Corso', grossAmount: 100 },
    { id: 3, date: '2026-10-01', description: 'Fuori mese', grossAmount: 999 }, // non deve contare
  ];

  it('somma le prestazioni occasionali del mese separatamente dal fatturato delle sedi', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9, occasionalWork);
    expect(sum.occasionalCount).toBe(2);
    expect(sum.occasionalGross).toBe(300); // 200 + 100, non 999 (fuori mese)
  });

  it('le tassa con l\'aliquota configurata a parte, non con quella del regime forfettario, e senza rivalsa', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9, occasionalWork);
    expect(sum.occasionalTaxes).toBeCloseTo(300 * 0.23, 5); // 23%, non 25% del regime forfettario
    expect(sum.occasionalNet).toBeCloseTo(300 - 300 * 0.23, 5);
    // il fatturato delle sedi non viene toccato dalle prestazioni occasionali
    expect(sum.totalInvoice).toBeCloseTo(166.4, 5); // 160€ + rivalsa 4%, invariato
  });

  it('netTotal somma il netto del lavoro nelle sedi e quello delle prestazioni occasionali', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9, occasionalWork);
    expect(sum.netTotal).toBeCloseTo(sum.net + sum.occasionalNet, 5);
  });

  it('senza prestazioni occasionali passate, tutto resta a zero (compatibilità con le chiamate esistenti)', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9);
    expect(sum.occasionalGross).toBe(0);
    expect(sum.netTotal).toBe(sum.net);
  });

  it('un mese con solo una prestazione occasionale (nessun turno) compare comunque nel riepilogo annuale', () => {
    const y = computeYearSummary([], sites, settings, 2026, [{ id: 1, date: '2026-03-10', description: 'Consulenza', grossAmount: 500 }]);
    expect(y.months).toHaveLength(1);
    expect(y.months[0].month).toBe(3);
    expect(y.occasionalGross).toBe(500);
    expect(y.totalNetAll).toBeCloseTo(y.totalNet + y.occasionalNet, 5);
  });
});

describe('addDaysISO', () => {
  it('somma giorni restando nello stesso mese', () => {
    expect(addDaysISO('2026-09-01', 7)).toBe('2026-09-08');
  });

  it('gestisce il cambio di mese e di anno', () => {
    expect(addDaysISO('2026-09-28', 7)).toBe('2026-10-05');
    expect(addDaysISO('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('sottrae giorni con delta negativo', () => {
    expect(addDaysISO('2026-09-05', -7)).toBe('2026-08-29');
  });
});

describe('hoursOfShift', () => {
  it('calcola un turno diurno normale', () => {
    expect(hoursOfShift({ start: '06:00', end: '14:00' })).toBe(8);
  });

  it('calcola un turno a cavallo di mezzanotte', () => {
    expect(hoursOfShift({ start: '22:00', end: '06:00' })).toBe(8);
  });

  it('gestisce i minuti', () => {
    expect(hoursOfShift({ start: '07:30', end: '13:30' })).toBe(6);
  });

  it('ritorna 0 se mancano start/end', () => {
    expect(hoursOfShift({ start: '07:00', end: '' })).toBe(0);
    expect(hoursOfShift({})).toBe(0);
  });

  it('ritorna 0 con orari non validi', () => {
    expect(hoursOfShift({ start: 'aa:bb', end: '10:00' })).toBe(0);
  });
});

describe('monthDays', () => {
  it('conta i giorni dei mesi normali', () => {
    expect(monthDays(2026, 1)).toBe(31);
    expect(monthDays(2026, 4)).toBe(30);
  });

  it('gestisce febbraio bisestile e non', () => {
    expect(monthDays(2024, 2)).toBe(29); // bisestile
    expect(monthDays(2026, 2)).toBe(28); // non bisestile
  });
});

describe('weekdayOf / settimane', () => {
  it('1 gennaio 2024 è lunedì (indice 0)', () => {
    expect(weekdayOf(2024, 1, 1)).toBe(0);
  });

  it('startOfWeek/endOfWeek delimitano lunedì-domenica', () => {
    // 2026-09-28 è un lunedì (system date di riferimento)
    expect(startOfWeek('2026-09-30')).toBe('2026-09-28');
    expect(endOfWeek('2026-09-30')).toBe('2026-10-04');
  });
});

describe('holidaysOfYear', () => {
  it('include le festività fisse', () => {
    const set = holidaysOfYear(2026);
    expect(set.has('1-1')).toBe(true);   // Capodanno
    expect(set.has('12-25')).toBe(true); // Natale
    expect(set.has('4-25')).toBe(true);  // Liberazione
  });

  it('calcola correttamente Pasqua e Pasquetta (2024: 31 marzo / 1 aprile)', () => {
    const set = holidaysOfYear(2024);
    expect(set.has('3-31')).toBe(true);
    expect(set.has('4-1')).toBe(true);
  });

  it('isHoliday e dayKind rispecchiano il set festività', () => {
    const set = holidaysOfYear(2026);
    expect(isHoliday(2026, 1, 1, set)).toBe(true);
    expect(isHoliday(2026, 1, 2, set)).toBe(false);
    expect(dayKind(2026, 1, 1, set)).toBe('weekend'); // festivo -> trattato come weekend
  });
});

describe('filtri turni', () => {
  const shifts = [
    { id: 1, date: '2026-09-05', siteId: 1, start: '06:00', end: '14:00' },
    { id: 2, date: '2026-09-05', siteId: 1, start: '14:00', end: '22:00' },
    { id: 3, date: '2026-10-01', siteId: 2, start: '07:00', end: '13:00' },
  ];

  it('shiftsInMonth filtra per anno/mese', () => {
    expect(shiftsInMonth(shifts, 2026, 9)).toHaveLength(2);
    expect(shiftsInMonth(shifts, 2026, 10)).toHaveLength(1);
  });

  it('shiftsOnDay filtra per data esatta', () => {
    expect(shiftsOnDay(shifts, '2026-09-05')).toHaveLength(2);
    expect(shiftsOnDay(shifts, '2026-09-06')).toHaveLength(0);
  });

  it('shiftsInRange include gli estremi', () => {
    expect(shiftsInRange(shifts, '2026-09-05', '2026-09-05')).toHaveLength(2);
    expect(shiftsInRange(shifts, '2026-09-06', '2026-09-30')).toHaveLength(0);
  });

  it('shiftsToday ordina per orario di inizio', () => {
    const today = shiftsToday(shifts, '2026-09-05');
    expect(today.map((s) => s.id)).toEqual([1, 2]);
  });

  it('nextShiftAfter trova il primo turno futuro', () => {
    expect(nextShiftAfter(shifts, '2026-09-05').id).toBe(3);
    expect(nextShiftAfter(shifts, '2026-10-01')).toBeNull();
  });
});

describe('computeMonthSummary — il cuore del calcolo economico', () => {
  const sites = [
    { id: 1, name: 'CDS', color: '#000', rate: 20, rivalsaPercent: 4 },
    { id: 2, name: 'Ravera', color: '#111', rate: 30, rivalsaPercent: null }, // usa il default delle impostazioni
  ];
  const settings = { taxPercent: 25, rivalsaPercent: 4 };
  const shifts = [
    // CDS: 8h a 20€/h = 160€, rivalsa 4% = 6.40€, totale 166.40€
    { id: 1, date: '2026-09-01', siteId: 1, start: '06:00', end: '14:00' },
    // Ravera: 10h a 30€/h = 300€, rivalsa (default 4%) = 12€, totale 312€
    { id: 2, date: '2026-09-02', siteId: 2, start: '07:00', end: '17:00' },
    // fuori mese, non deve contare
    { id: 3, date: '2026-10-01', siteId: 1, start: '06:00', end: '14:00' },
  ];

  it('calcola ore, fatturato, rivalsa, tasse e netto correttamente', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9);
    expect(sum.shiftCount).toBe(2);
    expect(sum.totalHours).toBe(18); // 8 + 10
    expect(sum.totalRevenue).toBe(460); // 160 + 300
    expect(sum.totalRivalsa).toBeCloseTo(18.4, 5); // 6.40 + 12
    expect(sum.totalInvoice).toBeCloseTo(478.4, 5);
    const expectedTaxes = 478.4 * 0.25;
    expect(sum.taxes).toBeCloseTo(expectedTaxes, 2);
    expect(sum.net).toBeCloseTo(478.4 - expectedTaxes, 2);
  });

  it('la rivalsa per sede sovrascrive quella di default', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 9);
    const cds = sum.perSite.find((p) => p.siteId === 1);
    const ravera = sum.perSite.find((p) => p.siteId === 2);
    expect(cds.rivalsaPercent).toBe(4);
    expect(ravera.rivalsaPercent).toBe(4); // eredita il default (anche se coincide col valore della sede)
  });

  it('un mese senza turni ha tutto a zero', () => {
    const sum = computeMonthSummary(shifts, sites, settings, 2026, 1);
    expect(sum.shiftCount).toBe(0);
    expect(sum.totalHours).toBe(0);
    expect(sum.net).toBe(0);
  });

  it('turni con sede eliminata (siteId inesistente) hanno ore ma 0€', () => {
    const sum = computeMonthSummary(
      [{ id: 9, date: '2026-09-10', siteId: 999, start: '06:00', end: '10:00' }],
      sites, settings, 2026, 9,
    );
    const unknown = sum.perSite.find((p) => p.siteId === null);
    expect(unknown.hours).toBe(4);
    expect(unknown.total).toBe(0);
  });
});

describe('computeYearSummary', () => {
  const sites = [{ id: 1, name: 'CDS', color: '#000', rate: 20, rivalsaPercent: 0 }];
  const settings = { taxPercent: 20, rivalsaPercent: 0 };
  const shifts = [
    { id: 1, date: '2026-01-10', siteId: 1, start: '06:00', end: '14:00' }, // 8h = 160€
    { id: 2, date: '2026-02-10', siteId: 1, start: '06:00', end: '14:00' }, // 8h = 160€
  ];

  it('somma solo i mesi con turni e totalizza correttamente', () => {
    const y = computeYearSummary(shifts, sites, settings, 2026);
    expect(y.months).toHaveLength(2);
    expect(y.totalHours).toBe(16);
    expect(y.totalInvoice).toBe(320);
    expect(y.totalTaxes).toBeCloseTo(64, 5);
    expect(y.totalNet).toBeCloseTo(256, 5);
  });
});

describe('confronti periodo su periodo', () => {
  const sites = [{ id: 1, name: 'CDS', color: '#000', rate: 25, rivalsaPercent: 0 }];
  const settings = { taxPercent: 20, rivalsaPercent: 0 };

  it('ritorna null ("nuovo") quando non c\'è dato precedente ma c\'è quello corrente', () => {
    const shifts = [{ id: 1, date: '2026-09-05', siteId: 1, start: '06:00', end: '14:00' }];
    const cmp = compareMonths(shifts, sites, settings, 2026, 9);
    expect(cmp.deltaHoursPct).toBeNull();
  });

  it('ritorna 0 quando né corrente né precedente hanno dati', () => {
    const cmp = compareMonths([], sites, settings, 2026, 9);
    expect(cmp.deltaHoursPct).toBe(0);
  });

  it('calcola correttamente la percentuale di variazione', () => {
    const shifts = [
      { id: 1, date: '2026-08-01', siteId: 1, start: '06:00', end: '14:00' }, // agosto: 8h
      { id: 2, date: '2026-09-01', siteId: 1, start: '06:00', end: '18:00' }, // settembre: 12h (+50%)
    ];
    const cmp = compareMonths(shifts, sites, settings, 2026, 9);
    expect(cmp.deltaHoursPct).toBe(50);
  });

  it('compareWeeks confronta la settimana corrente con la precedente', () => {
    const shifts = [
      { id: 1, date: '2026-09-21', siteId: 1, start: '06:00', end: '14:00' }, // settimana precedente
      { id: 2, date: '2026-09-28', siteId: 1, start: '06:00', end: '14:00' }, // settimana di riferimento
    ];
    const cmp = compareWeeks(shifts, sites, settings, '2026-09-30');
    expect(cmp.current.totalHours).toBe(8);
    expect(cmp.previous.totalHours).toBe(8);
    expect(cmp.deltaHoursPct).toBe(0);
  });

  it('il confronto del netto tiene conto anche delle prestazioni occasionali', () => {
    const occasionalWork = [{ id: 1, date: '2026-09-10', description: 'Consulenza', grossAmount: 1000 }];
    const settingsWithOcc = { ...settings, occasionalTaxRatePercent: 0 }; // per un confronto diretto, niente tasse
    const withOcc = compareMonths([], sites, settingsWithOcc, 2026, 9, occasionalWork);
    const withoutOcc = compareMonths([], sites, settingsWithOcc, 2026, 9);
    expect(withOcc.current.netTotal).toBe(1000);
    expect(withoutOcc.current.netTotal).toBe(0);
  });
});

describe('hoursOfShift: notti del cambio d\'ora (fuso italiano)', () => {
  const prevTZ = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Europe/Rome'; });
  afterAll(() => { process.env.TZ = prevTZ; });

  it('notte tra 24 e 25 ottobre 2026 (torna l\'ora solare): 20:00-08:00 sono 13 ore lavorate', () => {
    expect(hoursOfShift({ date: '2026-10-24', start: '20:00', end: '08:00' })).toBe(13);
  });

  it('notte tra 27 e 28 marzo 2027 (ora legale): 20:00-08:00 sono 11 ore lavorate', () => {
    expect(hoursOfShift({ date: '2027-03-27', start: '20:00', end: '08:00' })).toBe(11);
  });

  it('le altre notti e i turni di giorno non cambiano', () => {
    expect(hoursOfShift({ date: '2026-10-17', start: '20:00', end: '08:00' })).toBe(12);
    expect(hoursOfShift({ date: '2026-10-25', start: '07:00', end: '14:00' })).toBe(7);
    expect(hoursOfShift({ date: '2026-10-25', start: '20:00', end: '08:00' })).toBe(12);
  });

  it('il compenso del mese conta l\'ora in più', () => {
    const sites = [{ id: 1, name: 'CDS', rate: 30, rivalsaPercent: 0 }];
    const settings = { taxRatePercent: 0, contributionsPercent: 0, rivalsaPercent: 0 };
    const sum = computeMonthSummary([{ id: 1, date: '2026-10-24', siteId: 1, start: '20:00', end: '08:00' }], sites, settings, 2026, 10, []);
    expect(sum.totalHours ?? sum.hours).toBe(13);
  });
});

describe('turni svolti, in programma, annullati e da confermare', () => {
  const sites = [{ id: 1, name: 'CDS', rate: 20, rivalsaPercent: 0 }];
  const settings = { taxPercent: 0, rivalsaPercent: 0 };
  const now = new Date(2026, 9, 15, 12, 0); // 15 ottobre 2026, ore 12
  const sh = (id, date, start, end, extra = {}) => ({ id, date, siteId: 1, start, end, ...extra });

  it('fine del turno: stesso giorno o mattina dopo per le notti', () => {
    expect(shiftEndDate(sh(1, '2026-10-15', '07:00', '14:00'))).toEqual(new Date(2026, 9, 15, 14, 0));
    expect(shiftEndDate(sh(1, '2026-10-14', '20:00', '08:00'))).toEqual(new Date(2026, 9, 15, 8, 0));
  });

  it('un turno è "svolto" solo quando è finito', () => {
    expect(isShiftDone(sh(1, '2026-10-15', '07:00', '11:00'), now)).toBe(true);
    expect(isShiftDone(sh(1, '2026-10-15', '07:00', '14:00'), now)).toBe(false); // in corso
    expect(isShiftDone(sh(1, '2026-10-14', '20:00', '08:00'), now)).toBe(true);
  });

  it('il mese si divide tra già lavorato e in programma; il totale è la previsione', () => {
    const shifts = [sh(1, '2026-10-01', '08:00', '12:00'), sh(2, '2026-10-15', '07:00', '14:00'), sh(3, '2026-10-20', '08:00', '12:00')];
    const p = computeMonthProgress(shifts, sites, settings, 2026, 10, [], now);
    expect(p.done.totalHours).toBe(4);
    expect(p.planned.totalHours).toBe(11);
    expect(p.total.totalHours).toBe(15);
    expect(p.done.net + p.planned.net).toBeCloseTo(p.total.net);
  });

  it('un turno annullato resta salvato ma non conta in ore e guadagni', () => {
    const shifts = [sh(1, '2026-10-01', '08:00', '12:00'), sh(2, '2026-10-02', '08:00', '12:00', { status: 'cancelled' })];
    const m = computeMonthSummary(shifts, sites, settings, 2026, 10, []);
    expect(m.totalHours).toBe(4);
    expect(m.shiftCount).toBe(1);
  });

  it('da confermare: solo turni finiti da poco, segnati prima della fine e senza risposta', () => {
    const before = new Date(2026, 9, 1).getTime();
    const shifts = [
      sh(1, '2026-10-14', '08:00', '12:00', { _u: before }),                  // sì
      sh(2, '2026-10-14', '14:00', '20:00', { _u: before, status: 'done' }),  // già confermato
      sh(3, '2026-10-13', '08:00', '12:00', { _u: before, status: 'cancelled' }),
      sh(4, '2026-10-20', '08:00', '12:00', { _u: before }),                  // futuro
      sh(5, '2026-09-01', '08:00', '12:00', { _u: before - 40 * 86400000 }),  // troppo vecchio
      sh(6, '2026-10-14', '08:00', '12:00', { _u: now.getTime() }),           // inserito a cose fatte
      sh(7, '2026-10-14', '08:00', '12:00'),                                  // dati vecchi senza data di modifica
    ];
    expect(shiftsToConfirm(shifts, now).map((s) => s.id)).toEqual([1]);
  });
});

describe('tariffe: nuova paga "a partire dal…" e tariffa del singolo turno', () => {
  const settings = { taxPercent: 0, rivalsaPercent: 0 };
  const site0 = { id: 1, name: 'CDS', rate: 25, rivalsaPercent: 0 };
  const shifts = [
    { id: 1, date: '2026-10-10', siteId: 1, start: '08:00', end: '12:00' }, // prima del cambio
    { id: 2, date: '2026-11-05', siteId: 1, start: '08:00', end: '12:00' }, // dopo
  ];

  it('cambio dal 1° novembre: i turni di ottobre restano a 25 €/h, quelli di novembre a 30', () => {
    const st = changeSiteRate({ sites: [site0] }, 1, 30, '2026-11-01');
    const site = st.sites[0];
    expect(site.rate).toBe(30);
    expect(siteRateOn(site, '2026-10-31')).toBe(25);
    expect(siteRateOn(site, '2026-11-01')).toBe(30);
    expect(computeMonthSummary(shifts, st.sites, settings, 2026, 10).totalRevenue).toBe(100);
    expect(computeMonthSummary(shifts, st.sites, settings, 2026, 11).totalRevenue).toBe(120);
  });

  it('più cambi uno dopo l\'altro: ogni periodo tiene la sua tariffa', () => {
    let st = changeSiteRate({ sites: [site0] }, 1, 30, '2026-11-01');
    st = changeSiteRate(st, 1, 32, '2027-01-01');
    const site = st.sites[0];
    expect([siteRateOn(site, '2026-10-01'), siteRateOn(site, '2026-12-01'), siteRateOn(site, '2027-02-01')]).toEqual([25, 30, 32]);
  });

  it('una correzione senza data vale per tutti i turni e cancella lo storico', () => {
    let st = changeSiteRate({ sites: [site0] }, 1, 30, '2026-11-01');
    st = changeSiteRate(st, 1, 28);
    expect(siteRateOn(st.sites[0], '2026-10-01')).toBe(28);
    expect(st.sites[0].pastRates).toEqual([]);
  });

  it('una data precedente a un cambio già fatto lo sostituisce', () => {
    let st = changeSiteRate({ sites: [site0] }, 1, 30, '2026-11-01');
    st = changeSiteRate(st, 1, 27, '2026-09-01');
    const site = st.sites[0];
    expect([siteRateOn(site, '2026-08-31'), siteRateOn(site, '2026-10-01'), siteRateOn(site, '2026-12-01')]).toEqual([25, 27, 27]);
  });

  it('tariffa speciale di un turno e media nel riepilogo quando le tariffe sono diverse', () => {
    const special = [...shifts.slice(0, 1), { id: 3, date: '2026-10-11', siteId: 1, start: '08:00', end: '12:00', rate: 40 }];
    expect(shiftRate(special[1], site0)).toBe(40);
    const m = computeMonthSummary(special, [site0], settings, 2026, 10);
    expect(m.totalRevenue).toBe(260);
    expect(m.perSite[0].mixedRate).toBe(true);
    expect(m.perSite[0].rate).toBe(32.5);
  });
});

describe('foglio ore di una struttura', () => {
  const site = { id: 1, name: 'CDS', rate: 25, rivalsaPercent: 4 };
  const shifts = [
    { id: 3, date: '2026-10-12', siteId: 1, start: '14:00', end: '20:00', note: 'cambio' },
    { id: 1, date: '2026-10-05', siteId: 1, start: '08:00', end: '14:00' },
    { id: 2, date: '2026-10-06', siteId: 2, start: '08:00', end: '14:00' },                 // altra sede
    { id: 4, date: '2026-10-07', siteId: 1, start: '08:00', end: '14:00', status: 'cancelled' },
    { id: 5, date: '2026-11-02', siteId: 1, start: '08:00', end: '14:00' },                 // fuori periodo
    { id: 6, date: '2026-10-20', siteId: 1, start: '20:00', end: '08:00', rate: 30 },       // tariffa speciale
  ];

  it('solo i turni di quella sede nel periodo, in ordine, senza gli annullati', () => {
    const ts = computeTimesheet(shifts, site, { rivalsaPercent: 0 }, '2026-10-01', '2026-10-31');
    expect(ts.rows.map((r) => r.id)).toEqual([1, 3, 6]);
    expect(ts.rows[1].note).toBe('cambio');
  });

  it('totali: ore × tariffa di ogni turno, più la rivalsa della sede', () => {
    const ts = computeTimesheet(shifts, site, { rivalsaPercent: 0 }, '2026-10-01', '2026-10-31');
    expect(ts.totalHours).toBe(24);
    expect(ts.revenue).toBe(6 * 25 + 6 * 25 + 12 * 30);
    expect(ts.rivalsaPercent).toBe(4);
    expect(ts.rivalsa).toBe(26.4);
    expect(ts.total).toBe(686.4);
  });
});

describe('tasse: modalità semplice (com\'era) e forfettario esatto', () => {
  it('semplice: una % fissa di tutto il fatturato, rivalsa compresa (comportamento di prima)', () => {
    const t = computeTaxes(1000, 40, { taxPercent: 25, taxRatePercent: 15, contributionsPercent: 10 });
    expect(t.invoice).toBe(1040);
    expect(t.taxes).toBe(260);
    expect(t.net).toBe(780);
    expect(t.contributions).toBe(104);
    expect(t.incomeTax).toBe(156);
  });

  it('forfettario con integrativo ENPAPI: il 4% va alla cassa, reddito = compensi × 78%', () => {
    const settings = { taxMode: 'forfettario', forfTaxRatePercent: 15, forfContributionsPercent: 16, coefficientPercent: 78, rivalsaType: 'integrativo' };
    const t = computeTaxes(1000, 40, settings);
    expect(t.invoice).toBe(1040);       // in fattura
    expect(t.integrativo).toBe(40);     // da versare a ENPAPI
    expect(t.taxable).toBe(780);        // 1000 × 78%
    expect(t.contributions).toBe(124.8);// 16% di 780
    expect(t.incomeTax).toBe(98.28);    // 15% di (780 − 124,80)
    expect(t.net).toBe(776.92);         // 1000 − 124,80 − 98,28
    expect(t.taxes).toBeCloseTo(263.08, 2);
  });

  it('forfettario con rivalsa INPS: il 4% fa parte del compenso e si tassa', () => {
    const settings = { taxMode: 'forfettario', forfTaxRatePercent: 5, forfContributionsPercent: 26.07, coefficientPercent: 78, rivalsaType: 'rivalsa' };
    const t = computeTaxes(1000, 40, settings);
    expect(t.integrativo).toBe(0);
    expect(t.taxable).toBe(811.2);              // 1040 × 78%
    expect(t.contributions).toBe(211.48);       // 26,07% di 811,20
    expect(t.incomeTax).toBe(29.99);            // 5% di 599,72
    expect(t.net).toBe(798.53);
  });

  it('il riepilogo del mese usa la modalità scelta e ne riporta il dettaglio', () => {
    const sites = [{ id: 1, name: 'CDS', rate: 25, rivalsaPercent: 4 }];
    const shifts = [{ id: 1, date: '2026-10-05', siteId: 1, start: '08:00', end: '16:00' }];
    const settings = { taxMode: 'forfettario', forfTaxRatePercent: 15, forfContributionsPercent: 16, coefficientPercent: 78, rivalsaType: 'integrativo' };
    const m = computeMonthSummary(shifts, sites, settings, 2026, 10);
    expect(m.totalRevenue).toBe(200);
    expect(m.totalInvoice).toBe(208);
    expect(m.integrativo).toBe(8);
    expect(m.net).toBe(155.38);
    const y = computeYearSummary(shifts, sites, settings, 2026);
    expect(y.totalIntegrativo).toBe(8);
    expect(y.totalContributions).toBe(m.contributions);
  });
});

describe('disponibilità', () => {
  const sh = (date, start, end, extra = {}) => ({ id: date + start, date, siteId: 1, start, end, ...extra });
  const opts = { today: '2026-11-01' };

  it('giorni senza turni né assenze, esclusi il passato e lo smonto dopo una notte', () => {
    const shifts = [sh('2026-11-03', '08:00', '14:00'), sh('2026-11-05', '20:00', '08:00'), sh('2026-11-04', '08:00', '14:00', { status: 'cancelled' })];
    const marks = [{ id: 1, date: '2026-11-07', kind: 'ferie' }];
    const days = freeDays(shifts, marks, '2026-10-28', '2026-11-08', opts).map((d) => d.date);
    expect(days).toEqual(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-08']); // 3 turno, 5 notte, 6 smonto, 7 ferie
  });

  it('con i giorni parziali: dopo un turno di mattina o prima di uno di pomeriggio', () => {
    const shifts = [sh('2026-11-03', '07:00', '14:00'), sh('2026-11-04', '14:00', '21:00'), sh('2026-11-05', '10:00', '18:00')];
    const days = freeDays(shifts, [], '2026-11-03', '2026-11-05', { ...opts, includePartial: true });
    expect(days).toEqual([{ date: '2026-11-03', from: '14:00' }, { date: '2026-11-04', to: '14:00' }]);
  });

  it('testo: per mese, tre o più giorni di fila come intervallo', () => {
    const days = [
      { date: '2026-11-02' }, { date: '2026-11-03', from: '14:00' }, { date: '2026-11-10' }, { date: '2026-11-11' }, { date: '2026-11-12' },
      { date: '2026-11-20' }, { date: '2026-11-21' }, { date: '2026-12-01' },
    ];
    const text = availabilityText(days, { name: 'Maria Rossi' });
    expect(text).toContain('Novembre: lun 2, mar 3 (dalle 14:00), dal 10 al 12, ven 20, sab 21');
    expect(text).toContain('Dicembre: mar 1');
    expect(text.endsWith('Maria Rossi')).toBe(true);
  });
});

describe('correzioni dalla revisione', () => {
  it('disponibilità: un turno 16–24 non rende il giorno dopo di smonto', () => {
    const shifts = [{ id: 1, date: '2026-11-03', siteId: 1, start: '16:00', end: '00:00' }];
    expect(freeDays(shifts, [], '2026-11-03', '2026-11-05', { today: '2026-10-22' }).map((d) => d.date)).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('foglio ore: il compenso è la somma degli importi dei righi', () => {
    const site = { id: 1, name: 'CDS', rate: 22.5, rivalsaPercent: 0 };
    const shifts = [1, 2].map((d) => ({ id: d, date: `2026-11-0${d}`, siteId: 1, start: '07:00', end: '14:20' }));
    const ts = computeTimesheet(shifts, site, {}, '2026-11-01', '2026-11-30');
    expect(ts.revenue).toBeCloseTo(ts.rows.reduce((a, r) => a + r.amount, 0), 2);
  });

  it('turno rimesso in attesa con "Annulla" dopo "Non fatto": viene chiesto di nuovo', () => {
    const now = new Date(2026, 9, 15, 12, 0);
    const s = { id: 1, date: '2026-10-14', siteId: 1, start: '08:00', end: '12:00', _u: now.getTime(), askConfirm: true };
    expect(shiftsToConfirm([s], now).map((x) => x.id)).toEqual([1]);
  });

  it('ferie contate per giorno, anche se un\'unione ha lasciato due segni nello stesso giorno', () => {
    const marks = [
      { id: 'a', date: '2026-08-10', kind: 'ferie', _u: 1 },
      { id: 'b', date: '2026-08-10', kind: 'malattia', _u: 2 },
      { id: 'c', date: '2026-08-11', kind: 'ferie', _u: 1 },
    ];
    expect(countMarks(marks, '2026-')).toEqual({ malattia: 1, ferie: 1 });
  });
});
