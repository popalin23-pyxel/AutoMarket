// Garanzia: i conti delle sedi "paga + %" (tutte quelle create prima della 1.7) restano
// identici al centesimo. L'istantanea è stata presa con il codice di prima della 1.7.
import { describe, it, expect } from 'vitest';
import { computeMonthSummary, computeYearSummary, computeTimesheet, computeRangeSummary } from './calc.js';

const sites = [
  { id: 1, name: 'CDS', rate: 25.98, rivalsaPercent: 4, pastRates: [{ before: '2026-10-01', rate: 27 }] },
  { id: 2, name: 'Ravera', rate: 28, rivalsaPercent: null },
  { id: 3, name: 'San Camillo', rate: 26.35, rivalsaPercent: 2 },
  { id: 4, name: 'Senza rivalsa', rate: 24.5, rivalsaPercent: 0 },
  { id: 5, name: 'Due cambi', rate: 30, rivalsaPercent: null, pastRates: [{ before: '2026-09-15', rate: 26.4 }, { before: '2026-10-20', rate: 28.75 }] },
];

const times = [['07:00', '14:15'], ['20:00', '08:00'], ['14:00', '20:30'], ['08:00', '13:45'], ['13:00', '21:20']];
const shifts = [];
let id = 1;
for (let day = 1; day <= 28; day++) {
  for (const month of [9, 10, 11]) {
    const siteId = ((day + month) % 6) || 99; // 99 = sede eliminata
    const [start, end] = times[(day * month) % times.length];
    const sh = { id: id++, date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, siteId, start, end };
    if (day % 9 === 0) sh.rate = 31.5;          // tariffa speciale del turno
    if (day % 11 === 0) sh.status = 'cancelled'; // annullato: non conta
    shifts.push(sh);
  }
}

const forf = { taxMode: 'forfettario', forfTaxRatePercent: 5, forfContributionsPercent: 16, coefficientPercent: 78, rivalsaPercent: 4, rivalsaType: 'integrativo' };
const forfInps = { ...forf, forfTaxRatePercent: 15, forfContributionsPercent: 26.07, rivalsaType: 'rivalsa' };
const semplice = { taxMode: 'semplice', taxPercent: 27, contributionsPercent: 10, rivalsaPercent: 4 };

const pick = (s) => ({
  totalHours: s.totalHours, totalRevenue: s.totalRevenue, totalRivalsa: s.totalRivalsa, totalInvoice: s.totalInvoice,
  taxes: s.taxes, net: s.net, taxable: s.taxable, contributions: s.contributions, incomeTax: s.incomeTax, integrativo: s.integrativo,
  perSite: s.perSite.map((p) => [p.name, p.hours, p.rate, p.mixedRate, p.rivalsaPercent, p.revenue, p.rivalsa, p.total]),
});

describe('conti delle sedi "paga + %" invariati', () => {
  for (const [label, settings] of [['forfettario ENPAPI', forf], ['forfettario INPS', forfInps], ['semplice', semplice]]) {
    it(`mesi e anno, ${label}`, () => {
      const out = {};
      for (const m of [9, 10, 11]) out[`mese ${m}`] = pick(computeMonthSummary(shifts, sites, settings, 2026, m));
      const y = computeYearSummary(shifts, sites, settings, 2026);
      out.anno = { totalRevenue: y.totalRevenue, totalRivalsa: y.totalRivalsa, totalTaxable: y.totalTaxable, totalIntegrativo: y.totalIntegrativo };
      out.periodo = pick(computeRangeSummary(shifts, sites, settings, '2026-09-10', '2026-10-25'));
      expect(out).toMatchSnapshot();
    });
  }

  it('fogli ore', () => {
    const out = sites.map((site) => {
      const t = computeTimesheet(shifts, site, forf, '2026-09-01', '2026-11-30');
      return [site.name, t.totalHours, t.revenue, t.rivalsaPercent, t.rivalsa, t.total, t.rows.map((r) => [r.date, r.hours, r.rate, r.amount])];
    });
    expect(out).toMatchSnapshot();
  });
});
