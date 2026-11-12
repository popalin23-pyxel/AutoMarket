// "Chiedi a Turnio": domande pronte sui propri turni e soldi. La risposta si calcola sul
// telefono con gli stessi conti del resto dell'app (calc.js): niente servizi esterni, niente AI.
//
// Una domanda è { id, params: { period, siteId } }; la risposta è fatta di righe di testo a
// pezzi (i numeri sono pezzi a parte, così la pagina li mette in evidenza), più una tabellina.

import {
  computeRangeProgress, computeRangeSummary, computeMonthProgress, shiftsInRange, activeShifts, isShiftDone,
  hoursOfShift, monthDays, monthsWithData,
} from './calc.js';
import { MONTHS_IT, EXPENSE_CATEGORIES } from './defaults.js';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const euro = (v) => `€${(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v) => (Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 1 });
const hoursText = (h) => `${num(h)} ${Number(h) === 1 ? 'ora' : 'ore'}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// pezzi di testo: n = numero in evidenza, g = soldi "che ti restano" (verde), b = grassetto
const n = (v) => ({ t: 'n', v });
const g = (v) => ({ t: 'g', v });
const b = (v) => ({ t: 'b', v });

// ── Periodi ──────────────────────────────────────────────────────────────
// { type: 'month', y, m } | { type: 'year', y } | { type: 'all' }
export function periodPresets(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return [
    { id: 'thisMonth', label: 'Questo mese', period: { type: 'month', y, m } },
    { id: 'lastMonth', label: 'Mese scorso', period: { type: 'month', ...prev } },
    { id: 'thisYear', label: 'Quest’anno', period: { type: 'year', y } },
    { id: 'lastYear', label: 'Anno scorso', period: { type: 'year', y: y - 1 } },
    { id: 'all', label: 'In tutto', period: { type: 'all' } },
  ];
}

export const samePeriod = (a, c) => a?.type === c?.type && (a?.y ?? 0) === (c?.y ?? 0) && (a?.m ?? 0) === (c?.m ?? 0);

export function periodRange(p) {
  if (p.type === 'month') return [`${p.y}-${pad(p.m)}-01`, `${p.y}-${pad(p.m)}-${pad(monthDays(p.y, p.m))}`];
  if (p.type === 'year') return [`${p.y}-01-01`, `${p.y}-12-31`];
  return ['0000-01-01', '9999-12-31'];
}

// "a ottobre", "ad aprile 2025", "quest'anno", "nel 2025", "in tutto"
export function periodText(p, now = new Date()) {
  const cy = now.getFullYear();
  if (p.type === 'month') {
    const name = MONTHS_IT[p.m - 1].toLowerCase();
    return `${name.startsWith('a') ? 'ad' : 'a'} ${name}${p.y === cy ? '' : ` ${p.y}`}`;
  }
  if (p.type === 'year') return p.y === cy ? 'quest’anno' : `nel ${p.y}`;
  return 'in tutto';
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// il periodo è ancora in corso (oggi ci cade dentro)? Serve per dire "finora"
function isOngoing(p, now) {
  const [start, end] = periodRange(p);
  const today = isoOf(now);
  return p.type !== 'all' && start <= today && today <= end;
}

// ── Sedi tra cui scegliere: quelle con almeno un turno ───────────────────
export function askSites(state) {
  const used = new Set(activeShifts(state.shifts).map((s) => s.siteId));
  return state.sites.filter((s) => used.has(s.id));
}

// ── Domande ──────────────────────────────────────────────────────────────
// uses.period: 'any' (mesi e anni) | 'years' (solo anni e "in tutto"); uses.site: si può scegliere la sede
export const QUESTIONS = [
  { id: 'earned', emoji: '💶', title: 'Quanto ho guadagnato?', uses: { period: 'any', site: true }, preset: 'thisMonth' },
  { id: 'worked', emoji: '⏱️', title: 'Quanto ho lavorato?', uses: { period: 'any', site: true }, preset: 'thisMonth' },
  { id: 'nights', emoji: '🌙', title: 'Quante notti ho fatto?', uses: { period: 'any', site: true }, preset: 'thisYear' },
  { id: 'bestSite', emoji: '🏥', title: 'Quale struttura mi paga di più all’ora?', uses: { period: 'any' }, preset: 'thisYear' },
  { id: 'bestMonth', emoji: '🏆', title: 'Qual è stato il mio mese migliore?', uses: { period: 'years' }, preset: 'thisYear' },
  { id: 'goal', emoji: '🎯', title: 'Quanto mi manca per l’obiettivo?', uses: {} },
  { id: 'spent', emoji: '🧾', title: 'Quanto ho speso?', uses: { period: 'any' }, preset: 'thisMonth' },
];
const questionById = (id) => QUESTIONS.find((q) => q.id === id);

export function defaultParams(id, now = new Date()) {
  const q = questionById(id);
  const preset = periodPresets(now).find((p) => p.id === q?.preset);
  return { period: preset?.period ?? null, siteId: null };
}

// la domanda scritta per intero, con periodo e sede: "Quanto ho guadagnato a ottobre da CDS?"
export function questionText(id, params, state, now = new Date()) {
  const when = params.period ? periodText(params.period, now) : '';
  const site = params.siteId != null ? state.sites.find((s) => s.id === params.siteId)?.name : null;
  switch (id) {
    case 'earned': return `Quanto ho guadagnato ${when}${site ? ` da ${site}` : ''}?`;
    case 'worked': return `Quanto ho lavorato ${when}${site ? ` a ${site}` : ''}?`;
    case 'nights': return `Quante notti ho fatto ${when}${site ? ` a ${site}` : ''}?`;
    case 'bestSite': return `Quale struttura mi paga di più all’ora ${when}?`;
    case 'bestMonth': return params.period?.type === 'all' ? 'Qual è stato il mio mese migliore di sempre?' : `Qual è stato il mio mese migliore ${when}?`;
    case 'goal': return `Quanto mi manca per l’obiettivo di ${MONTHS_IT[now.getMonth()].toLowerCase()}?`;
    case 'spent': return `Quanto ho speso ${when}?`;
    default: return '';
  }
}

// ── Dati di partenza per una domanda ─────────────────────────────────────
const isNight = (sh) => (sh.end || '') <= (sh.start || '');
const hasData = (sum) => sum.shiftCount > 0 || sum.occasionalCount > 0;

function scope(state, params, now) {
  const [start, end] = periodRange(params.period);
  const site = params.siteId != null ? state.sites.find((s) => s.id === params.siteId) ?? null : null;
  // con una sede scelta contano solo i suoi turni (le prestazioni occasionali non hanno sede)
  const shifts = site ? state.shifts.filter((s) => s.siteId === site.id) : state.shifts;
  const occ = site ? [] : (state.occasionalWork ?? []);
  const inRange = activeShifts(shiftsInRange(shifts, start, end));
  return {
    start, end, site, shifts, occ,
    done: inRange.filter((s) => isShiftDone(s, now)),
    planned: inRange.filter((s) => !isShiftDone(s, now)),
    progress: computeRangeProgress(shifts, state.sites, state.settings, start, end, occ, now),
    when: periodText(params.period, now),
    ongoing: isOngoing(params.period, now),
  };
}

const sumHours = (list) => Math.round(list.reduce((a, s) => a + hoursOfShift(s), 0) * 100) / 100;
const summaryOf = (list, state, sc) => computeRangeSummary(list, state.sites, state.settings, sc.start, sc.end, []);

// i mesi del periodo con il netto già guadagnato, dal migliore
function monthsRanking(state, sc, now) {
  return monthsWithData(sc.shifts, sc.occ)
    .filter(({ year, month }) => { const d = `${year}-${pad(month)}-01`; return d >= sc.start && d <= sc.end; })
    .map(({ year, month }) => {
      const done = computeMonthProgress(sc.shifts, state.sites, state.settings, year, month, sc.occ, now).done;
      return { year, month, net: done.netTotal, invoice: done.totalInvoice, hours: done.totalHours };
    })
    .filter((x) => x.net > 0)
    .sort((a, c) => c.net - a.net);
}
// l'anno si scrive solo quando il periodo ne copre più d'uno ("in tutto")
const monthLabel = (x, withYear) => `${MONTHS_IT[x.month - 1]}${withYear ? ` ${x.year}` : ''}`;

// ── Risposte ─────────────────────────────────────────────────────────────
function answerEarned(state, params, now) {
  const sc = scope(state, params, now);
  const { done, planned, total } = sc.progress;
  const from = sc.site ? ` da ${sc.site.name}` : '';
  const lines = [];
  let table = null;

  if (!hasData(done)) {
    lines.push([hasData(planned) ? `${cap(sc.when)}${from} non hai ancora lavorato.` : `${cap(sc.when)}${from} non risultano turni.`]);
  } else {
    const first = [`${cap(sc.when)}${sc.ongoing ? ' finora' : ''}${from} hai lavorato `, n(hoursText(done.totalHours)), ' e fatturato ', n(euro(done.totalInvoice))];
    if (done.totalRivalsa > 0) first.push(', rivalsa compresa');
    if (done.occasionalGross > 0) first.push(', più ', n(euro(done.occasionalGross)), ' di prestazioni occasionali');
    first.push('.');
    lines.push(first);
    lines.push([sc.ongoing || params.period.type === 'all' ? 'Tolte tasse e contributi ti restano ' : 'Tolte tasse e contributi ti sono rimasti ', g(euro(done.netTotal)), '.']);

    if (!sc.site && done.perSite.filter((p) => p.total > 0).length > 1) {
      table = { title: 'Fatturato per struttura', rows: done.perSite.filter((p) => p.total > 0).map((p) => [p.name, euro(p.total)]) };
    } else if (params.period.type !== 'month') {
      const top = monthsRanking(state, sc, now).slice(0, 3);
      if (top.length > 1) table = { title: 'I mesi migliori (netto)', rows: top.map((x) => [monthLabel(x, params.period.type === 'all'), euro(x.net)]) };
    }
  }
  if (hasData(planned)) {
    lines.push(['In programma ci sono ', hasData(done) ? 'altre ' : '', n(hoursText(planned.totalHours)), ': con quelle arrivi a ', g(euro(total.netTotal)), ' netti.']);
  }
  return { lines, table };
}

function answerWorked(state, params, now) {
  const sc = scope(state, params, now);
  const at = sc.site ? ` a ${sc.site.name}` : '';
  const lines = [];
  let table = null;
  if (!sc.done.length) {
    lines.push([sc.planned.length ? `${cap(sc.when)}${at} non hai ancora lavorato.` : `${cap(sc.when)}${at} non risultano turni.`]);
  } else {
    const days = new Set(sc.done.map((s) => s.date)).size;
    const nights = sc.done.filter(isNight).length;
    lines.push([`${cap(sc.when)}${sc.ongoing ? ' finora' : ''}${at} hai fatto `, n(plural(sc.done.length, 'turno', 'turni')), ' in ', n(plural(days, 'giorno', 'giorni')),
      ', per ', n(hoursText(sumHours(sc.done))), '.']);
    if (nights > 0 && nights === sc.done.length) lines.push([nights === 1 ? 'Era una notte.' : 'Erano tutte notti.']);
    else if (nights > 0) lines.push(['Di questi, ', n(String(nights)), nights === 1 ? ' era una notte.' : ' erano notti.']);
    if (!sc.site) {
      const bySite = new Map();
      for (const s of sc.done) {
        const cur = bySite.get(s.siteId) ?? { count: 0, hours: 0 };
        cur.count += 1; cur.hours += hoursOfShift(s);
        bySite.set(s.siteId, cur);
      }
      if (bySite.size > 1) {
        table = {
          title: 'Per struttura',
          rows: [...bySite.entries()].sort((a, c) => c[1].hours - a[1].hours)
            .map(([id, v]) => [state.sites.find((s) => s.id === id)?.name ?? 'Sede eliminata', `${plural(v.count, 'turno', 'turni')} · ${hoursText(Math.round(v.hours * 100) / 100)}`]),
        };
      }
    }
  }
  if (sc.planned.length === 1) {
    lines.push([sc.done.length ? 'In programma c’è un altro turno (' : 'In programma c’è un turno (', n(hoursText(sumHours(sc.planned))), ').']);
  } else if (sc.planned.length > 1) {
    lines.push(['In programma: ', sc.done.length ? 'altri ' : '', n(plural(sc.planned.length, 'turno', 'turni')), ' (', n(hoursText(sumHours(sc.planned))), ').']);
  }
  return { lines, table };
}

function answerNights(state, params, now) {
  const sc = scope(state, params, now);
  const at = sc.site ? ` a ${sc.site.name}` : '';
  const nights = sc.done.filter(isNight);
  const lines = [];
  let table = null;
  if (!nights.length) {
    lines.push([`${cap(sc.when)}${at} non risultano notti.`]);
  } else {
    const hours = sumHours(nights);
    const sum = summaryOf(nights, state, sc);
    lines.push([`${cap(sc.when)}${sc.ongoing ? ' finora' : ''}${at} hai fatto `, n(plural(nights.length, 'notte', 'notti')), ' (', n(hoursText(hours)), ').']);
    const line = ['Tolte le tasse ti hanno reso ', g(euro(sum.net))];
    if (hours > 0) {
      line.push(', cioè ', n(euro(sum.net / hours)), ' netti l’ora');
      const days = sc.done.filter((s) => !isNight(s));
      const dayHours = sumHours(days);
      if (dayHours > 0) line.push(' (i turni di giorno: ', n(euro(summaryOf(days, state, sc).net / dayHours)), ')');
    }
    line.push('.');
    lines.push(line);
    if (!sc.site && sum.perSite.filter((p) => p.siteId != null).length > 1) {
      table = {
        title: 'Notti per struttura (fatturato)',
        rows: sum.perSite.filter((p) => p.siteId != null).map((p) => [`${p.name} · ${plural(nights.filter((s) => s.siteId === p.siteId).length, 'notte', 'notti')}`, euro(p.total)]),
      };
    }
  }
  const plannedNights = sc.planned.filter(isNight).length;
  if (plannedNights === 1) lines.push([nights.length ? 'In programma ce n’è un’altra.' : 'In programma ce n’è una.']);
  else if (plannedNights > 1) lines.push(['In programma ce ne sono ', nights.length ? 'altre ' : '', n(String(plannedNights)), '.']);
  return { lines, table };
}

function answerBestSite(state, params, now) {
  const sc = scope(state, { ...params, siteId: null }, now);
  const rows = state.sites.map((site) => {
    const list = sc.done.filter((s) => s.siteId === site.id);
    const hours = sumHours(list);
    if (hours <= 0) return null;
    const sum = summaryOf(list, state, sc);
    return { name: site.name, perHour: sum.net / hours, rate: sum.totalRevenue / hours };
  }).filter(Boolean).sort((a, c) => c.perHour - a.perHour);

  if (!rows.length) return { lines: [[`${cap(sc.when)} non risultano turni già fatti.`]] };
  const best = rows[0];
  if (rows.length === 1) {
    return { lines: [[`${cap(sc.when)} hai lavorato solo a `, b(best.name), ': ti rende ', g(euro(best.perHour)), ' netti per ogni ora (paga ', n(euro(best.rate)), ').']] };
  }
  return {
    lines: [[`${cap(sc.when)} la struttura che ti rende di più è `, b(best.name), ': ', g(euro(best.perHour)), ' netti per ogni ora (paga ', n(euro(best.rate)), ').']],
    table: { title: 'Netto per ogni ora', rows: rows.map((r) => [r.name, euro(r.perHour)]) },
    note: 'Netto = tolte tasse e contributi. Non conta il viaggio né le spese.',
  };
}

function answerBestMonth(state, params, now) {
  const sc = scope(state, { ...params, siteId: null }, now);
  const ranking = monthsRanking(state, sc, now);
  if (!ranking.length) return { lines: [[`${cap(sc.when)} non risultano mesi con turni già fatti.`]] };
  const all = params.period.type === 'all';
  const best = ranking[0];
  const current = best.year === now.getFullYear() && best.month === now.getMonth() + 1;
  const lines = [[
    all ? 'Il tuo mese migliore di sempre è ' : `${cap(sc.when)} il tuo mese migliore è `, current ? '' : 'stato ', b(monthLabel(best, all).toLowerCase()),
    ': ', g(euro(best.net)), ' netti con ', n(hoursText(best.hours)), current ? ' (ed è ancora in corso).' : '.',
  ]];
  const table = ranking.length > 1
    ? { title: 'I primi tre (netto)', rows: ranking.slice(0, 3).map((x) => [monthLabel(x, all), euro(x.net)]) }
    : null;
  return { lines, table };
}

function answerGoal(state, now) {
  const goal = Number(state.settings.monthlyGoal) || 0;
  if (goal <= 0) {
    return { lines: [['Non hai ancora impostato un obiettivo mensile.']], action: { label: 'Imposta l’obiettivo', route: ['altro', 'goal'] } };
  }
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const { done, planned, total } = computeMonthProgress(state.shifts, state.sites, state.settings, y, m, state.occasionalWork ?? [], now);
  const month = MONTHS_IT[m - 1].toLowerCase();
  const pct = Math.floor((done.netTotal / goal) * 100);
  if (done.netTotal >= goal) {
    return { lines: [['Obiettivo raggiunto 🎉 A ', month, ' hai già ', g(euro(done.netTotal)), ' netti su ', n(euro(goal)), '.']] };
  }
  const lines = [['Finora a ', month, ' sei a ', g(euro(done.netTotal)), ' netti su ', n(euro(goal)), ' (', n(`${pct}%`), ').']];
  const withPlanned = hasData(planned);
  if (withPlanned && total.netTotal >= goal) {
    lines.push(['Con i turni in programma arrivi a ', g(euro(total.netTotal)), ': l’obiettivo è coperto.']);
    return { lines };
  }
  const missing = goal - total.netTotal;
  lines.push(withPlanned
    ? ['Con i turni in programma arrivi a ', g(euro(total.netTotal)), ': ti mancano ancora ', b(euro(missing)), '.']
    : ['Ti mancano ', b(euro(missing)), '.']);
  // quante ore servono, al netto medio per ora di questo mese (o dell'anno se il mese è vuoto)
  let perHour = total.totalHours > 0 ? total.net / total.totalHours : 0;
  if (perHour <= 0) {
    const year = computeRangeSummary(state.shifts, state.sites, state.settings, `${y}-01-01`, `${y}-12-31`, []);
    perHour = year.totalHours > 0 ? year.net / year.totalHours : 0;
  }
  if (perHour > 0) {
    const hours = missing / perHour;
    lines.push(['Al tuo netto medio di ', n(euro(perHour)), ' l’ora sono circa ', n(hoursText(Math.ceil(hours))), ' di lavoro in più',
      hours >= 8 ? ` (${plural(Math.ceil(hours / 8), 'turno', 'turni')} da 8 ore).` : '.']);
  }
  return { lines };
}

function answerSpent(state, params, now) {
  const [start, end] = periodRange(params.period);
  const when = periodText(params.period, now);
  const list = (state.expenses ?? []).filter((e) => (e.date || '') >= start && (e.date || '') <= end);
  if (!list.length) return { lines: [[`${cap(when)} non hai registrato spese.`]] };
  const total = list.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const byCat = new Map();
  for (const e of list) byCat.set(e.category, (byCat.get(e.category) || 0) + (Number(e.amount) || 0));
  const label = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Altro';
  const rows = [...byCat.entries()].sort((a, c) => c[1] - a[1]).map(([id, v]) => [label(id), euro(v)]);
  const inTaxes = list.filter((e) => EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.inTaxes).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  return {
    lines: [[`${cap(when)} hai speso `, n(euro(total)), ' in ', n(plural(list.length, 'spesa', 'spese')), '.']],
    table: rows.length > 1 ? { title: 'Per tipo di spesa', rows } : null,
    note: inTaxes > 0 ? `Di cui ${euro(inTaxes)} di contributi alla cassa, già compresi nelle tasse stimate.` : null,
  };
}

/** La risposta a una domanda: { lines, table?, note?, action? } (vedi in cima al file). */
export function answer(id, params, state, now = new Date()) {
  switch (id) {
    case 'earned': return answerEarned(state, params, now);
    case 'worked': return answerWorked(state, params, now);
    case 'nights': return answerNights(state, params, now);
    case 'bestSite': return answerBestSite(state, params, now);
    case 'bestMonth': return answerBestMonth(state, params, now);
    case 'goal': return answerGoal(state, now);
    case 'spent': return answerSpent(state, params, now);
    default: return { lines: [] };
  }
}

// la risposta come testo semplice (per i test e per chi legge lo schermo)
export const answerText = (a) => a.lines.map((line) => line.map((x) => (typeof x === 'string' ? x : x.v)).join('')).join(' ');
