import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from './indicators.js';

// Calcola segnale composito da 5 indicatori
// Restituisce { signal: 'LONG'|'SHORT'|'NEUTRAL', strength: 0-100, reasons: [...] }
export function calcCompositeSignal(candles, indicators) {
  if (!candles || candles.length < 30 || !indicators) {
    return { signal: 'NEUTRAL', strength: 0, reasons: [] };
  }

  const { ema12, ema26, sma50, rsi, macd, bollinger, adx } = indicators;
  const last = arr => arr?.[arr.length - 1];
  const prev = arr => arr?.[arr.length - 2];

  let bull = 0, bear = 0;
  const reasons = [];

  const e12 = last(ema12), e26 = last(ema26);
  if (!isNaN(e12) && !isNaN(e26)) {
    if (e12 > e26) { bull += 1.5; reasons.push('EMA12 sopra EMA26 — trend rialzista'); }
    else           { bear += 1.5; reasons.push('EMA12 sotto EMA26 — trend ribassista'); }
  }

  const rsiVal = last(rsi);
  if (!isNaN(rsiVal)) {
    if (rsiVal < 30)      { bull += 2; reasons.push(`RSI ${rsiVal.toFixed(0)} — ipervenduto, rimbalzo probabile`); }
    else if (rsiVal > 70) { bear += 2; reasons.push(`RSI ${rsiVal.toFixed(0)} — ipercomprato, inversione probabile`); }
    else if (rsiVal < 45) { bear += 0.5; }
    else if (rsiVal > 55) { bull += 0.5; }
  }

  const macdH = last(macd?.histogram), prevH = prev(macd?.histogram);
  if (!isNaN(macdH) && !isNaN(prevH)) {
    if (macdH > 0 && prevH < 0) { bull += 2; reasons.push('MACD crossover rialzista'); }
    else if (macdH < 0 && prevH > 0) { bear += 2; reasons.push('MACD crossover ribassista'); }
    else if (macdH > 0) bull += 0.5;
    else if (macdH < 0) bear += 0.5;
  }

  const price = candles[candles.length - 1].close;
  const bbL = last(bollinger?.lower), bbU = last(bollinger?.upper);
  if (!isNaN(bbL) && !isNaN(bbU)) {
    if (price < bbL) { bull += 1.5; reasons.push('Prezzo sotto banda Bollinger — supporto'); }
    else if (price > bbU) { bear += 1.5; reasons.push('Prezzo sopra banda Bollinger — resistenza'); }
  }

  const adxVal = last(adx);
  const tm = !isNaN(adxVal) && adxVal > 25 ? 1.2 : 0.8;
  const sma = last(sma50);
  if (!isNaN(sma)) {
    if (price > sma) { bull += 1 * tm; reasons.push('Prezzo sopra SMA50 — struttura rialzista'); }
    else             { bear += 1 * tm; reasons.push('Prezzo sotto SMA50 — struttura ribassista'); }
  }

  const total = bull + bear;
  const strength = total > 0 ? Math.round(Math.abs(bull - bear) / total * 100) : 0;
  const signal = bull > bear + 0.5 ? 'LONG' : bear > bull + 0.5 ? 'SHORT' : 'NEUTRAL';

  return { signal, strength, reasons, bull, bear };
}
