/**
 * Libreria di indicatori tecnici
 * Tutte le funzioni operano su array di numeri o oggetti candle {time,open,high,low,close,volume}
 */

/**
 * Calcola la media mobile esponenziale (EMA)
 * @param {number[]} closes - Array di prezzi di chiusura
 * @param {number} period - Periodo EMA
 * @returns {number[]} Array di valori EMA (stessa lunghezza di closes, NaN per i valori iniziali)
 */
export function calcEMA(closes, period) {
  if (!closes || closes.length < period) return closes.map(() => NaN);
  const k = 2 / (period + 1);
  const result = new Array(closes.length).fill(NaN);

  // Primo valore EMA = SMA dei primi `period` valori
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

/**
 * Calcola la media mobile semplice (SMA)
 * @param {number[]} closes - Array di prezzi di chiusura
 * @param {number} period - Periodo SMA
 * @returns {number[]} Array di valori SMA
 */
export function calcSMA(closes, period) {
  if (!closes || closes.length < period) return closes.map(() => NaN);
  const result = new Array(closes.length).fill(NaN);
  let sum = 0;

  for (let i = 0; i < period - 1; i++) {
    sum += closes[i];
  }

  for (let i = period - 1; i < closes.length; i++) {
    sum += closes[i];
    result[i] = sum / period;
    sum -= closes[i - period + 1];
  }
  return result;
}

/**
 * Calcola l'indice di forza relativa (RSI)
 * @param {number[]} closes - Array di prezzi di chiusura
 * @param {number} period - Periodo RSI (default 14)
 * @returns {number[]} Array di valori RSI (0-100)
 */
export function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return closes.map(() => NaN);
  const result = new Array(closes.length).fill(NaN);

  let avgGain = 0;
  let avgLoss = 0;

  // Calcola guadagni/perdite medi iniziali
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - 100 / (1 + rs);
  }

  // RSI con smoothing di Wilder
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }
  return result;
}

/**
 * Calcola il MACD (Moving Average Convergence Divergence)
 * @param {number[]} closes
 * @param {number} fast - Periodo veloce (default 12)
 * @param {number} slow - Periodo lento (default 26)
 * @param {number} signalPeriod - Periodo segnale (default 9)
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function calcMACD(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );

  // Calcola signal line come EMA del macd (solo sui valori validi)
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const emaOfMacd = calcEMA(validMacd, signalPeriod);

  // Rimappa sui valori originali
  const signalLine = new Array(closes.length).fill(NaN);
  let validIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = emaOfMacd[validIdx];
      validIdx++;
    }
  }

  const histogram = closes.map((_, i) =>
    isNaN(macdLine[i]) || isNaN(signalLine[i]) ? NaN : macdLine[i] - signalLine[i]
  );

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calcola le Bande di Bollinger
 * @param {number[]} closes
 * @param {number} period - Periodo (default 20)
 * @param {number} mult - Moltiplicatore deviazione standard (default 2)
 * @returns {{ upper: number[], middle: number[], lower: number[] }}
 */
export function calcBollinger(closes, period = 20, mult = 2) {
  const middle = calcSMA(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    upper[i] = mean + mult * stdDev;
    lower[i] = mean - mult * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Calcola l'Average True Range (ATR)
 * @param {Array<{high:number,low:number,close:number}>} candles
 * @param {number} period - Periodo (default 14)
 * @returns {number[]} Array di valori ATR
 */
export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return candles.map(() => NaN);
  const result = new Array(candles.length).fill(NaN);

  // True Range
  const tr = new Array(candles.length).fill(NaN);
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }

  // Primo ATR = SMA dei primi `period` TR
  let sumTR = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += tr[i];
  }
  result[period] = sumTR / period;

  // ATR con smoothing di Wilder
  for (let i = period + 1; i < candles.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }

  return result;
}

/**
 * Calcola il Directional Movement Index (ADX)
 * @param {Array<{high:number,low:number,close:number}>} candles
 * @param {number} period - Periodo (default 14)
 * @returns {number[]} Array di valori ADX (0-100)
 */
export function calcADX(candles, period = 14) {
  if (!candles || candles.length < period * 2 + 1) return candles.map(() => NaN);
  const result = new Array(candles.length).fill(NaN);

  const plusDM = new Array(candles.length).fill(0);
  const minusDM = new Array(candles.length).fill(0);
  const tr = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }

  // Smoothed values con metodo Wilder
  let smTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smPlusDM = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smMinusDM = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  const dx = new Array(candles.length).fill(NaN);

  const calcDX = (p, m, t) => {
    if (t === 0) return 0;
    const plusDI = (p / t) * 100;
    const minusDI = (m / t) * 100;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    return diSum === 0 ? 0 : (diDiff / diSum) * 100;
  };

  dx[period] = calcDX(smPlusDM, smMinusDM, smTR);

  for (let i = period + 1; i < candles.length; i++) {
    smTR = smTR - smTR / period + tr[i];
    smPlusDM = smPlusDM - smPlusDM / period + plusDM[i];
    smMinusDM = smMinusDM - smMinusDM / period + minusDM[i];
    dx[i] = calcDX(smPlusDM, smMinusDM, smTR);
  }

  // ADX = SMA del DX su `period` periodi
  let sumDX = 0;
  let count = 0;
  for (let i = period; i < period * 2; i++) {
    if (!isNaN(dx[i])) {
      sumDX += dx[i];
      count++;
    }
  }
  if (count === period) {
    result[period * 2 - 1] = sumDX / period;
  }

  for (let i = period * 2; i < candles.length; i++) {
    if (!isNaN(result[i - 1]) && !isNaN(dx[i])) {
      result[i] = (result[i - 1] * (period - 1) + dx[i]) / period;
    }
  }

  return result;
}
