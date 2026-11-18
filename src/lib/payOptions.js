// Come paga una sede, detto in parole: le scelte della scheda sede ("+ 4%", omnicomprensiva,
// nessuna maggiorazione, altra percentuale) e le frasi che le descrivono.
import { payPercent } from './calc.js';

const eur = (n, dec = 2) => `€${(Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: dec, maximumFractionDigits: 2 })}`;
const eurShort = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pctText = (n) => `${(Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`;

// "integrativo" (ENPAPI: va alla cassa) o "rivalsa" (INPS: fa parte del compenso)
export const extraName = (settings) => (settings?.rivalsaType === 'integrativo' ? 'integrativo' : 'rivalsa');
export const defaultPercent = (settings) => Number(settings?.rivalsaPercent) || 0;

// Quale scelta corrisponde a una paga { payMode, rivalsaPercent }.
// La % uguale a quella di Tasse e cassa conta come "quella della cassa".
export function choiceOf(terms, settings) {
  const def = defaultPercent(settings);
  const own = terms.rivalsaPercent;
  const pct = own == null || own === '' ? def : Number(own) || 0;
  if (pct === 0) return 'none';
  if (pct === def) return terms.payMode === 'inclusive' ? 'inclusive' : 'plus';
  return 'custom';
}

// La paga da salvare per una scelta. `custom` = { pct, inclusive } per "Altra percentuale".
export function termsOf(choice, rate, settings, custom = {}) {
  const r = Number(rate) || 0;
  if (choice === 'inclusive') return { rate: r, payMode: 'inclusive', rivalsaPercent: null };
  if (choice === 'none') return { rate: r, payMode: 'plus', rivalsaPercent: defaultPercent(settings) === 0 ? null : 0 };
  if (choice === 'custom') return { rate: r, payMode: custom.inclusive ? 'inclusive' : 'plus', rivalsaPercent: Number(custom.pct) || 0 };
  return { rate: r, payMode: 'plus', rivalsaPercent: null };
}

// Le scelte da proporre: con una cassa senza maggiorazione (es. ENPAM) "+ %" e
// omnicomprensiva sarebbero la stessa cosa.
export function payChoices(settings) {
  const def = defaultPercent(settings);
  if (def === 0) return ['none', 'custom'];
  return ['plus', 'inclusive', 'custom'];
}

// Quanto si fattura per un'ora: { total, revenue, extra, pct, inclusive }.
export function hourBreakdown(terms, settings) {
  const rate = Number(terms.rate) || 0;
  const pct = payPercent(terms.rivalsaPercent, settings);
  if (terms.payMode === 'inclusive') {
    const revenue = rate / (1 + pct / 100);
    return { total: rate, revenue, extra: rate - revenue, pct, inclusive: true };
  }
  return { total: rate * (1 + pct / 100), revenue: rate, extra: rate * (pct / 100), pct, inclusive: false };
}

// Riga breve per l'elenco: "€25 + 4% integrativo", "€27 omnicomprensiva", "€30, senza maggiorazione".
export function payText(terms, settings) {
  const b = hourBreakdown(terms, settings);
  const rate = eurShort(terms.rate);
  if (b.pct === 0) return `${rate} l’ora`;
  if (b.inclusive) return `${rate} omnicomprensiva`;
  return `${rate} + ${pctText(b.pct)} ${extraName(settings)}`;
}

// "In fattura €26,00 l'ora"
export const invoiceText = (terms, settings) => `In fattura ${eur(hourBreakdown(terms, settings).total)} l’ora`;

// Spiegazione di cosa si fattura per ogni ora.
export function hourText(terms, settings) {
  const b = hourBreakdown(terms, settings);
  if (b.pct === 0) return `In fattura ${eur(b.total)} l’ora`;
  if (b.inclusive) return `In fattura ${eur(b.total)} l’ora: ${eur(b.revenue)} di compenso + ${eur(b.extra)} di ${extraName(settings)} (${pctText(b.pct)} già compreso)`;
  return `In fattura ${eur(b.total)} l’ora: ${eur(b.revenue)} + ${eur(b.extra)} di ${extraName(settings)}`;
}

export { pctText, eur, eurShort };
