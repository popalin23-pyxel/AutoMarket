import { describe, it, expect } from 'vitest';
import { computeServiceList, invoiceNotes, taxLines } from './services.js';
import { servicesExcelRows, periodLabel } from './servicesDoc.js';

const sites = [
  { id: 1, name: 'Clinica Rossi', color: '#000', rate: 40, rivalsaPercent: 4 },
  { id: 2, name: 'RSA Verdi', color: '#111', rate: 30, rivalsaPercent: 4 },
];
const shifts = [
  { id: 1, siteId: 1, date: '2026-11-05', start: '14:00', end: '20:00' },
  { id: 2, siteId: 1, date: '2026-11-03', start: '08:00', end: '14:00', note: 'Reparto A' },
  { id: 3, siteId: 2, date: '2026-11-10', start: '20:00', end: '08:00' },
  { id: 4, siteId: 2, date: '2026-11-12', start: '08:00', end: '14:00', status: 'cancelled' },
  { id: 5, siteId: 1, date: '2026-12-01', start: '08:00', end: '14:00' }, // fuori periodo
];
const occasionalWork = [{ id: 1, date: '2026-11-20', description: 'Corso BLSD', grossAmount: 300, note: '=x' }];
const settings = {
  taxMode: 'forfettario', fiscalRegime: 'forfettario', rivalsaPercent: 4, rivalsaType: 'integrativo',
  coefficientPercent: 78, forfContributionsPercent: 16, forfTaxRatePercent: 5, occasionalTaxRatePercent: 23,
};
const base = { shifts, sites, settings, occasionalWork, fromISO: '2026-11-01', toISO: '2026-11-30' };

describe('elenco prestazioni', () => {
  it('per me: tutte le sedi, una riga per turno con descrizione, più le occasionali', () => {
    const l = computeServiceList(base);
    expect(l.groups.map((g) => g.site.name)).toEqual(['Clinica Rossi', 'RSA Verdi']);
    expect(l.groups[0].rows.map((r) => r.description)).toEqual(['Turno 08:00-14:00 · Reparto A', 'Turno 14:00-20:00']);
    expect(l.groups[1].rows).toHaveLength(1); // l'annullato non conta
    expect(l.occasional[0]).toMatchObject({ description: 'Corso BLSD · =x', amount: 300 });
    expect(l.count).toBe(4);
    expect(l.totalHours).toBe(24);
    expect(l.revenue).toBe(480 + 360);
    expect(l.rivalsa).toBe(33.6);
    expect(l.invoice).toBe(873.6);
    expect(l.rivalsaPercent).toBe(4);
  });

  it('per me: tasse ricalcolate dai totali delle righe, netto che torna al centesimo', () => {
    const l = computeServiceList(base);
    const lines = taxLines(l);
    expect(lines.map(([k]) => k)).toEqual(['Integrativo da versare alla cassa', 'Contributi previdenziali', 'Imposta sostitutiva']);
    const minus = lines.reduce((a, [, v]) => a + v, 0);
    expect(Math.round((l.invoice - minus) * 100) / 100).toBe(l.net);
    expect(l.occasionalNet).toBe(231);
    expect(l.netTotal).toBe(Math.round((l.net + 231) * 100) / 100);
  });

  it('per il cliente: una sola sede, niente tasse né occasionali', () => {
    const l = computeServiceList({ ...base, forClient: true, siteId: 2 });
    expect(l.client.name).toBe('RSA Verdi');
    expect(l.groups).toHaveLength(1);
    expect(l.occasional).toEqual([]);
    expect(l.tax).toBeNull();
    expect(l.invoice).toBe(374.4);
    expect(taxLines(l)).toEqual([]);
  });

  it('Excel per il cliente: totale da pagare, diciture e protezione formule', () => {
    const l = computeServiceList({ ...base, forClient: true, siteId: 1 });
    const rows = servicesExcelRows(l, { rivalsaLabel: 'Contributo integrativo', settings, headerLines: ['=Mario'] });
    const text = rows.flat().map(String).join('|');
    expect(rows[1]).toEqual(["'=Mario"]);
    expect(rows).toContainEqual(['Totale da pagare', '', '', '', 499.2]);
    expect(text).toContain('Legge n. 190/2014');
    expect(text).toContain('bollo');
    for (const bad of ['Imposta sostitutiva', 'Netto', 'Corso BLSD', 'RSA Verdi']) expect(text).not.toContain(bad);
  });

  it('Excel per me: tasse in negativo e netto totale', () => {
    const l = computeServiceList(base);
    const rows = servicesExcelRows(l, { settings });
    expect(rows).toContainEqual(['Totale fatturato', '', '', '', 873.6]);
    expect(rows).toContainEqual(['Netto totale', '', '', '', l.netTotal]);
    expect(rows.find((r) => r[0] === 'Contributi previdenziali')[4]).toBeLessThan(0);
    expect(rows.flat().map(String).join('|')).toContain("Corso BLSD · =x"); // dentro il testo: non è una formula
  });
});

describe('diciture per la fattura', () => {
  it('forfettario: niente IVA né ritenuta, bollo solo sopra 77,47 €', () => {
    expect(invoiceNotes({ fiscalRegime: 'forfettario' }, 50)).toHaveLength(2);
    expect(invoiceNotes({ fiscalRegime: 'forfettario' }, 77.48).at(-1)).toContain('bollo');
  });
  it('ordinario: sanitari esenti IVA, gli altri avvisati di IVA e ritenuta', () => {
    expect(invoiceNotes({ fiscalRegime: 'ordinario', professionalRole: 'infermiera' }, 500)[0]).toContain('art. 10');
    expect(invoiceNotes({ fiscalRegime: 'ordinario', professionalRole: 'videomaker' }, 500)[0]).toContain('IVA');
    expect(invoiceNotes({ fiscalRegime: 'altro' }, 500)).toEqual([]);
  });
});

describe('periodo', () => {
  it('mese intero o intervallo', () => {
    expect(periodLabel('2026-11-01', '2026-11-30')).toBe('Novembre 2026');
    expect(periodLabel('2026-11-03', '2026-11-20')).toBe('dal 03/11/2026 al 20/11/2026');
  });
});
