// Calcoli: ore, fatturato, rivalsa, tasse, netto — mese, settimana, confronti, festività.

import { MONTHS_IT } from './defaults.js';

export function monthDays(year, month) {
  return new Date(year, month, 0).getDate(); // month 1-based
}

export function weekdayOf(year, month, day) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7; // 0=lun ... 6=dom
}

export function todayISO() {
  return toISO(new Date());
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISO(d);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ore di un turno, gestendo il caso "notte a cavallo di mezzanotte" (fine < inizio)
export function hoursOfShift(shift) {
  if (!shift?.start || !shift?.end) return 0;
  const [sh, sm] = shift.start.split(':').map(Number);
  const [eh, em] = shift.end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const overnight = eh * 60 + em <= sh * 60 + sm; // turno notturno che sfora la mezzanotte
  let mins = (eh * 60 + em) - (sh * 60 + sm) + (overnight ? 24 * 60 : 0);
  // Con la data si conta la durata reale, che tiene conto del cambio d'ora: nella notte
  // in cui torna l'ora solare (fine ottobre) un 20:00-08:00 dura 13 ore, a fine marzo 11.
  const [y, mo, d] = (shift.date || '').split('-').map(Number);
  if (y && mo && d) {
    const real = Math.round((new Date(y, mo - 1, d + (overnight ? 1 : 0), eh, em) - new Date(y, mo - 1, d, sh, sm)) / 60000);
    if (real > 0) mins = real;
  }
  return Math.round((mins / 60) * 100) / 100;
}

// Turno annullato ("non l'ho fatto"): resta nel calendario, barrato, ma non conta
// in ore e guadagni. `status`: assente = normale, 'done' = confermato, 'cancelled' = annullato.
export const isCancelled = (shift) => shift?.status === 'cancelled';
export const activeShifts = (shifts) => shifts.filter((s) => !isCancelled(s));

// Quando finisce il turno (data e ora locali), anche se passa la mezzanotte.
export function shiftEndDate(shift) {
  const [y, mo, d] = (shift?.date || '').split('-').map(Number);
  const [sh, sm] = (shift?.start || '').split(':').map(Number);
  const [eh, em] = (shift?.end || '').split(':').map(Number);
  if (!y || !mo || !d || [sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const overnight = eh * 60 + em <= sh * 60 + sm;
  return new Date(y, mo - 1, d + (overnight ? 1 : 0), eh, em);
}

// Turno già svolto (finito) rispetto a `now`.
export function isShiftDone(shift, now = new Date()) {
  const end = shiftEndDate(shift);
  return end != null && end <= now;
}

// Turni finiti di recente da confermare ("fatto così?"): solo quelli segnati in anticipo
// (registrati o modificati prima della fine) e finiti negli ultimi `maxDays` giorni, così
// non vengono chiesti i turni vecchi o quelli inseriti a cose fatte.
export function shiftsToConfirm(shifts, now = new Date(), maxDays = 14) {
  const nowMs = now.getTime();
  return shifts.filter((s) => {
    if (s.status) return false;
    const end = shiftEndDate(s);
    if (!end) return false;
    const endMs = end.getTime();
    const u = Number(s._u) || 0;
    return endMs <= nowMs && nowMs - endMs <= maxDays * 86400000 && u > 0 && u < endMs;
  }).sort((a, b) => (a.date === b.date ? (a.start || '').localeCompare(b.start || '') : a.date.localeCompare(b.date)));
}

export function shiftYearMonth(shift) {
  const [y, m] = (shift.date || '').split('-').map(Number);
  return { year: y, month: m };
}

export function shiftsInMonth(shifts, year, month) {
  return shifts.filter((s) => {
    const { year: y, month: m } = shiftYearMonth(s);
    return y === year && m === month;
  });
}

export function shiftsOnDay(shifts, dateISO) {
  return shifts.filter((s) => s.date === dateISO);
}

export function shiftsInRange(shifts, startISO, endISO) {
  return shifts.filter((s) => s.date >= startISO && s.date <= endISO);
}

function byDateThenStart(a, b) {
  return a.date === b.date ? (a.start || '').localeCompare(b.start || '') : a.date.localeCompare(b.date);
}

/** Turni di oggi (non annullati), ordinati per orario di inizio. */
export function shiftsToday(shifts, todayDateISO = todayISO()) {
  return activeShifts(shiftsOnDay(shifts, todayDateISO)).sort(byDateThenStart);
}

/** Il primo turno futuro (data successiva a quella data), utile per "prossimo turno". */
export function nextShiftAfter(shifts, dateISO) {
  const future = shifts.filter((s) => s.date > dateISO && !isCancelled(s));
  if (!future.length) return null;
  return future.slice().sort(byDateThenStart)[0];
}

// ── Settimane (lunedì–domenica) ─────────────────────────────────────────
export function startOfWeek(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const wd = (d.getDay() + 6) % 7; // 0 = lunedì
  d.setDate(d.getDate() - wd);
  return toISO(d);
}

export function endOfWeek(dateISO) {
  const d = new Date(startOfWeek(dateISO) + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return toISO(d);
}

export function addDaysISO(dateISO, days) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function shortRangeLabel(startISO, endISO) {
  const [, , sd] = startISO.split('-');
  const [ey, em, ed] = endISO.split('-');
  return `${Number(sd)}–${Number(ed)} ${MONTHS_IT[Number(em) - 1].slice(0, 3)}`;
}

// ── Disponibilità ────────────────────────────────────────────────────────
const WD_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const toMin = (hhmm) => { const [h, m] = (hhmm || '').split(':').map(Number); return h * 60 + m; };
const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Giorni liberi in [fromISO, toISO] (da oggi in poi): senza turni, senza ferie/assenze e non
 * di smonto da una notte. Con includePartial anche i giorni liberi solo in parte: dopo un turno
 * che finisce entro le 15 ("dalle …") o prima di uno che inizia dalle 13 ("fino alle …").
 * Ritorna [{ date, from?, to? }].
 */
export function freeDays(shifts, dayMarks, fromISO, toISO, { includePartial = false, today = todayISO() } = {}) {
  const active = activeShifts(shifts);
  const marked = new Set((dayMarks || []).map((m) => m.date));
  const out = [];
  const start = fromISO > today ? fromISO : today;
  for (let d = start, i = 0; d <= toISO && i < 400; d = addDaysISO(d, 1), i++) {
    if (marked.has(d)) continue;
    const prev = addDaysISO(d, -1);
    const smonto = active.some((s) => s.date === prev && toMin(s.end) <= toMin(s.start));
    if (smonto) continue;
    const dayShifts = active.filter((s) => s.date === d && s.start && s.end);
    if (dayShifts.length === 0) { out.push({ date: d }); continue; }
    if (!includePartial) continue;
    const latestEnd = Math.max(...dayShifts.map((s) => (toMin(s.end) <= toMin(s.start) ? 24 * 60 : toMin(s.end))));
    const earliestStart = Math.min(...dayShifts.map((s) => toMin(s.start)));
    if (latestEnd <= 15 * 60) out.push({ date: d, from: fromMin(latestEnd) });
    else if (earliestStart >= 13 * 60) out.push({ date: d, to: fromMin(earliestStart) });
  }
  return out;
}

/** Testo da mandare alle strutture: giorni raggruppati per mese, i consecutivi come intervallo. */
export function availabilityText(days, { name = '' } = {}) {
  if (!days.length) return 'Al momento non ho giorni liberi nel periodo indicato.';
  const byMonth = new Map();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }
  const lines = [];
  for (const [key, list] of byMonth) {
    const parts = [];
    let i = 0;
    while (i < list.length) {
      const cur = list[i];
      const day = Number(cur.date.slice(8));
      if (cur.from || cur.to) {
        const [y, m] = key.split('-').map(Number);
        parts.push(`${WD_SHORT[weekdayOf(y, m, day)]} ${day} (${cur.from ? `dalle ${cur.from}` : `fino alle ${cur.to}`})`);
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < list.length && !list[j + 1].from && !list[j + 1].to && list[j + 1].date === addDaysISO(list[j].date, 1)) j++;
      const [y, m] = key.split('-').map(Number);
      if (j - i >= 2) parts.push(`dal ${day} al ${Number(list[j].date.slice(8))}`);
      else for (let k = i; k <= j; k++) {
        const dd = Number(list[k].date.slice(8));
        parts.push(`${WD_SHORT[weekdayOf(y, m, dd)]} ${dd}`);
      }
      i = j + 1;
    }
    const [, mm] = key.split('-').map(Number);
    lines.push(`${MONTHS_IT[mm - 1]}: ${parts.join(', ')}`);
  }
  return `Ciao! Queste sono le mie disponibilità:\n${lines.join('\n')}${name ? `\n\n${name}` : ''}`;
}

// ── Festività italiane ───────────────────────────────────────────────────
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export function holidaysOfYear(year) {
  const fixed = [[1, 1], [1, 6], [4, 25], [5, 1], [6, 2], [8, 15], [11, 1], [12, 8], [12, 25], [12, 26]];
  const set = new Set(fixed.map(([m, d]) => `${m}-${d}`));
  const es = easterSunday(year);
  set.add(`${es.month}-${es.day}`);
  const mon = new Date(year, es.month - 1, es.day); mon.setDate(mon.getDate() + 1);
  set.add(`${mon.getMonth() + 1}-${mon.getDate()}`);
  return set;
}

export function isHoliday(year, month, day, holidaySet) {
  return (holidaySet ?? holidaysOfYear(year)).has(`${month}-${day}`);
}

// 'weekday' | 'weekend' (sabato/domenica o festivo)
export function dayKind(year, month, day, holidaySet) {
  const wd = weekdayOf(year, month, day);
  if (wd >= 5 || isHoliday(year, month, day, holidaySet)) return 'weekend';
  return 'weekday';
}

// ── Tasse e contributi ───────────────────────────────────────────────────
// Due modi, a scelta in Studio → Fiscali (taxMode):
// - 'semplice' (com'era): si accantona una % fissa di tutto il fatturato (imposta + contributi);
// - 'forfettario' (la formula del regime forfettario): reddito = compensi × coefficiente di
//   redditività (78% per le professioni sanitarie); contributi della cassa = % del reddito;
//   imposta sostitutiva (15%, o 5% i primi anni) su reddito meno contributi. Il contributo
//   integrativo di una cassa (es. 4% ENPAPI) si versa alla cassa: non è un guadagno e non si
//   tassa; la rivalsa INPS invece fa parte del compenso.
// `taxes` è tutto ciò che non resta in tasca (imposta + contributi + integrativo da versare),
// così netto = fatturato − taxes in entrambi i modi.
export function computeTaxes(revenue, rivalsa, settings = {}) {
  const invoice = round2((Number(revenue) || 0) + (Number(rivalsa) || 0));
  if (settings.taxMode !== 'forfettario') {
    const taxPercent = Number(settings.taxPercent) || 0;
    const taxes = round2(invoice * (taxPercent / 100));
    const contributions = round2(invoice * ((Number(settings.contributionsPercent) || 0) / 100));
    return {
      taxMode: 'semplice', invoice, income: invoice, taxable: invoice,
      contributions, incomeTax: round2(taxes - contributions), integrativo: 0,
      taxes, net: round2(invoice - taxes), taxPercent,
    };
  }
  const integrativo = settings.rivalsaType === 'integrativo' ? round2(Number(rivalsa) || 0) : 0;
  const income = round2(invoice - integrativo);
  const coefficient = settings.coefficientPercent == null || settings.coefficientPercent === '' ? 78 : Number(settings.coefficientPercent) || 0;
  const taxable = round2(income * (coefficient / 100));
  const contributions = round2(taxable * ((Number(settings.forfContributionsPercent) || 0) / 100));
  const incomeTax = round2(Math.max(0, taxable - contributions) * ((Number(settings.forfTaxRatePercent) || 0) / 100));
  const taxes = round2(contributions + incomeTax + integrativo);
  return {
    taxMode: 'forfettario', invoice, income, taxable, coefficient,
    contributions, incomeTax, integrativo, taxes, net: round2(invoice - taxes),
    taxPercent: invoice > 0 ? round2((taxes / invoice) * 100) : 0,
  };
}

// ── Paga oraria ──────────────────────────────────────────────────────────
// Quando una sede cambia tariffa "a partire dal…", la vecchia resta in `pastRates`
// ([{ before: 'YYYY-MM-DD', rate }], in ordine di data): vale per i turni prima di quella
// data, così storico, grafici e confronti restano uguali alle fatture già fatte.
export function siteRateOn(site, dateISO) {
  if (!site) return 0;
  for (const r of site.pastRates ?? []) if (dateISO && dateISO < r.before) return Number(r.rate) || 0;
  return Number(site.rate) || 0;
}

// Tariffa di un turno: quella speciale del turno, se impostata, altrimenti quella della sede in quella data.
export function shiftRate(shift, site) {
  if (shift?.rate != null && shift.rate !== '' && !Number.isNaN(Number(shift.rate))) return Number(shift.rate);
  return siteRateOn(site, shift?.date);
}

// ── Aggregazione (nucleo condiviso da riepilogo mese/settimana) ─────────
const rivalsaFor = (site, settings) =>
  (site?.rivalsaPercent != null ? Number(site.rivalsaPercent) : Number(settings.rivalsaPercent) || 0);

function aggregate(shiftsIn, sites, settings) {
  const filteredShifts = activeShifts(shiftsIn); // gli annullati non contano
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const bySite = new Map();
  const unknown = { hours: 0 };
  for (const sh of filteredShifts) {
    const h = hoursOfShift(sh);
    const site = siteById.get(sh.siteId);
    if (!site) { unknown.hours += h; continue; }
    const cur = bySite.get(site.id) ?? { hours: 0, revenue: 0, rates: new Set() };
    const rate = shiftRate(sh, site);
    cur.hours += h;
    cur.revenue += h * rate;
    cur.rates.add(rate);
    bySite.set(site.id, cur);
  }

  const perSite = [...bySite.entries()].map(([id, { hours, revenue: rawRevenue, rates }]) => {
    const site = siteById.get(id);
    const rivPct = rivalsaFor(site, settings);
    const revenue = round2(rawRevenue);
    const rivalsa = round2(revenue * (rivPct / 100));
    // con tariffe diverse nel periodo (cambio di tariffa, turni speciali) si mostra la media
    const mixedRate = rates.size > 1;
    const rate = mixedRate ? (hours > 0 ? round2(rawRevenue / hours) : 0) : [...rates][0] ?? 0;
    return {
      siteId: id, name: site.name, color: site.color,
      hours: round2(hours), rate, mixedRate, rivalsaPercent: rivPct,
      revenue, rivalsa, total: round2(revenue + rivalsa),
    };
  }).sort((a, b) => b.total - a.total);

  if (unknown.hours > 0) {
    perSite.push({
      siteId: null, name: 'Sede eliminata', color: '#6b7280',
      hours: round2(unknown.hours), rate: 0, rivalsaPercent: 0, revenue: 0, rivalsa: 0, total: 0,
    });
  }

  const totalHours = round2(perSite.reduce((a, s) => a + s.hours, 0));
  const totalRevenue = round2(perSite.reduce((a, s) => a + s.revenue, 0));
  const totalRivalsa = round2(perSite.reduce((a, s) => a + s.rivalsa, 0));
  const tax = computeTaxes(totalRevenue, totalRivalsa, settings);

  return {
    perSite, totalHours, totalRevenue, totalRivalsa, totalInvoice: tax.invoice,
    taxPercent: tax.taxPercent, taxes: tax.taxes, net: tax.net,
    // dettaglio (per "Come si calcola", riepilogo, PDF): contributi, imposta, integrativo da versare
    taxMode: tax.taxMode, taxable: tax.taxable, contributions: tax.contributions, incomeTax: tax.incomeTax, integrativo: tax.integrativo,
    shiftCount: filteredShifts.length,
  };
}

/**
 * Foglio ore di una sola struttura in un periodo [fromISO, toISO]: un rigo per turno
 * (annullati esclusi) e i totali da fatturare — niente tasse né netto, si manda al cliente.
 */
export function computeTimesheet(shifts, site, settings, fromISO, toISO) {
  const rows = activeShifts(shiftsInRange(shifts, fromISO, toISO))
    .filter((s) => s.siteId === site.id)
    .sort(byDateThenStart)
    .map((s) => {
      const hours = hoursOfShift(s);
      const rate = shiftRate(s, site);
      return { id: s.id, date: s.date, start: s.start, end: s.end, hours, rate, amount: round2(hours * rate), note: s.note || '' };
    });
  const totalHours = round2(rows.reduce((a, r) => a + r.hours, 0));
  const revenue = round2(rows.reduce((a, r) => a + r.hours * r.rate, 0));
  const rivalsaPercent = rivalsaFor(site, settings);
  const rivalsa = round2(revenue * (rivalsaPercent / 100));
  return {
    site: { id: site.id, name: site.name }, fromISO, toISO, rows,
    totalHours, revenue, rivalsaPercent, rivalsa, total: round2(revenue + rivalsa),
  };
}

// Prestazioni occasionali: reddito diverso dal lavoro nelle sedi — niente
// rivalsa (non è prevista per questo tipo di reddito), tassazione separata
// a un'aliquota stimata (IRPEF a scaglioni, non l'aliquota del regime
// forfettario che vale solo per il fatturato da partita IVA).
function aggregateOccasional(filteredOccasional, settings) {
  const occasionalGross = round2(filteredOccasional.reduce((a, o) => a + (Number(o.grossAmount) || 0), 0));
  const occasionalTaxPercent = Number(settings.occasionalTaxRatePercent) || 0;
  const occasionalTaxes = round2(occasionalGross * (occasionalTaxPercent / 100));
  const occasionalNet = round2(occasionalGross - occasionalTaxes);
  return { occasionalGross, occasionalTaxPercent, occasionalTaxes, occasionalNet, occasionalCount: filteredOccasional.length };
}

/** Riepilogo di un mese: ore/fatturato per sede, totali, tasse, netto — più le prestazioni occasionali. */
export function computeMonthSummary(shifts, sites, settings, year, month, occasionalWork = []) {
  const base = { year, month, ...aggregate(shiftsInMonth(shifts, year, month), sites, settings) };
  const occ = aggregateOccasional(shiftsInMonth(occasionalWork, year, month), settings);
  return { ...base, ...occ, netTotal: round2(base.net + occ.occasionalNet) };
}

/** Riepilogo di un intervallo di date [startISO, endISO] incluso. */
export function computeRangeSummary(shifts, sites, settings, startISO, endISO, occasionalWork = []) {
  const base = { startISO, endISO, label: shortRangeLabel(startISO, endISO), ...aggregate(shiftsInRange(shifts, startISO, endISO), sites, settings) };
  const occ = aggregateOccasional(shiftsInRange(occasionalWork, startISO, endISO), settings);
  return { ...base, ...occ, netTotal: round2(base.net + occ.occasionalNet) };
}

/** Riepilogo della settimana (lun–dom) che contiene dateISO. */
export function computeWeekSummary(shifts, sites, settings, dateISO = todayISO(), occasionalWork = []) {
  return computeRangeSummary(shifts, sites, settings, startOfWeek(dateISO), endOfWeek(dateISO), occasionalWork);
}

/**
 * Il mese diviso tra "già lavorato" (turni finiti, prestazioni fino a oggi) e "in programma"
 * (il resto): `done`, `planned` e `total` sono riepiloghi come computeMonthSummary.
 */
export function computeMonthProgress(shifts, sites, settings, year, month, occasionalWork = [], now = new Date()) {
  const monthShifts = shiftsInMonth(shifts, year, month);
  const monthOcc = shiftsInMonth(occasionalWork, year, month);
  const todayStr = toISO(now);
  const doneShifts = monthShifts.filter((s) => isShiftDone(s, now));
  const plannedShifts = monthShifts.filter((s) => !isShiftDone(s, now));
  const doneOcc = monthOcc.filter((o) => (o.date || '') <= todayStr);
  const plannedOcc = monthOcc.filter((o) => (o.date || '') > todayStr);
  return {
    done: computeMonthSummary(doneShifts, sites, settings, year, month, doneOcc),
    planned: computeMonthSummary(plannedShifts, sites, settings, year, month, plannedOcc),
    total: computeMonthSummary(monthShifts, sites, settings, year, month, monthOcc),
  };
}

export function computeYearSummary(shifts, sites, settings, year, occasionalWork = []) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const s = computeMonthSummary(shifts, sites, settings, year, m, occasionalWork);
    if (s.shiftCount > 0 || s.occasionalCount > 0) months.push(s);
  }
  const totalHours = round2(months.reduce((a, m) => a + m.totalHours, 0));
  const totalInvoice = round2(months.reduce((a, m) => a + m.totalInvoice, 0));
  const occasionalGross = round2(months.reduce((a, m) => a + m.occasionalGross, 0));
  const occasionalTaxes = round2(months.reduce((a, m) => a + m.occasionalTaxes, 0));
  const occasionalNet = round2(months.reduce((a, m) => a + m.occasionalNet, 0));
  const totalTaxes = round2(months.reduce((a, m) => a + m.taxes, 0));
  const totalNet = round2(months.reduce((a, m) => a + m.net, 0));
  const totalNetAll = round2(totalNet + occasionalNet);
  const sumOf = (k) => round2(months.reduce((a, m) => a + (m[k] || 0), 0));
  return {
    year, months, totalHours, totalInvoice, totalTaxes, totalNet, occasionalGross, occasionalTaxes, occasionalNet, totalNetAll,
    totalRevenue: sumOf('totalRevenue'), totalRivalsa: sumOf('totalRivalsa'), totalTaxable: sumOf('taxable'),
    totalContributions: sumOf('contributions'), totalIncomeTax: sumOf('incomeTax'), totalIntegrativo: sumOf('integrativo'),
  };
}

// Elenco (anno,mese) con almeno un turno o una prestazione occasionale, più recenti prima
export function monthsWithData(shifts, occasionalWork = []) {
  const set = new Set();
  for (const s of [...shifts, ...occasionalWork]) {
    const { year, month } = shiftYearMonth(s);
    if (year && month) set.add(`${year}-${month}`);
  }
  return [...set].map((k) => { const [year, month] = k.split('-').map(Number); return { year, month }; })
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

// ── Andamento (per grafici) ──────────────────────────────────────────────
export function lastNWeeksSummaries(shifts, sites, settings, n, refDateISO = todayISO(), occasionalWork = []) {
  const out = [];
  let cursor = startOfWeek(refDateISO);
  for (let i = 0; i < n; i++) {
    out.unshift(computeRangeSummary(shifts, sites, settings, cursor, endOfWeek(cursor), occasionalWork));
    cursor = addDaysISO(cursor, -7);
  }
  return out;
}

export function lastNMonthsSummaries(shifts, sites, settings, n, refYear, refMonth, occasionalWork = []) {
  const out = [];
  let y = refYear, m = refMonth;
  for (let i = 0; i < n; i++) {
    out.unshift({ ...computeMonthSummary(shifts, sites, settings, y, m, occasionalWork), label: MONTHS_IT[m - 1].slice(0, 3) });
    m -= 1; if (m < 1) { m = 12; y -= 1; }
  }
  return out;
}

// ── Confronti (periodo corrente vs precedente) ──────────────────────────
function pctDelta(cur, prev) {
  if (!prev) return cur ? null : 0; // null = "nuovo" (nessun dato precedente da confrontare)
  return round2(((cur - prev) / prev) * 100);
}

export function compareWeeks(shifts, sites, settings, refDateISO = todayISO(), occasionalWork = []) {
  const curStart = startOfWeek(refDateISO);
  const current = computeRangeSummary(shifts, sites, settings, curStart, endOfWeek(refDateISO), occasionalWork);
  const prevStart = addDaysISO(curStart, -7);
  const previous = computeRangeSummary(shifts, sites, settings, prevStart, endOfWeek(prevStart), occasionalWork);
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.netTotal, previous.netTotal) };
}

export function compareMonths(shifts, sites, settings, year, month, occasionalWork = []) {
  const current = computeMonthSummary(shifts, sites, settings, year, month, occasionalWork);
  const py = month === 1 ? year - 1 : year, pm = month === 1 ? 12 : month - 1;
  const previous = computeMonthSummary(shifts, sites, settings, py, pm, occasionalWork);
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.netTotal, previous.netTotal) };
}

export function compareYears(shifts, sites, settings, year, occasionalWork = []) {
  const current = computeYearSummary(shifts, sites, settings, year, occasionalWork);
  const previous = computeYearSummary(shifts, sites, settings, year - 1, occasionalWork);
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.totalNetAll, previous.totalNetAll) };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
