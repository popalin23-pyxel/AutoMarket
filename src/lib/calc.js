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

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ore di un turno, gestendo il caso "notte a cavallo di mezzanotte" (fine < inizio)
export function hoursOfShift(shift) {
  if (!shift?.start || !shift?.end) return 0;
  const [sh, sm] = shift.start.split(':').map(Number);
  const [eh, em] = shift.end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // turno notturno che sfora la mezzanotte
  return Math.round((mins / 60) * 100) / 100;
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

function addDaysISO(dateISO, days) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function shortRangeLabel(startISO, endISO) {
  const [, , sd] = startISO.split('-');
  const [ey, em, ed] = endISO.split('-');
  return `${Number(sd)}–${Number(ed)} ${MONTHS_IT[Number(em) - 1].slice(0, 3)}`;
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

// ── Aggregazione (nucleo condiviso da riepilogo mese/settimana) ─────────
const rivalsaFor = (site, settings) =>
  (site?.rivalsaPercent != null ? Number(site.rivalsaPercent) : Number(settings.rivalsaPercent) || 0);

function aggregate(filteredShifts, sites, settings) {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const bySite = new Map();
  const unknown = { hours: 0 };
  for (const sh of filteredShifts) {
    const h = hoursOfShift(sh);
    const site = siteById.get(sh.siteId);
    if (!site) { unknown.hours += h; continue; }
    const cur = bySite.get(site.id) ?? { hours: 0 };
    cur.hours += h;
    bySite.set(site.id, cur);
  }

  const perSite = [...bySite.entries()].map(([id, { hours }]) => {
    const site = siteById.get(id);
    const rivPct = rivalsaFor(site, settings);
    const revenue = round2(hours * site.rate);
    const rivalsa = round2(revenue * (rivPct / 100));
    return {
      siteId: id, name: site.name, color: site.color,
      hours: round2(hours), rate: site.rate, rivalsaPercent: rivPct,
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
  const totalInvoice = round2(totalRevenue + totalRivalsa);
  const taxPercent = Number(settings.taxPercent) || 0;
  const taxes = round2(totalInvoice * (taxPercent / 100));
  const net = round2(totalInvoice - taxes);

  return { perSite, totalHours, totalRevenue, totalRivalsa, totalInvoice, taxPercent, taxes, net, shiftCount: filteredShifts.length };
}

/** Riepilogo di un mese: ore/fatturato per sede, totali, tasse, netto. */
export function computeMonthSummary(shifts, sites, settings, year, month) {
  return { year, month, ...aggregate(shiftsInMonth(shifts, year, month), sites, settings) };
}

/** Riepilogo di un intervallo di date [startISO, endISO] incluso. */
export function computeRangeSummary(shifts, sites, settings, startISO, endISO) {
  return { startISO, endISO, label: shortRangeLabel(startISO, endISO), ...aggregate(shiftsInRange(shifts, startISO, endISO), sites, settings) };
}

/** Riepilogo della settimana (lun–dom) che contiene dateISO. */
export function computeWeekSummary(shifts, sites, settings, dateISO = todayISO()) {
  return computeRangeSummary(shifts, sites, settings, startOfWeek(dateISO), endOfWeek(dateISO));
}

export function computeYearSummary(shifts, sites, settings, year) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const s = computeMonthSummary(shifts, sites, settings, year, m);
    if (s.shiftCount > 0) months.push(s);
  }
  const totalHours = round2(months.reduce((a, m) => a + m.totalHours, 0));
  const totalInvoice = round2(months.reduce((a, m) => a + m.totalInvoice, 0));
  const totalTaxes = round2(months.reduce((a, m) => a + m.taxes, 0));
  const totalNet = round2(months.reduce((a, m) => a + m.net, 0));
  return { year, months, totalHours, totalInvoice, totalTaxes, totalNet };
}

// Elenco (anno,mese) con almeno un turno, più recenti prima
export function monthsWithData(shifts) {
  const set = new Set();
  for (const s of shifts) {
    const { year, month } = shiftYearMonth(s);
    if (year && month) set.add(`${year}-${month}`);
  }
  return [...set].map((k) => { const [year, month] = k.split('-').map(Number); return { year, month }; })
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

// ── Andamento (per grafici) ──────────────────────────────────────────────
export function lastNWeeksSummaries(shifts, sites, settings, n, refDateISO = todayISO()) {
  const out = [];
  let cursor = startOfWeek(refDateISO);
  for (let i = 0; i < n; i++) {
    out.unshift(computeRangeSummary(shifts, sites, settings, cursor, endOfWeek(cursor)));
    cursor = addDaysISO(cursor, -7);
  }
  return out;
}

export function lastNMonthsSummaries(shifts, sites, settings, n, refYear, refMonth) {
  const out = [];
  let y = refYear, m = refMonth;
  for (let i = 0; i < n; i++) {
    out.unshift({ ...computeMonthSummary(shifts, sites, settings, y, m), label: MONTHS_IT[m - 1].slice(0, 3) });
    m -= 1; if (m < 1) { m = 12; y -= 1; }
  }
  return out;
}

// ── Confronti (periodo corrente vs precedente) ──────────────────────────
function pctDelta(cur, prev) {
  if (!prev) return cur ? null : 0; // null = "nuovo" (nessun dato precedente da confrontare)
  return round2(((cur - prev) / prev) * 100);
}

export function compareWeeks(shifts, sites, settings, refDateISO = todayISO()) {
  const curStart = startOfWeek(refDateISO);
  const current = computeRangeSummary(shifts, sites, settings, curStart, endOfWeek(refDateISO));
  const prevStart = addDaysISO(curStart, -7);
  const previous = computeRangeSummary(shifts, sites, settings, prevStart, endOfWeek(prevStart));
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.net, previous.net) };
}

export function compareMonths(shifts, sites, settings, year, month) {
  const current = computeMonthSummary(shifts, sites, settings, year, month);
  const py = month === 1 ? year - 1 : year, pm = month === 1 ? 12 : month - 1;
  const previous = computeMonthSummary(shifts, sites, settings, py, pm);
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.net, previous.net) };
}

export function compareYears(shifts, sites, settings, year) {
  const current = computeYearSummary(shifts, sites, settings, year);
  const previous = computeYearSummary(shifts, sites, settings, year - 1);
  return { current, previous, deltaHoursPct: pctDelta(current.totalHours, previous.totalHours), deltaNetPct: pctDelta(current.totalNet, previous.totalNet) };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
