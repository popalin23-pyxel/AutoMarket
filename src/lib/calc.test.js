import { describe, it, expect } from 'vitest';
import {
  hoursOfShift, monthDays, weekdayOf, startOfWeek, endOfWeek,
  holidaysOfYear, isHoliday, dayKind,
  shiftsInMonth, shiftsOnDay, shiftsInRange, shiftsToday, nextShiftAfter,
  computeMonthSummary, computeYearSummary, compareMonths, compareWeeks,
} from './calc.js';

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
});
