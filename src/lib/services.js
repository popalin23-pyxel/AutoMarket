// Elenco prestazioni di un periodo: una riga per ogni prestazione (turno nelle sedi o
// prestazione occasionale) con descrizione, ore, tariffa e importo, raggruppate per sede,
// più le cifre che ne risultano (compensi, rivalsa, totale e, se richiesto, tasse e netto).
// Solo calcoli, niente PDF: così si prova nei test e il modulo resta leggero.

import { computeTaxes, computeTimesheet, shiftsInRange } from './calc.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Professioni sanitarie: in regime ordinario le prestazioni sono esenti IVA (art. 10 n. 18 DPR 633/72).
const HEALTH_ROLES = new Set(['infermiere', 'infermiera', 'medico', 'fisioterapista']);
// Sopra questo importo una fattura senza IVA richiede la marca da bollo da 2 €.
export const STAMP_DUTY_THRESHOLD = 77.47;

/** Descrizione della riga di un turno: orario e, se c'è, la nota. */
export const shiftDescription = (r) => `Turno ${r.start}-${r.end}${r.note ? ` · ${r.note}` : ''}`;

/**
 * forClient = false: tutte le sedi + prestazioni occasionali + tasse e netto (per sé o il commercialista).
 * forClient = true: una sola sede (siteId), niente tasse, con le diciture per la fattura.
 */
export function computeServiceList({ shifts = [], sites = [], settings = {}, occasionalWork = [], fromISO, toISO, siteId = null, forClient = false }) {
  const chosen = forClient ? sites.filter((s) => s.id === siteId) : sites;
  const groups = chosen
    .map((site) => {
      const ts = computeTimesheet(shifts, site, settings, fromISO, toISO);
      return {
        site: ts.site,
        rows: ts.rows.map((r) => ({ ...r, description: shiftDescription(r) })),
        totalHours: ts.totalHours, revenue: ts.revenue, rivalsaPercent: ts.rivalsaPercent,
        rivalsa: ts.rivalsa, total: ts.total, inclusive: ts.inclusive, mixedPay: ts.mixedPay,
      };
    })
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => b.total - a.total);

  const occasional = forClient ? [] : shiftsInRange(occasionalWork, fromISO, toISO)
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map((o) => ({
      id: o.id, date: o.date,
      description: [o.description || 'Prestazione occasionale', o.note].filter(Boolean).join(' · '),
      amount: round2(o.grossAmount),
    }));

  const totalHours = round2(groups.reduce((a, g) => a + g.totalHours, 0));
  const revenue = round2(groups.reduce((a, g) => a + g.revenue, 0));
  const rivalsa = round2(groups.reduce((a, g) => a + g.rivalsa, 0));
  const invoice = round2(revenue + rivalsa);
  const rivalsaPercents = [...new Set(groups.filter((g) => g.rivalsa > 0).map((g) => g.rivalsaPercent))];

  // le tasse si ricalcolano dai totali delle righe: il documento torna al centesimo
  const tax = forClient ? null : computeTaxes(revenue, rivalsa, settings);
  const occasionalGross = round2(occasional.reduce((a, o) => a + o.amount, 0));
  const occasionalTaxPercent = Number(settings.occasionalTaxRatePercent) || 0;
  const occasionalTaxes = round2(occasionalGross * (occasionalTaxPercent / 100));
  const occasionalNet = round2(occasionalGross - occasionalTaxes);

  return {
    fromISO, toISO, forClient,
    client: forClient ? (groups[0]?.site ?? chosen[0] ?? null) : null,
    groups, occasional,
    count: groups.reduce((a, g) => a + g.rows.length, 0) + occasional.length,
    totalHours, revenue, rivalsa, invoice,
    // percentuale unica di rivalsa se tutte le sedi usano la stessa (per l'etichetta "Rivalsa 4%")
    rivalsaPercent: rivalsaPercents.length === 1 ? rivalsaPercents[0] : null,
    tax,
    occasionalGross, occasionalTaxPercent, occasionalTaxes, occasionalNet,
    net: tax ? tax.net : null,
    netTotal: tax ? round2(tax.net + occasionalNet) : null,
  };
}

/**
 * Le voci di tasse e contributi (etichetta, importo positivo da togliere) secondo il regime.
 * Stesse diciture del riepilogo del mese.
 */
export function taxLines(list) {
  const t = list.tax;
  if (!t) return [];
  if (t.taxMode === 'forfettario' || t.taxMode === 'ordinario') {
    return [
      ...(t.integrativo > 0 ? [['Integrativo da versare alla cassa', t.integrativo]] : []),
      ['Contributi previdenziali', t.contributions],
      ...(t.taxMode === 'ordinario'
        ? [['IRPEF', t.irpef], ['Addizionali regionale e comunale', round2(t.regional + t.municipal)]]
        : [['Imposta sostitutiva', t.incomeTax]]),
    ];
  }
  return [[`Tasse da accantonare (${t.taxPercent}%)`, t.taxes]];
}

/**
 * Diciture da riportare in fattura per la versione da mandare al cliente, secondo il regime
 * dichiarato in Tasse e cassa. Sono le formule d'uso comune: vanno sempre confermate col commercialista.
 */
export function invoiceNotes(settings = {}, total = 0) {
  const regime = settings.fiscalRegime;
  const health = HEALTH_ROLES.has(settings.professionalRole);
  const stamp = total > STAMP_DUTY_THRESHOLD
    ? `Imposta di bollo di 2,00 € da applicare sulla fattura (importo superiore a ${fmt(STAMP_DUTY_THRESHOLD)} € senza IVA).`
    : null;
  if (regime === 'forfettario') {
    return [
      'Operazione senza applicazione dell\'IVA, effettuata ai sensi dell\'art. 1, commi da 54 a 89, della Legge n. 190/2014 (regime forfettario).',
      'Compenso non soggetto a ritenuta d\'acconto ai sensi dell\'art. 1, comma 67, della Legge n. 190/2014.',
      ...(stamp ? [stamp] : []),
    ];
  }
  if (regime === 'ordinario' && health) {
    return [
      'Prestazione sanitaria esente IVA ai sensi dell\'art. 10, comma 1, n. 18 del DPR n. 633/1972.',
      'Se il cliente è un sostituto d\'imposta, in fattura va indicata la ritenuta d\'acconto del 20%.',
      ...(stamp ? [stamp] : []),
    ];
  }
  if (regime === 'ordinario') {
    return ['In fattura vanno aggiunte l\'IVA e, se il cliente è un sostituto d\'imposta, la ritenuta d\'acconto del 20%: questo elenco non le calcola.'];
  }
  return [];
}
