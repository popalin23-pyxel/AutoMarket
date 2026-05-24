/**
 * Modulo per il logging e la verifica dei verdetti
 */

const STORAGE_KEY = 'verdict_log';
const MAX_ENTRIES = 1000;

/**
 * Salva un nuovo verdetto in localStorage
 * @param {Object} entry - Entrata da salvare
 */
export function logVerdict(entry) {
  const log = getVerdictLog();
  log.unshift(entry); // inserisce all'inizio
  const trimmed = log.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('verdictLog: impossibile salvare in localStorage', e);
  }
}

/**
 * Restituisce l'array di tutti i verdetti salvati
 * @returns {Array}
 */
export function getVerdictLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Verifica i verdetti pendenti della stessa coppia/timeframe
 * usando le candele disponibili. Aggiorna outcome in-place.
 * @param {Array} candles - Candele aggiornate
 * @param {string} pair - Coppia es. 'BTCUSDT'
 * @param {string} timeframe - Timeframe es. '1h'
 */
export function verifyPendingVerdicts(candles, pair, timeframe) {
  if (!candles || candles.length === 0) return;

  const log = getVerdictLog();
  let changed = false;

  const nowMs = Date.now();

  for (const entry of log) {
    if (entry.outcome !== null) continue;
    if (entry.pair !== pair || entry.timeframe !== timeframe) continue;

    const entryTime = new Date(entry.date).getTime();
    const horizonMs = entry.horizonMs || 3600000;
    const expiresAt = entryTime + horizonMs;

    // Trova le candele che rientrano nell'orizzonte temporale
    const relevantCandles = candles.filter((c) => {
      const candleMs = c.time * 1000;
      return candleMs > entryTime && candleMs <= expiresAt;
    });

    let hitTarget = false;
    let hitStop = false;

    for (const c of relevantCandles) {
      if (entry.direction === 'LONG') {
        if (entry.target && c.high >= entry.target) hitTarget = true;
        if (entry.stop && c.low <= entry.stop) hitStop = true;
      } else if (entry.direction === 'SHORT') {
        if (entry.target && c.low <= entry.target) hitTarget = true;
        if (entry.stop && c.high >= entry.stop) hitStop = true;
      }
    }

    if (hitTarget) {
      entry.outcome = 'hit_target';
      entry.verifiedAt = new Date().toISOString();
      changed = true;
    } else if (hitStop) {
      entry.outcome = 'hit_stop';
      entry.verifiedAt = new Date().toISOString();
      changed = true;
    } else if (nowMs > expiresAt) {
      entry.outcome = 'expired';
      entry.verifiedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn('verdictLog: impossibile aggiornare localStorage', e);
    }
  }
}

/**
 * Svuota l'intero log dei verdetti
 */
export function clearVerdictLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('verdictLog: impossibile svuotare localStorage', e);
  }
}
