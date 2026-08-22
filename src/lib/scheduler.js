// Generatore di turni — porting fedele di generate_schedule() dal Turnify desktop,
// con le regole realmente applicate (nel desktop erano hardcoded).

export function monthDays(year, month) {
  // month è 1-based (1 = gennaio)
  return new Date(year, month, 0).getDate();
}

export function weekdayOf(year, month, day) {
  // 0 = lunedì ... 6 = domenica
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

/**
 * Genera il planning mensile.
 * @param {number} year
 * @param {number} month  1-based
 * @param {object} cfg    { shifts, roles, rules, staff, unavailability }
 * @returns {{ year, month, days, schedule }}
 *   schedule: { [staffId]: { name, role, days: string[] } }
 */
export function generateSchedule(year, month, cfg) {
  const { shifts, roles, rules, staff, unavailability } = cfg;
  const days = monthDays(year, month);

  const maxNights = rules.max_nights ?? 6;
  const maxStreak = rules.max_work_streak ?? 6;
  const preferAlt = rules.prefer_alt_mp ?? true;

  // Mappa indisponibilità: staffId -> Set(giorno)
  const unav = {};
  for (const u of unavailability) {
    const d = parseDay(u.day);
    if (d && d.getFullYear() === year && d.getMonth() + 1 === month) {
      (unav[u.staffId] ??= new Set()).add(d.getDate());
    }
  }

  const isNight = (code) => !!shifts[code]?.is_night;
  const isWorking = (code) => !!shifts[code]?.working;

  const schedule = {};

  for (const s of staff) {
    const allowed = roles[s.role] ?? Object.keys(shifts);

    // turni "core" lavorativi diurni (M/P tipicamente)
    let workingCore = allowed.filter((x) => isWorking(x) && !isNight(x));
    if (workingCore.length === 0) {
      workingCore = Object.keys(shifts).filter((k) => isWorking(k) && !isNight(k));
    }
    // fallback estremo: se un ruolo non ha turni lavorativi diurni, usa il riposo
    if (workingCore.length === 0) workingCore = ['R'];

    const hasNight = allowed.some((x) => isNight(x));
    const hasPost = allowed.includes('S'); // smonto notte
    const hasRest = allowed.includes('R') || allowed.some((x) => !isWorking(x));

    let nightsUsed = 0;
    let workStreak = 0;
    let last = null;
    let altFlag = 0;
    const plan = [];
    let d = 1;

    while (d <= days) {
      // indisponibilità → riposo forzato
      if (unav[s.id]?.has(d)) {
        plan.push('R'); workStreak = 0; last = 'R'; d += 1; continue;
      }

      // dopo la notte: smonto (+ riposo se possibile)
      if (last === 'N' && hasPost) {
        plan.push('S'); last = 'S'; d += 1;
        if (d <= days && hasRest) { plan.push('R'); last = 'R'; workStreak = 0; d += 1; }
        continue;
      }

      // troppi giorni consecutivi → riposo
      if (maxStreak && workStreak >= maxStreak && hasRest) {
        plan.push('R'); last = 'R'; workStreak = 0; d += 1; continue;
      }

      // scelta del turno del giorno
      let candidate;
      const nightSlot = weekdayOf(year, month, d) === 5; // sabato
      if (hasNight && (maxNights == null || nightsUsed < maxNights) && nightSlot && last !== 'N' && workStreak <= 4) {
        candidate = 'N';
      } else if (preferAlt && workingCore.length >= 2) {
        candidate = workingCore[altFlag % workingCore.length]; altFlag += 1;
      } else {
        candidate = workingCore[(d + s.id) % workingCore.length];
      }

      if (candidate === 'N' && last === 'N') candidate = workingCore[0];

      plan.push(candidate); last = candidate;
      if (isNight(candidate)) { nightsUsed += 1; workStreak += 1; }
      else if (isWorking(candidate)) { workStreak += 1; }
      else { workStreak = 0; }
      d += 1;
    }

    schedule[String(s.id)] = { name: s.name, role: s.role, days: plan };
  }

  return { year, month, days, schedule };
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
