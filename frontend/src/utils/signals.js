import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from './indicators.js';

// OBV Trend: misura se il volume è guidato da acquisti o vendite
// Restituisce valore in [-1, +1] — positivo = buy pressure, negativo = sell pressure
function calcOBVTrend(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 0;
  const slice = candles.slice(-(period + 1));
  let obv = 0;
  const series = [0];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].close > slice[i - 1].close)      obv += slice[i].volume;
    else if (slice[i].close < slice[i - 1].close) obv -= slice[i].volume;
    series.push(obv);
  }
  const change = series[series.length - 1] - series[0];
  const maxAbs = Math.max(...series.map(v => Math.abs(v)), 1);
  return Math.max(-1, Math.min(1, change / maxAbs));
}

// Volume Confirmation: segnali su volume basso hanno meno affidabilità
function isVolumeConfirmed(candles, period = 20) {
  if (!candles || candles.length < period + 1) return true;
  const recent = candles.slice(-(period + 1));
  const avg = recent.slice(0, period).reduce((s, c) => s + c.volume, 0) / period;
  return candles[candles.length - 1].volume >= avg * 0.7;
}

// Calcola segnale composito da 6 fattori con volume
// Restituisce { signal: 'LONG'|'SHORT'|'NEUTRAL', strength: 0-100, reasons: [...] }
export function calcCompositeSignal(candles, indicators) {
  if (!candles || candles.length < 30 || !indicators) {
    return { signal: 'NEUTRAL', strength: 0, reasons: [] };
  }

  const { ema12, ema26, sma50, rsi, macd, bollinger, adx } = indicators;
  const last = arr => arr?.[arr.length - 1];
  const prev = arr => arr?.[arr.length - 2];
  const price = candles[candles.length - 1].close;

  let bull = 0, bear = 0;
  const reasons = [];

  // 1. EMA 12/26 Cross (peso 2.0) — tendenza primaria
  const e12 = last(ema12), e26 = last(ema26);
  if (!isNaN(e12) && !isNaN(e26)) {
    if (e12 > e26) { bull += 2; reasons.push('EMA12 sopra EMA26 — trend rialzista'); }
    else           { bear += 2; reasons.push('EMA12 sotto EMA26 — trend ribassista'); }
  }

  // 2. RSI (soglie 35/65 — più reattive per crypto, peso 2.0)
  const rsiVal = last(rsi);
  if (!isNaN(rsiVal)) {
    if (rsiVal < 35)      { bull += 2;   reasons.push(`RSI ${rsiVal.toFixed(0)} — zona ipervenduta`); }
    else if (rsiVal > 65) { bear += 2;   reasons.push(`RSI ${rsiVal.toFixed(0)} — zona ipercomprata`); }
    else if (rsiVal < 48) bear += 0.5;
    else if (rsiVal > 52) bull += 0.5;
  }

  // 3. MACD Histogram crossover (peso 2.0)
  const macdH = last(macd?.histogram), prevH = prev(macd?.histogram);
  if (!isNaN(macdH) && !isNaN(prevH)) {
    if (macdH > 0 && prevH < 0)      { bull += 2; reasons.push('MACD crossover rialzista'); }
    else if (macdH < 0 && prevH > 0) { bear += 2; reasons.push('MACD crossover ribassista'); }
    else if (macdH > 0)  bull += 0.5;
    else if (macdH < 0)  bear += 0.5;
  }

  // 4. Bollinger Bands (peso 1.5 ai bordi, 0.3 dentro le bande)
  const bbL = last(bollinger?.lower), bbU = last(bollinger?.upper), bbM = last(bollinger?.middle);
  if (!isNaN(bbL) && !isNaN(bbU)) {
    if (price < bbL)      { bull += 1.5; reasons.push('Prezzo sotto banda Bollinger — supporto'); }
    else if (price > bbU) { bear += 1.5; reasons.push('Prezzo sopra banda Bollinger — resistenza'); }
    else if (!isNaN(bbM)) {
      if (price > bbM) bull += 0.3;
      else             bear += 0.3;
    }
  }

  // 5. SMA50 × ADX multiplier (peso 0.7–1.3 in base alla forza del trend)
  const adxVal = last(adx);
  const trendMult = !isNaN(adxVal) && adxVal > 25 ? 1.3 : 0.7;
  const sma = last(sma50);
  if (!isNaN(sma)) {
    if (price > sma) { bull += 1 * trendMult; reasons.push('Prezzo sopra SMA50 — struttura rialzista'); }
    else             { bear += 1 * trendMult; reasons.push('Prezzo sotto SMA50 — struttura ribassista'); }
  }

  // 6. OBV Trend (peso fino a 1.0) — pressione buy/sell reale dal volume
  const obvTrend = calcOBVTrend(candles, 14);
  if (Math.abs(obvTrend) > 0.15) {
    if (obvTrend > 0) {
      bull += Math.abs(obvTrend);
      reasons.push('Volume buy pressure — OBV in salita');
    } else {
      bear += Math.abs(obvTrend);
      reasons.push('Volume sell pressure — OBV in discesa');
    }
  }

  // 7. Volume confirmation: riduce i pesi del 20% quando il volume è sotto la media
  if (!isVolumeConfirmed(candles, 20)) {
    bull *= 0.8;
    bear *= 0.8;
  }

  const total = bull + bear;
  const strength = total > 0 ? Math.round(Math.abs(bull - bear) / total * 100) : 0;
  const signal = bull > bear + 0.5 ? 'LONG' : bear > bull + 0.5 ? 'SHORT' : 'NEUTRAL';

  return { signal, strength, reasons, bull, bear };
}
