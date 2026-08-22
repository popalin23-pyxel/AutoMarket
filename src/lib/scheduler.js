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
// Fabbisogno per (piano, ruolo, turno) in un certo tipo di giorno
function requiredFor(rules, floorId, role, code, kind) {
  const cell = rules?.coverage?.[floorId]?.[role]?.[code];
  if (!cell) return 0;
  return Math.max(0, Number(kind === 'weekend' ? cell.weekend : cell.weekday) || 0);
}

/**
 * Genera il planning mensile con copertura per piano e per ruolo.
 * @returns {{ year, month, days, floors, schedule, warnings, holidays }}
 *  schedule: { [staffId]: { name, role, days: string[], floors: string[] } }
 *  warnings: [{ day, floor, role, code, needed, got }]
 */
export function generateSchedule(year, month, cfg) {
  const { shifts, roles, rules, staff, unavailability } = cfg;
  const floors = (cfg.floors && cfg.floors.length) ? cfg.floors : [{ id: '_', name: '' }];
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

  const workingCodes = Object.keys(shifts).filter((c) => isWorking(c));
  const nightCodes = workingCodes.filter(isNight);
  const dayCodes = workingCodes.filter((c) => !isNight(c));
  const restCode = Object.keys(shifts).find((c) => c === 'R') ?? 'R';
  const hasSmonto = Object.keys(shifts).includes('S');

  const st = staff.map((s) => ({
    ref: s,
    allowed: roles[s.role] ?? Object.keys(shifts),
    // piani coperti: vuoto = tutti i piani
    canFloor: (fid) => !Array.isArray(s.floors) || s.floors.length === 0 || s.floors.includes(fid),
    plan: new Array(days).fill(restCode),
    planFloor: new Array(days).fill(''),
    last: null, streak: 0, nights: 0, hours: 0, weekends: 0, forced: [],
    target: Number(s.contractHours) || 0,
    prefer: s.preferredShift || '',
  }));

  const warnings = [];

  for (let d = 1; d <= days; d++) {
    const kind = dayKind(year, month, d, holidaySet);
    const isWknd = kind === 'weekend';
    const idx = d - 1;
    const assignedToday = new Set();

    // 1) Stati forzati: indisponibilità e coda post-notte
    for (const p of st) {
      if (unav[p.ref.id]?.has(d)) {
        p.plan[idx] = restCode; p.planFloor[idx] = ''; p.last = restCode; p.streak = 0; p.forced = [];
        assignedToday.add(p); continue;
      }
      if (p.forced.length > 0) {
        let code = p.forced.shift();
        if (!p.allowed.includes(code)) code = restCode;
        p.plan[idx] = code; p.planFloor[idx] = ''; p.last = code; p.streak = 0;
        p.hours += hoursOf(code);
        assignedToday.add(p);
      }
    }

    const candidates = st.filter((p) => !assignedToday.has(p) && p.streak < maxStreak);

    // 2) Slot da coprire: (piano, ruolo, turno). Prima le notti, poi i diurni round-robin.
    const nightSlots = [];
    const daySlots = [];
    for (const f of floors) {
      for (const role of Object.keys(roles)) {
        for (const c of nightCodes) {
          const need = requiredFor(rules, f.id, role, c, kind);
          for (let k = 0; k < need; k++) nightSlots.push({ floor: f.id, role, code: c });
        }
      }
    }
    // diurni: raccogli i bisogni e distribuiscili a giro per bilanciare M/P
    const dayNeeds = [];
    for (const f of floors) {
      for (const role of Object.keys(roles)) {
        for (const c of dayCodes) {
          const need = requiredFor(rules, f.id, role, c, kind);
          if (need > 0) dayNeeds.push({ floor: f.id, role, code: c, n: need });
        }
      }
    }
    let remaining = dayNeeds.reduce((a, x) => a + x.n, 0);
    while (remaining > 0) {
      for (const dn of dayNeeds) {
        if (dn.n > 0) { daySlots.push({ floor: dn.floor, role: dn.role, code: dn.code }); dn.n--; remaining--; }
      }
    }

    const slots = [...nightSlots, ...daySlots];

    // 3) Riempi ogni slot con il miglior candidato eleggibile
    const deficit = {}; // key "floor|role|code" -> mancanti
    for (const slot of slots) {
      const { floor, role, code } = slot;
      const pool = candidates.filter((p) =>
        !assignedToday.has(p) &&
        p.ref.role === role &&
        p.allowed.includes(code) &&
        p.canFloor(floor) &&
        (!isNight(code) || ((maxNights == null || p.nights < maxNights) && p.last !== 'N')),
      );
      if (pool.length === 0) {
        const key = `${floor}|${role}|${code}`;
        deficit[key] = (deficit[key] || 0) + 1;
        continue;
      }
      pool.sort((a, b) => scoreForShift(a, code, isWknd) - scoreForShift(b, code, isWknd));
      const chosen = pool[0];
      chosen.plan[idx] = code; chosen.planFloor[idx] = floor === '_' ? '' : floor;
      chosen.last = code; chosen.streak += 1; chosen.hours += hoursOf(code);
      if (isNight(code)) {
        chosen.nights += 1;
        chosen.forced = hasSmonto && chosen.allowed.includes('S') ? ['S', restCode] : [restCode];
      }
      if (isWknd) chosen.weekends += 1;
      assignedToday.add(chosen);
    }

    for (const [key, miss] of Object.entries(deficit)) {
      const [floor, role, code] = key.split('|');
      const needed = requiredFor(rules, floor, role, code, kind);
      warnings.push({ day: d, floor, role, code, needed, got: needed - miss });
    }

    // 4) Tutti gli altri riposano
    for (const p of st) {
      if (!assignedToday.has(p)) { p.plan[idx] = restCode; p.planFloor[idx] = ''; p.last = restCode; p.streak = 0; }
    }
  }

  const schedule = {};
  for (const p of st) {
    schedule[String(p.ref.id)] = {
      name: p.ref.name, role: p.ref.role,
      days: p.plan, floors: p.planFloor,
    };
  }
  return { year, month, days, floors: cfg.floors ?? [], schedule, warnings, holidays: [...holidaySet] };

  function scoreForShift(p, code, isWknd) {
    let s = 0;
    if (isNight(code)) s += p.nights * 1000;
    if (isWknd) s += p.weekends * 100;
    s += p.target > 0 ? (p.hours / p.target) * 50 : p.hours * 0.5;
    if (p.prefer && p.prefer === code) s -= 5;
    s += (p.ref.id % 7) * 0.01;
    return s;
  }
}

// Conteggio copertura effettiva per (giorno, piano, ruolo, turno)
export function coverageCounts(data) {
  const counts = {}; // day -> floor -> role -> code -> n
  for (const s of Object.values(data.schedule)) {
    s.days.forEach((code, i) => {
      const day = i + 1;
      const floor = (s.floors && s.floors[i]) || '';
      const role = s.role;
      ((((counts[day] ??= {})[floor] ??= {})[role] ??= {})[code] =
        (counts[day]?.[floor]?.[role]?.[code] || 0) + 1);
    });
  }
  return counts;
}

// Ricalcola gli avvisi di sotto-copertura (anche dopo modifiche manuali)
export function coverageDeficits(data, shifts, rules) {
  const counts = coverageCounts(data);
  const holidaySet = holidaysOfYear(data.year);
  const out = [];
  const workingCodes = Object.keys(shifts).filter((c) => shifts[c]?.working);
  const floors = (data.floors && data.floors.length) ? data.floors : [{ id: '', name: '' }];
  for (let d = 1; d <= data.days; d++) {
    const kind = dayKind(data.year, data.month, d, holidaySet);
    for (const f of floors) {
      const roleKeys = Object.keys(rules.coverage?.[f.id] ?? {});
      for (const role of roleKeys) {
        for (const c of workingCodes) {
          const needed = requiredFor(rules, f.id, role, c, kind);
          if (needed <= 0) continue;
          const got = counts[d]?.[f.id]?.[role]?.[c] || 0;
          if (got < needed) out.push({ day: d, floor: f.id, floorName: f.name, role, code: c, needed, got });
        }
      }
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
