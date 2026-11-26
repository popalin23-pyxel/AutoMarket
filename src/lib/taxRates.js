// ─────────────────────────────────────────────────────────────────────────────
// ALIQUOTE FISCALI E CONTRIBUTIVE — UN SOLO POSTO DA AGGIORNARE OGNI ANNO
// ─────────────────────────────────────────────────────────────────────────────
// Tutti i numeri usati per stimare tasse e contributi (regime ordinario, forfettario,
// casse INPS, addizionali) stanno qui. Ogni gennaio-febbraio, quando escono la legge di
// bilancio e le circolari INPS, basta aggiornare questo file (e TAX_YEAR).
// Verificati il 26/11/2026 sulle fonti indicate accanto a ogni valore.

export const TAX_YEAR = 2026;
export const TAX_RATES_CHECKED = '26/11/2026';

// Scaglioni: [{ upTo, rate }] in ordine, upTo = null per l'ultimo (nessun tetto). rate in %.

// IRPEF 2026: legge di bilancio 2026, la seconda aliquota scende dal 35% al 33%.
// Fonte: https://www.informazionefiscale.it/IRPEF-scaglioni-aliquote-calcolo
export const IRPEF_BRACKETS = [
  { upTo: 28000, rate: 23 },
  { upTo: 50000, rate: 33 },
  { upTo: null, rate: 43 },
];

// Detrazione per redditi di lavoro autonomo (art. 13 c. 5 TUIR), in base al reddito complessivo.
// Fonte: https://www.informazionefiscale.it/IRPEF-scaglioni-aliquote-calcolo
export function selfEmployedDeduction(income) {
  const r = Number(income) || 0;
  let d;
  if (r <= 5500) d = 1265;
  else if (r <= 28000) d = 500 + 765 * ((28000 - r) / 22500);
  else if (r <= 50000) d = 500 * ((50000 - r) / 22000);
  else d = 0;
  if (r > 11000 && r <= 17000) d += 50; // detrazione aggiuntiva
  return Math.max(0, d);
}

// INPS Gestione separata 2026 (professionisti con P.IVA senza cassa propria).
// Fonte: circolare INPS n. 8 del 03/02/2026.
export const INPS_GESTIONE_SEPARATA = {
  rate: 26.07,        // 25% IVS + 0,72% aggiuntiva + 0,35% ISCRO
  rateReduced: 24,    // pensionati o iscritti ad altra cassa obbligatoria
  minimale: 18808,
  massimale: 122295,
};

// INPS Artigiani e Commercianti 2026.
// Fonte: circolare INPS n. 14 del 09/02/2026 (riportata da informazionefiscale.it).
export const INPS_ARTIGIANI_COMMERCIANTI = {
  minimale: 18808,           // sotto questo reddito si paga comunque la quota fissa
  threshold: 56224,          // oltre questo reddito l'aliquota sale di 1 punto
  massimale: 122295,         // 93.707 € per chi ha contributi prima del 1996
  forfettarioReductionPercent: 35, // riduzione facoltativa (su domanda) per i forfettari
  artigiani: { fixed: 4521.36, rate: 24 },      // quota fissa annua sul minimale (IVS + maternità)
  commercianti: { fixed: 4611.64, rate: 24.48 },
};

// Regime forfettario 2026.
// Fonte: https://www.money.it/regime-forfettario-2026-come-funziona-requisiti-limiti
export const FORFETTARIO = {
  revenueLimit: 85000,       // oltre 100.000 € si esce subito dal regime
  exitLimit: 100000,
  startupRatePercent: 5,     // primi 5 anni, con i requisiti
  ratePercent: 15,
  // coefficienti di redditività per gruppo di codici ATECO (allegato 4, L. 190/2014)
  coefficients: [
    { id: 'professionale', percent: 78, label: 'Professioni, sanità, istruzione e formazione, servizi tecnici', codes: 'ATECO 64-66, 69-75, 85, 86-88', examples: 'infermiere, medico, formatore, fotografo, consulente, web designer' },
    { id: 'altre', percent: 67, label: 'Altre attività', codes: 'ATECO 58-63, 77-82, 90-96 e altri', examples: 'videomaker, programmatore, estetista, artista' },
    { id: 'commercio', percent: 40, label: 'Commercio, alloggio e ristorazione, alimentari', codes: 'ATECO 10-11, 45-47, 55-56', examples: 'e-commerce, negozio, bar, B&B' },
    { id: 'ambulante', percent: 54, label: 'Commercio ambulante (non alimentare)', codes: 'ATECO 47.82-47.89', examples: '' },
    { id: 'intermediari', percent: 62, label: 'Intermediari del commercio', codes: 'ATECO 46.1', examples: 'agente di commercio' },
    { id: 'costruzioni', percent: 86, label: 'Costruzioni e attività immobiliari', codes: 'ATECO 41-43, 68', examples: 'edile, agente immobiliare' },
  ],
};

// Addizionali regionali IRPEF (si pagano per scaglioni, sul reddito imponibile).
// Solo le regioni verificate; per le altre l'aliquota si inserisce a mano.
export const REGIONS = [
  {
    id: 'liguria', label: 'Liguria', year: 2026,
    brackets: [{ upTo: 28000, rate: 1.23 }, { upTo: 50000, rate: 3.18 }, { upTo: null, rate: 3.23 }],
    source: 'Ministero dell\'Economia e delle Finanze, Dipartimento Finanze (pubblicato il 28/01/2026)',
  },
];
export const REGIONAL_BASE_RATE = 1.23; // aliquota base nazionale, valida se la regione non la aumenta

// Addizionali comunali IRPEF. exemptUpTo: chi ha un imponibile fino a questa cifra non paga;
// sopra, l'aliquota vale su tutto l'imponibile.
export const MUNICIPALITIES = [
  {
    id: 'genova', label: 'Genova', region: 'liguria', year: 2026,
    exemptUpTo: 15000,
    brackets: [{ upTo: null, rate: 1.2 }],
    source: 'Comune di Genova, bilancio di previsione 2026-2028 (aliquota unica 1,2%, esenzione alzata da 14.000 a 15.000 €)',
    note: 'Dal 2027 il Comune prevede di abbassarla per i redditi fino a 50.000 €.',
  },
];

// Imposta per scaglioni: ogni fetta di reddito paga l'aliquota del suo scaglione.
export function bracketTax(income, brackets) {
  let rest = Math.max(0, Number(income) || 0);
  let prev = 0;
  let tax = 0;
  for (const b of brackets || []) {
    const top = b.upTo == null ? Infinity : b.upTo;
    const slice = Math.min(rest, top - prev);
    if (slice <= 0) break;
    tax += slice * ((Number(b.rate) || 0) / 100);
    rest -= slice;
    prev = top;
  }
  return tax;
}
