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

// ─── ORACLE: Retroactive Analysis ────────────────────────────────────────────

const RETRO_KEY = 'automarket_oracle_retro';
// v3: nuova logica segnale (RSI 35/65, OBV, volume filter, R:R 1:2, target-wins)
const RETRO_CACHE_KEY = 'automarket_retro_cache_v3';

function loadRetro() {
  try { return JSON.parse(localStorage.getItem(RETRO_KEY) ?? '[]'); } catch { return []; }
}
function saveRetro(data) {
  try { localStorage.setItem(RETRO_KEY, JSON.stringify(data)); } catch {}
}

/**
 * Analisi retroattiva su 500 candele storiche.
 * Usa la stessa logica segnale del live (calcCompositeSignal).
 * Risultati cached in localStorage per coppia/timeframe.
 */
export async function runRetroactiveAnalysis(candles, pair, timeframe) {
  if (!candles || candles.length < 70) return;

  const lastTime = candles[candles.length - 1]?.time;
  const cacheKey = `${RETRO_CACHE_KEY}-${pair}-${timeframe}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      if (p.lastTime === lastTime) { saveRetro(p.signals); return; }
    }
  } catch {}

  const { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } =
    await import('./indicators.js');
  const { calcPrisma } = await import('./prisma.js');

  const closes = candles.map(c => c.close);
  const ema12     = calcEMA(closes, 12);
  const ema26     = calcEMA(closes, 26);
  const sma50     = calcSMA(closes, 50);
  const rsi       = calcRSI(closes, 14);
  const macd      = calcMACD(closes, 12, 26, 9);
  const bollinger = calcBollinger(closes, 20, 2);
  const atr       = calcATR(candles, 14);
  const adx       = calcADX(candles, 14);

  // Precomputa OBV per efficienza (una sola passata sull'intero array)
  const obvArr = new Array(candles.length).fill(0);
  for (let k = 1; k < candles.length; k++) {
    if (candles[k].close > candles[k - 1].close)      obvArr[k] = obvArr[k - 1] + candles[k].volume;
    else if (candles[k].close < candles[k - 1].close) obvArr[k] = obvArr[k - 1] - candles[k].volume;
    else                                                obvArr[k] = obvArr[k - 1];
  }

  // Precomputa somma cumulativa del volume (per rolling average)
  const volCumSum = new Array(candles.length).fill(0);
  volCumSum[0] = candles[0].volume;
  for (let k = 1; k < candles.length; k++) volCumSum[k] = volCumSum[k - 1] + candles[k].volume;

  const WINDOW_AHEAD = 20;
  const OBV_PERIOD   = 14;
  const VOL_PERIOD   = 20;
  const signals = [];

  for (let i = 60; i < candles.length - WINDOW_AHEAD; i++) {
    const atrVal = atr[i];
    if (isNaN(atrVal) || atrVal <= 0) continue;

    // ── Stessa logica di calcCompositeSignal in signals.js ──────────────────

    let bull = 0, bear = 0;
    const price = closes[i];

    // 1. EMA cross (peso 2.0)
    const e12 = ema12[i], e26 = ema26[i];
    if (!isNaN(e12) && !isNaN(e26)) { if (e12 > e26) bull += 2; else bear += 2; }

    // 2. RSI soglie 35/65 (peso 2.0)
    const rsiVal = rsi[i];
    if (!isNaN(rsiVal)) {
      if (rsiVal < 35)      bull += 2;
      else if (rsiVal > 65) bear += 2;
      else if (rsiVal < 48) bear += 0.5;
      else if (rsiVal > 52) bull += 0.5;
    }

    // 3. MACD histogram (peso 2.0)
    const macdH = macd.histogram[i];
    const prevH = i > 0 ? macd.histogram[i - 1] : NaN;
    if (!isNaN(macdH) && !isNaN(prevH)) {
      if (macdH > 0 && prevH < 0)      bull += 2;
      else if (macdH < 0 && prevH > 0) bear += 2;
      else if (macdH > 0) bull += 0.5;
      else if (macdH < 0) bear += 0.5;
    }

    // 4. Bollinger Bands (peso 1.5 ai bordi, 0.3 interno)
    const bbL = bollinger.lower[i], bbU = bollinger.upper[i], bbM = bollinger.middle[i];
    if (!isNaN(bbL) && !isNaN(bbU)) {
      if (price < bbL)      bull += 1.5;
      else if (price > bbU) bear += 1.5;
      else if (!isNaN(bbM)) { if (price > bbM) bull += 0.3; else bear += 0.3; }
    }

    // 5. SMA50 × ADX (peso 0.7–1.3)
    const adxV = adx[i];
    const tm   = !isNaN(adxV) && adxV > 25 ? 1.3 : 0.7;
    const sma  = sma50[i];
    if (!isNaN(sma)) { if (price > sma) bull += 1 * tm; else bear += 1 * tm; }

    // 6. OBV trend (peso fino a 1.0)
    const obvFrom   = Math.max(0, i - OBV_PERIOD);
    const obvChange = obvArr[i] - obvArr[obvFrom];
    const maxOBV    = Math.max(Math.abs(obvArr[i]), Math.abs(obvArr[obvFrom]), 1);
    const obvNorm   = Math.max(-1, Math.min(1, obvChange / maxOBV));
    if (Math.abs(obvNorm) > 0.15) {
      if (obvNorm > 0) bull += Math.abs(obvNorm);
      else             bear += Math.abs(obvNorm);
    }

    // 7. Volume confirmation (penalty 0.8× se volume sotto media 20-periodi)
    const volFrom = Math.max(0, i - VOL_PERIOD);
    const avgVol  = (volCumSum[i - 1] - (volFrom > 0 ? volCumSum[volFrom - 1] : 0)) / (i - volFrom);
    if (candles[i].volume < avgVol * 0.7) { bull *= 0.8; bear *= 0.8; }

    const direction = bull > bear + 0.5 ? 'LONG' : bear > bull + 0.5 ? 'SHORT' : null;
    if (!direction) continue;

    // ── Livelli operativi: R:R 1:2 (1.5×ATR stop, 3×ATR target) ────────────
    const entryPrice = price;
    const stop   = direction === 'LONG' ? entryPrice - 1.5 * atrVal : entryPrice + 1.5 * atrVal;
    const target = direction === 'LONG' ? entryPrice + 3   * atrVal : entryPrice - 3   * atrVal;

    // PRISMA su 200 candele (abbastanza per Hurst con [8,16,32,64])
    const prismaStart = Math.max(0, i - 199);
    const prisma = calcPrisma(
      closes.slice(prismaStart, i + 1),
      candles.slice(prismaStart, i + 1),
    );

    // ── Verifica esito: target batte stop se entrambi colpiti nella stessa candela
    let outcome = 'expired';
    for (let j = i + 1; j <= i + WINDOW_AHEAD; j++) {
      const fc = candles[j];
      const hitTarget = direction === 'LONG' ? fc.high >= target : fc.low  <= target;
      const hitStop   = direction === 'LONG' ? fc.low  <= stop   : fc.high >= stop;
      if (hitTarget) { outcome = 'hit_target'; break; }
      if (hitStop)   { outcome = 'hit_stop';   break; }
    }

    const total = bull + bear;
    signals.push({
      id: `retro-${pair}-${timeframe}-${candles[i].time}`,
      pair, timeframe,
      date: new Date(candles[i].time * 1000).toISOString(),
      direction, entryPrice, stop, target, outcome,
      prismaScore: prisma.score,
      prismaState: prisma.state,
      hurstH: prisma.H,
      strength: total > 0 ? Math.round(Math.abs(bull - bear) / total * 100) : 0,
      source: 'retro',
      verifiedAt: new Date(candles[i + WINDOW_AHEAD].time * 1000).toISOString(),
    });
  }

  saveRetro(signals);
  try { localStorage.setItem(cacheKey, JSON.stringify({ lastTime, signals })); } catch {}
}

export function getRetroLog() {
  return loadRetro();
}

/** Combina log live + retroattivo per l'OraclePanel */
export function getAllOracleData() {
  const live = getVerdictLog().map(e => ({ ...e, source: e.source ?? 'live' }));
  const retro = loadRetro();
  return [...live, ...retro];
}
