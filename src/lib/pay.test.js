// Paga omnicomprensiva o "paga + %", e cambi di paga con data (versione 1.7).
import { describe, it, expect } from 'vitest';
import { sitePayOn, payFor, roundPay, computeMonthSummary, computeTimesheet, scheduledRateChange } from './calc.js';
import { addSite, changeSitePay, changeSiteRate } from './store.js';

const enpapi = { taxMode: 'forfettario', forfTaxRatePercent: 5, forfContributionsPercent: 16, coefficientPercent: 78, rivalsaPercent: 4, rivalsaType: 'integrativo' };
const shift = (id, siteId, date, start = '20:00', end = '08:00', extra = {}) => ({ id, siteId, date, start, end, ...extra });

describe('paga omnicomprensiva', () => {
  const site = { id: 1, name: 'CDS', rate: 27, payMode: 'inclusive', rivalsaPercent: null };

  it('scorpora il 4%: €27 l’ora = €25,96 di compenso + €1,04 di integrativo', () => {
    const p = payFor(1, site, '2026-11-02', enpapi);
    expect(p.inclusive).toBe(true);
    expect(p.total).toBe(27);
    expect(Math.round(p.revenue * 100) / 100).toBe(25.96);
    expect(roundPay(payFor(12, site, '2026-11-02', enpapi))).toEqual({ revenue: 311.54, rivalsa: 12.46, total: 324 });
  });

  it('nel mese il fatturato è ore × tariffa e il netto non conta il 4% come guadagno', () => {
    const s = computeMonthSummary([shift(1, 1, '2026-11-02')], [site], enpapi, 2026, 11);
    expect(s.totalInvoice).toBe(324);
    expect(s.totalRevenue).toBe(311.54);
    expect(s.integrativo).toBe(12.46);
    expect(s.perSite[0]).toMatchObject({ rate: 27, inclusive: true, rivalsaPercent: 4, total: 324 });
    // stesso netto di €25,96 + 4% "paga + %"
    const plus = computeMonthSummary([shift(1, 1, '2026-11-02')], [{ id: 1, name: 'X', rate: 311.54 / 12 }], enpapi, 2026, 11);
    expect(s.net).toBeCloseTo(plus.net, 1);
  });

  it('senza maggiorazione (0%) omnicomprensiva e "+ %" danno lo stesso risultato', () => {
    const a = payFor(10, { rate: 30, payMode: 'inclusive', rivalsaPercent: 0 }, '2026-11-02', enpapi);
    const b = payFor(10, { rate: 30, payMode: 'plus', rivalsaPercent: 0 }, '2026-11-02', enpapi);
    expect(roundPay(a)).toEqual(roundPay(b));
  });

  it('foglio ore: i righi a €27 tornano col totale e il compenso è scorporato', () => {
    const shifts = [shift(1, 1, '2026-11-02'), shift(2, 1, '2026-11-05', '07:00', '14:15')];
    const t = computeTimesheet(shifts, site, enpapi, '2026-11-01', '2026-11-30');
    const rowsSum = Math.round(t.rows.reduce((a, r) => a + r.amount, 0) * 100) / 100;
    expect(t.total).toBe(rowsSum);
    expect(t.inclusive).toBe(true);
    expect(Math.round((t.revenue + t.rivalsa) * 100) / 100).toBe(t.total);
    expect(t.rows[0]).toMatchObject({ rate: 27, amount: 324 });
  });
});

describe('cambio di paga con data', () => {
  // CDS com'è nei dati veri: €27 + 4% fino a settembre, poi €25,98 (modo vecchio, senza payMode)
  const cds = { id: 1, name: 'CDS', rate: 25.98, rivalsaPercent: 4, pastRates: [{ before: '2026-10-01', rate: 27 }] };

  it('i periodi salvati prima della 1.7 sono "paga + %" con la % della sede', () => {
    expect(sitePayOn(cds, '2026-09-30')).toEqual({ rate: 27, payMode: 'plus', rivalsaPercent: 4 });
    expect(sitePayOn(cds, '2026-10-01')).toEqual({ rate: 25.98, payMode: 'plus', rivalsaPercent: 4 });
  });

  it('passare a €27 omnicomprensiva dal 1/10 non cambia settembre', () => {
    const st = changeSitePay({ sites: [cds] }, 1, { rate: 27, payMode: 'inclusive', rivalsaPercent: null }, '2026-10-01');
    const s = st.sites[0];
    expect(sitePayOn(s, '2026-09-30')).toEqual({ rate: 27, payMode: 'plus', rivalsaPercent: 4 });
    expect(sitePayOn(s, '2026-10-01')).toEqual({ rate: 27, payMode: 'inclusive', rivalsaPercent: null });
    const sept = computeMonthSummary([shift(1, 1, '2026-09-10')], [s], enpapi, 2026, 9);
    const before = computeMonthSummary([shift(1, 1, '2026-09-10')], [cds], enpapi, 2026, 9);
    expect(sept.perSite[0]).toEqual(before.perSite[0]);
    expect(computeMonthSummary([shift(1, 1, '2026-10-10')], [s], enpapi, 2026, 10).totalInvoice).toBe(324);
  });

  it('cambiare solo la % da una data scrive la % vecchia nel periodo prima', () => {
    const st = changeSitePay({ sites: [cds] }, 1, { rate: 25.98, payMode: 'plus', rivalsaPercent: 2 }, '2026-11-01');
    const s = st.sites[0];
    expect(sitePayOn(s, '2026-09-15').rivalsaPercent).toBe(4);
    expect(sitePayOn(s, '2026-10-15')).toEqual({ rate: 25.98, payMode: 'plus', rivalsaPercent: 4 });
    expect(sitePayOn(s, '2026-11-15').rivalsaPercent).toBe(2);
  });

  it('stessa paga: nessun nuovo periodo; correzione: vale per tutti i turni', () => {
    const same = changeSitePay({ sites: [cds] }, 1, { rate: 25.98, payMode: 'plus', rivalsaPercent: 4 }, '2026-11-01');
    expect(same.sites[0].pastRates).toHaveLength(1);
    const fix = changeSitePay({ sites: [cds] }, 1, { rate: 27, payMode: 'inclusive' });
    expect(fix.sites[0].pastRates).toEqual([]);
    expect(sitePayOn(fix.sites[0], '2026-01-01').payMode).toBe('inclusive');
  });

  it('cambio solo di tariffa mantiene modo e %', () => {
    const s = changeSiteRate({ sites: [{ id: 1, name: 'A', rate: 27, payMode: 'inclusive', rivalsaPercent: 2 }] }, 1, 28, '2026-12-01').sites[0];
    expect(sitePayOn(s, '2026-12-01')).toEqual({ rate: 28, payMode: 'inclusive', rivalsaPercent: 2 });
    expect(sitePayOn(s, '2026-11-30')).toEqual({ rate: 27, payMode: 'inclusive', rivalsaPercent: 2 });
  });

  it('un cambio già fissato nel futuro riporta la paga nuova completa', () => {
    const s = changeSitePay({ sites: [cds] }, 1, { rate: 27, payMode: 'inclusive', rivalsaPercent: null }, '2027-01-01').sites[0];
    expect(scheduledRateChange(s, '2026-11-18')).toEqual({ from: '2027-01-01', rate: 27, payMode: 'inclusive', rivalsaPercent: null });
  });

  it('nuova sede omnicomprensiva', () => {
    const st = addSite({ sites: [], seq: { site: 1 } }, ' Villa Rosa ', '27', { payMode: 'inclusive' });
    expect(st.sites[0]).toMatchObject({ name: 'Villa Rosa', rate: 27, payMode: 'inclusive', rivalsaPercent: null });
  });
});
