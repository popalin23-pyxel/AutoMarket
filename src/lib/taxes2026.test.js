import { describe, it, expect } from 'vitest';
import { bracketTax, selfEmployedDeduction, IRPEF_BRACKETS } from './taxRates.js';
import {
  computeTaxes, computeOrdinarioYear, computeForfettarioYear, annualContributions,
  municipalSurcharge, regionalSurcharge, DEFAULT_ANNUAL_REVENUE,
} from './calc.js';

const gs = { pensionFund: 'inps', forfContributionsPercent: 26.07, rivalsaType: 'rivalsa' };
const genova = { region: 'liguria', municipality: 'genova' };

describe('aliquote 2026', () => {
  it('IRPEF a scaglioni 23/33/43', () => {
    expect(bracketTax(20000, IRPEF_BRACKETS)).toBeCloseTo(4600, 2);
    expect(bracketTax(40000, IRPEF_BRACKETS)).toBeCloseTo(10400, 2); // 28.000×23% + 12.000×33%
    expect(bracketTax(60000, IRPEF_BRACKETS)).toBeCloseTo(6440 + 7260 + 4300, 2);
  });

  it('detrazione per lavoro autonomo', () => {
    expect(selfEmployedDeduction(5000)).toBe(1265);
    expect(selfEmployedDeduction(20000)).toBeCloseTo(772, 2);
    expect(selfEmployedDeduction(15000)).toBeCloseTo(942 + 50, 2); // +50 tra 11.000 e 17.000
    expect(selfEmployedDeduction(39000)).toBeCloseTo(250, 2);
    expect(selfEmployedDeduction(60000)).toBe(0);
  });

  it('addizionale Liguria a scaglioni e Genova con esenzione', () => {
    expect(regionalSurcharge(40000, genova)).toBeCloseTo(344.4 + 381.6, 2);
    expect(municipalSurcharge(15000, genova)).toBe(0);
    expect(municipalSurcharge(20000, genova)).toBeCloseTo(240, 2); // sopra la soglia, su tutto
    // regione e comune non in elenco: aliquota scritta a mano
    expect(regionalSurcharge(10000, { regionalManualPercent: 2 })).toBeCloseTo(200, 2);
    expect(municipalSurcharge(10000, { municipalManualPercent: 0.8, municipalExemptUpTo: 12000 })).toBe(0);
    expect(municipalSurcharge(20000, { municipalManualPercent: 0.8, municipalExemptUpTo: 12000 })).toBeCloseTo(160, 2);
  });
});

describe('contributi', () => {
  it('Gestione separata con tetto massimo di reddito', () => {
    expect(annualContributions(40000, gs)).toBeCloseTo(10428, 2);
    expect(annualContributions(200000, gs)).toBeCloseTo(122295 * 0.2607, 2);
  });

  it('INPS artigiani e commercianti: quota fissa più percentuale', () => {
    expect(annualContributions(10000, { pensionFund: 'inps_artigiani' })).toBeCloseTo(4521.36, 2);
    expect(annualContributions(20100, { pensionFund: 'inps_artigiani' })).toBeCloseTo(4521.36 + 1292 * 0.24, 2);
    expect(annualContributions(60000, { pensionFund: 'inps_commercianti' }))
      .toBeCloseTo(4611.64 + (56224 - 18808) * 0.2448 + (60000 - 56224) * 0.2548, 2);
  });

  it('riduzione del 35% solo per i forfettari che l\'hanno chiesta', () => {
    const base = { pensionFund: 'inps_artigiani', inpsForfReduction: true };
    expect(annualContributions(10000, { ...base, taxMode: 'forfettario' })).toBeCloseTo(4521.36 * 0.65, 2);
    expect(annualContributions(10000, { ...base, taxMode: 'ordinario' })).toBeCloseTo(4521.36, 2);
  });
});

describe('regime ordinario', () => {
  it('anno con €40.000 di compensi, Gestione separata, Genova', () => {
    const y = computeOrdinarioYear(40000, { ...gs, ...genova });
    expect(y.contributions).toBeCloseTo(10428, 2);
    expect(y.taxable).toBeCloseTo(29572, 2);
    expect(y.irpefGross).toBeCloseTo(6958.76, 2);
    expect(y.deduction).toBeCloseTo(464.27, 2);
    expect(y.irpef).toBeCloseTo(6494.49, 2);
    expect(y.regional).toBeCloseTo(394.39, 2);
    expect(y.municipal).toBeCloseTo(354.86, 2);
    expect(y.taxes).toBeCloseTo(17671.74, 1);
    expect(y.net).toBeCloseTo(40000 - 17671.74, 1);
  });

  it('spese deducibili abbassano reddito, contributi e imposte', () => {
    const y = computeOrdinarioYear(40000, { ...gs, ...genova, ordExpensesPercent: 25 });
    expect(y.income).toBe(30000);
    expect(y.contributions).toBeCloseTo(7821, 2);
  });

  it('con uno stipendio conta solo l\'IRPEF in più, senza detrazione autonomo', () => {
    const y = computeOrdinarioYear(10000, { ...gs, ordOtherIncome: 30000, regionalManualPercent: 0 });
    expect(y.taxable).toBeCloseTo(7393, 2);
    expect(y.irpefGross).toBeCloseTo(7393 * 0.33, 2);
    expect(y.deduction).toBe(0);
  });

  it('redditi bassi: niente IRPEF e quindi niente addizionali', () => {
    const y = computeOrdinarioYear(6000, { ...gs, ...genova });
    expect(y.irpef).toBe(0);
    expect(y.regional).toBe(0);
    expect(y.municipal).toBe(0);
  });

  it('un mese paga la sua parte delle tasse dell\'anno previsto', () => {
    const settings = { ...gs, ...genova, taxMode: 'ordinario', annualRevenueEstimate: 40000 };
    const t = computeTaxes(4000, 0, settings);
    expect(t.taxMode).toBe('ordinario');
    expect(t.contributions).toBeCloseTo(1042.8, 2);
    expect(t.irpef).toBeCloseTo(649.45, 2);
    expect(t.taxes).toBeCloseTo(1767.17, 1);
    expect(t.net).toBeCloseTo(4000 - t.taxes, 2);
  });

  it('integrativo della cassa: si versa e non si tassa', () => {
    const settings = { pensionFund: 'enpapi', forfContributionsPercent: 16, rivalsaType: 'integrativo', taxMode: 'ordinario', annualRevenueEstimate: 30000, ...genova };
    const t = computeTaxes(1000, 40, settings);
    expect(t.integrativo).toBe(40);
    expect(t.income).toBe(1000);
  });

  it('senza compensi annui previsti usa la cifra di partenza', () => {
    const a = computeTaxes(1000, 0, { ...gs, taxMode: 'ordinario' });
    const b = computeTaxes(1000, 0, { ...gs, taxMode: 'ordinario', annualRevenueEstimate: DEFAULT_ANNUAL_REVENUE });
    expect(a.taxes).toBe(b.taxes);
  });
});

describe('forfettario con INPS artigiani', () => {
  it('quota fissa ripartita sui compensi del periodo', () => {
    const settings = { taxMode: 'forfettario', pensionFund: 'inps_artigiani', coefficientPercent: 67, forfTaxRatePercent: 15, annualRevenueEstimate: 30000, rivalsaType: 'rivalsa' };
    const y = computeForfettarioYear(30000, settings);
    expect(y.taxable).toBeCloseTo(20100, 2);
    expect(y.contributions).toBeCloseTo(4831.44, 2);
    const t = computeTaxes(3000, 0, settings); // un decimo dell'anno
    expect(t.contributions).toBeCloseTo(483.14, 2);
    expect(t.incomeTax).toBeCloseTo((2010 - 483.14) * 0.15, 2);
  });

  it('le casse a percentuale restano calcolate come prima', () => {
    const settings = { taxMode: 'forfettario', forfTaxRatePercent: 15, forfContributionsPercent: 16, coefficientPercent: 78, rivalsaType: 'integrativo' };
    const t = computeTaxes(1000, 40, settings);
    expect(t.contributions).toBeCloseTo(124.8, 2);
  });
});
