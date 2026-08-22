// Generatore di turni "coverage-aware": assegna i turni giorno per giorno per
// coprire il fabbisogno richiesto, bilanciando ore/notti/weekend tra il personale,
// rispettando riposo dopo la notte, giorni consecutivi massimi, notti massime,
// festività italiane, ore contrattuali e turno preferito.

export function monthDays(year, month) {
  return new Date(year, month, 0).getDate(); // month 1-based
}

export function weekdayOf(year, month, day) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7; // 0=lun ... 6=dom
}

// ── Festività italiane ─────────────────────────────────────────────────
function easterSunday(year) {
  // Algoritmo di Gauss/Meeus
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
  const fixed = [
    [1, 1], [1, 6], [4, 25], [5, 1], [6, 2],
    [8, 15], [11, 1], [12, 8], [12, 25], [12, 26],
  ];
  const set = new Set(fixed.map(([m, d]) => `${m}-${d}`));
  // Pasqua + Lunedì dell'Angelo (Pasquetta)
  const es = easterSunday(year);
  const easter = new Date(year, es.month - 1, es.day);
  set.add(`${es.month}-${es.day}`);
  const mon = new Date(easter); mon.setDate(easter.getDate() + 1);
  set.add(`${mon.getMonth() + 1}-${mon.getDate()}`);
  return set;
}

export function isHoliday(year, month, day, holidaySet) {
  const set = holidaySet ?? holidaysOfYear(year);
  return set.has(`${month}-${day}`);
}

// feriale | weekend (sab/dom o festivo)
export function dayKind(year, month, day, holidaySet) {
  const wd = weekdayOf(year, month, day);
  if (wd >= 5) return 'weekend';
  if (isHoliday(year, month, day, holidaySet)) return 'weekend';
  return 'weekday';
}

// Fabbisogno per un turno in un certo tipo di giorno
function requiredFor(code, kind, rules) {
  const cov = rules?.coverage?.[code];
  if (!cov) return 0;
  const v = kind === 'weekend' ? cov.weekend : cov.weekday;
  return Math.max(0, Number(v) || 0);
}

/**
 * Genera il planning mensile.
 * @returns {{ year, month, days, schedule, warnings, holidays }}
 *  schedule: { [staffId]: { name, role, days: string[] } }
 *  warnings: [{ day, code, needed, got }]
 */
export function generateSchedule(year, month, cfg) {
  const { shifts, roles, rules, staff, unavailability } = cfg;
  const days = monthDays(year, month);
  const holidaySet = holidaysOfYear(year);

  const maxNights = rules.max_nights ?? 6;
  const maxStreak = rules.max_work_streak ?? 6;

  const isNight = (code) => !!shifts[code]?.is_night;
  const isWorking = (code) => !!shifts[code]?.working;
  const hoursOf = (code) => Number(shifts[code]?.hours || 0);

  // Indisponibilità: staffId -> Set(giorno)
  const unav = {};
  for (const u of unavailability) {
    const d = parseDay(u.day);
    if (d && d.getFullYear() === year && d.getMonth() + 1 === month) {
      (unav[u.staffId] ??= new Set()).add(d.getDate());
    }
  }

  // Codici turno lavorativi presenti
  const workingCodes = Object.keys(shifts).filter((c) => isWorking(c));
  const nightCodes = workingCodes.filter(isNight);
  const dayCodes = workingCodes.filter((c) => !isNight(c));
  const restCode = Object.keys(shifts).find((c) => c === 'R') ?? 'R';
  const hasSmonto = Object.keys(shifts).includes('S');

  // Stato per persona
  const st = staff.map((s) => ({
    ref: s,
    allowed: roles[s.role] ?? Object.keys(shifts),
    plan: new Array(days).fill('R'),
    last: null,
    streak: 0,
    nights: 0,
    hours: 0,
    weekends: 0,
    forced: [],           // coda di codici imposti (es. dopo notte: S,R)
    target: Number(s.contractHours) || 0,  // ore contrattuali mensili (0 = nessun target)
    prefer: s.preferredShift || '',
  }));
  const byId = new Map(st.map((x) => [x.ref.id, x]));

  const warnings = [];

  for (let d = 1; d <= days; d++) {
    const kind = dayKind(year, month, d, holidaySet);
    const isWknd = kind === 'weekend';
    const idx = d - 1;

    const assignedToday = new Set();

    // 1) Stati forzati: indisponibilità e coda post-notte
    for (const p of st) {
      if (unav[p.ref.id]?.has(d)) {
        p.plan[idx] = restCode; p.last = restCode; p.streak = 0; p.forced = [];
        assignedToday.add(p);
        continue;
      }
      if (p.forced.length > 0) {
        let code = p.forced.shift();
        if (!p.allowed.includes(code)) code = restCode;
        p.plan[idx] = code;
        p.last = code;
        p.streak = 0; // S/R interrompono la serie
        p.hours += hoursOf(code);
        assignedToday.add(p);
      }
    }

    // 2) Candidati liberi per la copertura
    const candidates = st.filter(
      (p) => !assignedToday.has(p) && p.streak < maxStreak,
    );

    // 3) Costruisci gli "slot" da coprire: prima le notti, poi i turni diurni (round-robin)
    const slots = [];
    for (const c of nightCodes) {
      const need = requiredFor(c, kind, rules);
      for (let k = 0; k < need; k++) slots.push(c);
    }
    const dayNeeds = dayCodes.map((c) => ({ c, n: requiredFor(c, kind, rules) }));
    let remaining = dayNeeds.reduce((a, x) => a + x.n, 0);
    while (remaining > 0) {
      for (const dn of dayNeeds) {
        if (dn.n > 0) { slots.push(dn.c); dn.n--; remaining--; }
      }
    }

    // 4) Riempi ogni slot con il miglior candidato eleggibile
    const deficit = {};
    for (const code of slots) {
      const pool = candidates.filter(
        (p) =>
          !assignedToday.has(p) &&
          p.allowed.includes(code) &&
          (!isNight(code) || ((maxNights == null || p.nights < maxNights) && p.last !== 'N')),
      );
      if (pool.length === 0) { deficit[code] = (deficit[code] || 0) + 1; continue; }

      pool.sort((a, b) => scoreForShift(a, code, isWknd) - scoreForShift(b, code, isWknd));
      const chosen = pool[0];
      chosen.plan[idx] = code;
      chosen.last = code;
      chosen.streak += 1;
      chosen.hours += hoursOf(code);
      if (isNight(code)) {
        chosen.nights += 1;
        chosen.forced = hasSmonto && chosen.allowed.includes('S') ? ['S', restCode] : [restCode];
      }
      if (isWknd) chosen.weekends += 1;
      assignedToday.add(chosen);
    }

    for (const [code, n] of Object.entries(deficit)) {
      warnings.push({ day: d, code, needed: requiredFor(code, kind, rules), got: requiredFor(code, kind, rules) - n });
    }

    // 5) Tutti gli altri riposano
    for (const p of st) {
      if (!assignedToday.has(p)) {
        p.plan[idx] = restCode; p.last = restCode; p.streak = 0;
      }
    }
  }

  const schedule = {};
  for (const p of st) {
    schedule[String(p.ref.id)] = { name: p.ref.name, role: p.ref.role, days: p.plan };
  }
  return { year, month, days, schedule, warnings, holidays: [...holidaySet] };

  // Punteggio: più basso = scelto per primo
  function scoreForShift(p, code, isWknd) {
    let s = 0;
    // 1) notti: chi ne ha fatte meno
    if (isNight(code)) s += p.nights * 1000;
    // 2) weekend/festivi: chi ne ha lavorati meno
    if (isWknd) s += p.weekends * 100;
    // 3) carico di lavoro (ore, relativo al contratto se impostato)
    const load = p.target > 0 ? (p.hours / p.target) * 50 : p.hours * 0.5;
    s += load;
    // 4) turno preferito: piccolo sconto
    if (p.prefer && p.prefer === code) s -= 5;
    // 5) tiebreak deterministico
    s += (p.ref.id % 7) * 0.01;
    return s;
  }
}

// Conteggio copertura effettiva per giorno/turno (per avvisi live dopo modifiche manuali)
export function coverageCounts(data, shifts) {
  const counts = {}; // day -> code -> n
  for (const s of Object.values(data.schedule)) {
    s.days.forEach((code, i) => {
      const day = i + 1;
      if (!shifts[code]?.working) return;
      (counts[day] ??= {})[code] = (counts[day]?.[code] || 0) + 1;
    });
  }
  return counts;
}

// Ricalcola gli avvisi di sotto-copertura da uno schedule (anche modificato a mano)
export function coverageDeficits(data, shifts, rules) {
  const counts = coverageCounts(data, shifts);
  const holidaySet = holidaysOfYear(data.year);
  const out = [];
  const workingCodes = Object.keys(shifts).filter((c) => shifts[c]?.working);
  for (let d = 1; d <= data.days; d++) {
    const kind = dayKind(data.year, data.month, d, holidaySet);
    for (const c of workingCodes) {
      const needed = requiredFor(c, kind, rules);
      if (needed <= 0) continue;
      const got = counts[d]?.[c] || 0;
      if (got < needed) out.push({ day: d, code: c, needed, got });
    }
  }
  return out;
}

// Statistiche di un piano individuale
export function staffStats(dayCodes, shifts) {
  const hoursFor = (c) => Number(shifts[c]?.hours || 0);
  return {
    hours: dayCodes.reduce((sum, c) => sum + hoursFor(c), 0),
    nights: dayCodes.filter((c) => shifts[c]?.is_night).length,
    mornings: dayCodes.filter((c) => c === 'M').length,
    afternoons: dayCodes.filter((c) => c === 'P').length,
    rests: dayCodes.filter((c) => c === 'R').length,
  };
}

function parseDay(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
