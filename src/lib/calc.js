// Calcoli: ore, fatturato, rivalsa, tasse, netto.

export function monthDays(year, month) {
  return new Date(year, month, 0).getDate(); // month 1-based
}

export function weekdayOf(year, month, day) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7; // 0=lun ... 6=dom
}

export function todayISO() {
  const d = new Date();
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

const rivalsaFor = (site, settings) =>
  (site?.rivalsaPercent != null ? Number(site.rivalsaPercent) : Number(settings.rivalsaPercent) || 0);

/**
 * Riepilogo di un mese: ore/fatturato per sede, totali, tasse, netto.
 */
export function computeMonthSummary(shifts, sites, settings, year, month) {
  const monthShifts = shiftsInMonth(shifts, year, month);
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const bySite = new Map(); // siteId -> { hours }
  const unknown = { hours: 0 }; // turni la cui sede è stata eliminata
  for (const sh of monthShifts) {
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

  return { year, month, perSite, totalHours, totalRevenue, totalRivalsa, totalInvoice, taxPercent, taxes, net, shiftCount: monthShifts.length };
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

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
