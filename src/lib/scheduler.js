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

  const mode = cfg.mode ?? rules.genMode ?? 'count';

  // ── Modalità ROTAZIONE: ogni persona segue la sequenza del proprio ruolo,
  //    sfalsata, creando turni ciclici che si ripetono. ────────────────────
  if (mode === 'rotation') {
    const roleIdx = {};
    for (const p of st) {
      const seqAll = (rules.sequences?.[p.ref.role]?.length)
        ? rules.sequences[p.ref.role] : (roles[p.ref.role] ?? [restCode]);
      const seq = seqAll.length ? seqAll : [restCode];
      const li = roleIdx[p.ref.role] ?? 0; roleIdx[p.ref.role] = li + 1;
      // offset: se la persona ha un turno di inizio scelto, parte da lì; altrimenti sfalsa in automatico
      const startShift = p.ref.startShift;
      const offset = (startShift && seq.includes(startShift)) ? seq.indexOf(startShift) : (li % seq.length);
      const eligFloors = p.ref.floors?.length ? p.ref.floors : floors.map((f) => f.id);
      const floorForP = eligFloors[0] === '_' ? '' : eligFloors[0];
      for (let d = 1; d <= days; d++) {
        const idx = d - 1;
        if (unav[p.ref.id]?.has(d)) { p.plan[idx] = restCode; p.planFloor[idx] = ''; continue; }
        let code = seq[(offset + idx) % seq.length];
        if (!p.allowed.includes(code)) code = restCode;
        p.plan[idx] = code;
        p.planFloor[idx] = isWorking(code) ? floorForP : '';
      }
    }
    const schedule = {};
    for (const p of st) schedule[String(p.ref.id)] = { name: p.ref.name, role: p.ref.role, days: p.plan, floors: p.planFloor };
    return { year, month, days, floors: cfg.floors ?? [], schedule, warnings: [], holidays: [...holidaySet], mode };
  }

  // ── Modalità ORE: converte il monte-ore/giorno per (piano,ruolo) in un
  //    insieme di turni, seguendo la sequenza del ruolo come priorità. ──────
  const hoursTally = { weekday: {}, weekend: {} };
  if (mode === 'hours') {
    for (const kind of ['weekday', 'weekend']) {
      for (const f of floors) {
        for (const role of Object.keys(roles)) {
          const target = rules.coverageHours?.[f.id]?.[role]?.[kind] || 0;
          if (target <= 0) continue;
          const seqAll = (rules.sequences?.[role]?.length ? rules.sequences[role] : (roles[role] ?? []));
          const seq = seqAll.filter(isWorking);
          if (!seq.length) continue;
          const tally = {};
          let sum = 0, i = 0, guard = 0;
          while (sum < target && guard < 500) {
            const c = seq[i % seq.length];
            tally[c] = (tally[c] || 0) + 1; sum += hoursOf(c); i++; guard++;
          }
          (hoursTally[kind][f.id] ??= {})[role] = tally;
        }
      }
    }
  }

  const needCount = (floor, role, code, kind) =>
    mode === 'hours'
      ? (hoursTally[kind]?.[floor]?.[role]?.[code] || 0)
      : requiredFor(rules, floor, role, code, kind);

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
          const need = needCount(f.id, role, c, kind);
          for (let k = 0; k < need; k++) nightSlots.push({ floor: f.id, role, code: c });
        }
      }
    }
    // diurni: raccogli i bisogni e distribuiscili a giro per bilanciare M/P
    const dayNeeds = [];
    for (const f of floors) {
      for (const role of Object.keys(roles)) {
        for (const c of dayCodes) {
          const need = needCount(f.id, role, c, kind);
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
      const needed = needCount(floor, role, code, kind);
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
  return { year, month, days, floors: cfg.floors ?? [], schedule, warnings, holidays: [...holidaySet], mode };

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

// Ore lavorative assegnate per (giorno, piano, ruolo)
export function assignedHours(data, shifts) {
  const h = {}; // day -> floor -> role -> ore
  for (const s of Object.values(data.schedule)) {
    s.days.forEach((code, i) => {
      const hrs = Number(shifts[code]?.hours || 0);
      if (hrs <= 0) return;
      const day = i + 1;
      const floor = (s.floors && s.floors[i]) || '';
      (((h[day] ??= {})[floor] ??= {})[s.role]) = (h[day]?.[floor]?.[s.role] || 0) + hrs;
    });
  }
  return h;
}

// Deficit in ORE: confronta le ore assegnate col monte-ore/giorno per (piano,ruolo)
export function coverageHoursDeficits(data, shifts, rules) {
  const h = assignedHours(data, shifts);
  const holidaySet = holidaysOfYear(data.year);
  const out = [];
  const floors = (data.floors && data.floors.length) ? data.floors : [{ id: '', name: '' }];
  for (let d = 1; d <= data.days; d++) {
    const kind = dayKind(data.year, data.month, d, holidaySet);
    for (const f of floors) {
      const roleKeys = Object.keys(rules.coverageHours?.[f.id] ?? {});
      for (const role of roleKeys) {
        const cell = rules.coverageHours?.[f.id]?.[role];
        const needed = Math.max(0, Number(kind === 'weekend' ? cell?.weekend : cell?.weekday) || 0);
        if (needed <= 0) continue;
        const got = h[d]?.[f.id]?.[role] || 0;
        if (got < needed) out.push({ day: d, floor: f.id, floorName: f.name, role, neededHours: needed, gotHours: got });
      }
    }
  }
  return out;
}

function cloneSchedule(schedule) {
  return Object.fromEntries(Object.entries(schedule).map(([id, s]) => [id, {
    ...s, days: s.days.slice(), floors: s.floors ? s.floors.slice() : new Array(s.days.length).fill(''),
  }]));
}

// Riempi i buchi di copertura assegnando persone libere ed eleggibili.
export function fillGaps(data, ctx) {
  const { shifts, roles, rules, staff } = ctx;
  const isWork = (c) => !!shifts[c]?.working;
  const isNight = (c) => !!shifts[c]?.is_night;
  const staffById = new Map(staff.map((s) => [String(s.id), s]));
  const canFloor = (s, fid) => !s?.floors?.length || !fid || s.floors.includes(fid);
  const out = { ...data, schedule: cloneSchedule(data.schedule) };

  const findFree = (idx, role, floor, code) => {
    for (const [id, row] of Object.entries(out.schedule)) {
      if (row.role !== role) continue;
      if (isWork(row.days[idx])) continue;             // deve essere libero
      if (!(roles[role] ?? []).includes(code)) continue;
      if (!canFloor(staffById.get(id), floor)) continue;
      if (isNight(code) && idx > 0 && row.days[idx - 1] === 'N') continue;
      return id;
    }
    return null;
  };
  const assign = (id, idx, code, floor) => {
    const row = out.schedule[id];
    row.days[idx] = code;
    row.floors[idx] = isWork(code) ? (floor || '') : '';
  };
  const usesHours = out.mode === 'hours';

  for (let pass = 0; pass < 4; pass++) {
    let filled = 0;
    const defs = usesHours ? coverageHoursDeficits(out, shifts, rules) : coverageDeficits(out, shifts, rules);
    if (!defs.length) break;
    for (const d of defs) {
      const idx = d.day - 1;
      if (d.code) {
        const id = findFree(idx, d.role, d.floor, d.code);
        if (id) { assign(id, idx, d.code, d.floor); filled++; }
      } else {
        let missing = d.neededHours - d.gotHours;
        const seq = (rules.sequences?.[d.role]?.length ? rules.sequences[d.role] : (roles[d.role] ?? [])).filter(isWork);
        let i = 0, guard = 0;
        while (missing > 0 && guard < 30 && seq.length) {
          const code = seq[i % seq.length]; i++; guard++;
          const id = findFree(idx, d.role, d.floor, code);
          if (!id) continue;
          assign(id, idx, code, d.floor);
          missing -= Number(shifts[code]?.hours || 0);
          filled++;
        }
      }
    }
    if (!filled) break;
  }
  return out;
}

// Ottimizzatore: riduce lo squilibrio di ORE spostando turni diurni da chi
// ne ha di più a colleghi liberi ed eleggibili (la copertura resta invariata).
export function balance(data, ctx) {
  const { shifts, roles, staff } = ctx;
  const isWork = (c) => !!shifts[c]?.working;
  const isNight = (c) => !!shifts[c]?.is_night;
  const hoursOf = (c) => Number(shifts[c]?.hours || 0);
  const staffById = new Map(staff.map((s) => [String(s.id), s]));
  const canFloor = (s, fid) => !s?.floors?.length || !fid || s.floors.includes(fid);
  const out = { ...data, schedule: cloneSchedule(data.schedule) };
  const ids = Object.keys(out.schedule);
  const H = Object.fromEntries(ids.map((id) => [id, out.schedule[id].days.reduce((a, c) => a + hoursOf(c), 0)]));

  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let idx = 0; idx < out.days && !moved; idx++) {
      for (const aId of ids) {
        const A = out.schedule[aId];
        const code = A.days[idx];
        if (!isWork(code) || isNight(code)) continue;   // muovo solo turni diurni
        const fl = A.floors?.[idx] || '';
        const h = hoursOf(code);
        for (const bId of ids) {
          if (bId === aId) continue;
          const B = out.schedule[bId];
          if (B.role !== A.role) continue;
          if (isWork(B.days[idx])) continue;             // B libero quel giorno
          if (!(roles[B.role] ?? []).includes(code)) continue;
          if (!canFloor(staffById.get(bId), fl)) continue;
          if (H[aId] > H[bId] + h) {                     // migliora l'equità
            A.days[idx] = 'R'; A.floors[idx] = '';
            B.days[idx] = code; B.floors[idx] = fl;
            H[aId] -= h; H[bId] += h; moved = true; break;
          }
        }
        if (moved) break;
      }
    }
    if (!moved) break;
  }
  return out;
}

// Controlli di conformità: riposo minimo 11h tra turni e tetto ore settimanali.
const SHIFT_TIMES = { M: [7, 14], P: [14, 21], N: [22, 32] }; // ore dalla mezzanotte (N finisce alle 8 del giorno dopo)
export function complianceIssues(data, shifts, rules) {
  const cap = Number(rules.max_weekly_hours) || 48;
  const hoursOf = (c) => Number(shifts[c]?.hours || 0);
  const out = {};
  for (const [id, s] of Object.entries(data.schedule)) {
    let restViol = 0, lastEnd = null;
    for (let i = 0; i < s.days.length; i++) {
      const c = s.days[i];
      if (!shifts[c]?.working) { if (!SHIFT_TIMES[c]) lastEnd = null; continue; }
      const tm = SHIFT_TIMES[c];
      if (!tm) { lastEnd = null; continue; } // orario non noto → non valuto
      const start = i * 24 + tm[0], end = i * 24 + tm[1];
      if (lastEnd != null && start - lastEnd < 11) restViol++;
      lastEnd = end;
    }
    // settimane calendario (Lun–Dom)
    let weekPeak = 0, wsum = 0;
    for (let i = 0; i < s.days.length; i++) {
      wsum += hoursOf(s.days[i]);
      const wd = weekdayOf(data.year, data.month, i + 1);
      if (wd === 6 || i === s.days.length - 1) { weekPeak = Math.max(weekPeak, wsum); wsum = 0; }
    }
    out[id] = { name: s.name, restViol, weekPeak, weekOver: weekPeak > cap, cap };
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
