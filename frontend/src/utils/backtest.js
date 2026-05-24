/**
 * Modulo backtest e analisi frequenze storiche
 */
import { calcCompositeSignal } from './signals.js';

/**
 * Simula la strategia del segnale composito su dati storici
 * @param {Array} candles - Candele storiche
 * @param {Object} indicators - Tutti gli indicatori calcolati
 * @param {number} commission - Commissione per trade (default 0.04%)
 * @param {number} slippage - Slippage per trade (default 0.02%)
 * @returns {Object} Risultati del backtest
 */
export function runBacktest(candles, indicators, commission = 0.0004, slippage = 0.0002) {
  if (!candles || candles.length < 60 || !indicators) {
    return {
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
      trades: 0,
      kellyFraction: 0,
      noEdge: true,
    };
  }

  const totalCost = commission + slippage; // costo totale per lato
  const trades = [];
  let position = null; // { type: 'LONG'|'SHORT', entryPrice, entryIdx }

  // Costruisci sottoset degli indicatori per ogni indice
  const minStart = 60;
  const holdPeriod = 8; // candele di hold massimo

  for (let i = minStart; i < candles.length - holdPeriod - 1; i++) {
    // Costruisci indicatori fino all'indice i
    const subIndicators = buildSubIndicators(indicators, i);
    const subCandles = candles.slice(0, i + 1);

    const { signal } = calcCompositeSignal(subCandles, subIndicators, null, null);

    if (!position && (signal === 'LONG' || signal === 'SHORT')) {
      position = {
        type: signal,
        entryPrice: candles[i + 1].open, // entrata alla prossima apertura
        entryIdx: i + 1,
      };
    } else if (position) {
      const candles_held = i - position.entryIdx;
      const currentSignal = signal;

      // Chiudi se segnale inverso o hold period scaduto
      const shouldClose =
        candles_held >= holdPeriod ||
        (position.type === 'LONG' && currentSignal === 'SHORT') ||
        (position.type === 'SHORT' && currentSignal === 'LONG');

      if (shouldClose) {
        const exitPrice = candles[i + 1].open;
        const entryPrice = position.entryPrice;
        const entryFee = entryPrice * totalCost;
        const exitFee = exitPrice * totalCost;

        let pnlPct;
        if (position.type === 'LONG') {
          pnlPct = (exitPrice - entryPrice - entryFee - exitFee) / entryPrice;
        } else {
          pnlPct = (entryPrice - exitPrice - entryFee - exitFee) / entryPrice;
        }

        trades.push({
          type: position.type,
          entryPrice,
          exitPrice,
          pnlPct,
          entryIdx: position.entryIdx,
          exitIdx: i + 1,
        });

        position = null;
      }
    }
  }

  if (trades.length === 0) {
    return {
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
      trades: 0,
      kellyFraction: 0,
      noEdge: true,
    };
  }

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);

  const winRate = wins.length / trades.length;

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;

  const totalWins = wins.reduce((s, t) => s + t.pnlPct, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

  // Expectancy in R (ratio)
  const expectancy = avgLoss > 0 ? winRate * avgWin - (1 - winRate) * avgLoss : avgWin * winRate;

  // Max drawdown
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const t of trades) {
    equity *= 1 + t.pnlPct;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Kelly fraction: f = (expectancy * avgLoss - avgWin * (1-winRate)) formula Kelly completa
  // Semplificata: f = (WR/avgLoss - (1-WR)/avgWin) poi Kelly/4
  let kellyFraction = 0;
  if (avgLoss > 0 && avgWin > 0) {
    const kellyCriterion = winRate / avgLoss - (1 - winRate) / avgWin;
    kellyFraction = Math.max(0, kellyCriterion / 4); // Kelly/4 come suggerito
  }

  const noEdge = expectancy <= 0 || profitFactor < 1;

  return {
    winRate: parseFloat((winRate * 100).toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(4)),
    maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(1)),
    trades: trades.length,
    kellyFraction: parseFloat((kellyFraction * 100).toFixed(1)),
    noEdge,
  };
}

/**
 * Estrae sottoinsieme degli indicatori fino all'indice dato
 * @param {Object} indicators - Indicatori completi
 * @param {number} upToIdx - Indice massimo incluso
 * @returns {Object} Sottoinsieme indicatori
 */
function buildSubIndicators(indicators, upToIdx) {
  const sub = {};
  for (const key of Object.keys(indicators)) {
    const val = indicators[key];
    if (Array.isArray(val)) {
      sub[key] = val.slice(0, upToIdx + 1);
    } else if (val && typeof val === 'object') {
      // oggetti come macd, bollinger
      sub[key] = {};
      for (const k of Object.keys(val)) {
        if (Array.isArray(val[k])) {
          sub[key][k] = val[k].slice(0, upToIdx + 1);
        } else {
          sub[key][k] = val[k];
        }
      }
    } else {
      sub[key] = val;
    }
  }
  return sub;
}

/**
 * Calcola le frequenze storiche basate su segnali simili
 * @param {Array} candles - Candele storiche
 * @param {Object} indicators - Indicatori calcolati
 * @param {number} horizon - Orizzonte di osservazione in candele (default 24)
 * @param {number[]} targets - Target percentuali (default [5, 10, 20])
 * @returns {Object} Frequenze storiche
 */
export function calcHistoricalFrequencies(
  candles,
  indicators,
  horizon = 24,
  targets = [5, 10, 20]
) {
  if (!candles || candles.length < 60 || !indicators) {
    return {
      n: 0,
      frequencies: targets.map((t) => ({ target: t, upFreq: 0, downFreq: 0 })),
      avgReturn: 0,
      sampleWarning: true,
    };
  }

  // Calcola il segnale corrente per confronto
  const currentSignal = calcCompositeSignal(candles, indicators, null, null);
  const currentStrength = currentSignal.strength;

  // Trova candele passate con segnale simile (forza ±1)
  const minStart = 60;
  const matchingIndices = [];

  for (let i = minStart; i < candles.length - horizon - 1; i++) {
    if (matchingIndices.length >= 200) break; // limite campione per performance

    const subIndicators = buildSubIndicators(indicators, i);
    const subCandles = candles.slice(0, i + 1);
    const { signal, strength } = calcCompositeSignal(subCandles, subIndicators, null, null);

    if (signal === currentSignal.signal && Math.abs(strength - currentStrength) <= 1) {
      matchingIndices.push(i);
    }
  }

  const n = matchingIndices.length;
  const sampleWarning = n < 20;

  if (n === 0) {
    return {
      n: 0,
      frequencies: targets.map((t) => ({ target: t, upFreq: 0, downFreq: 0 })),
      avgReturn: 0,
      sampleWarning: true,
    };
  }

  // Per ogni candela corrispondente, misura cosa è successo nelle prossime `horizon` candele
  const returns = [];

  const frequencies = targets.map((targetPct) => {
    let upCount = 0;
    let downCount = 0;

    for (const idx of matchingIndices) {
      const entryPrice = candles[idx].close;
      let hitUp = false;
      let hitDown = false;

      for (let j = idx + 1; j <= Math.min(idx + horizon, candles.length - 1); j++) {
        const high = candles[j].high;
        const low = candles[j].low;

        if (!hitUp && high >= entryPrice * (1 + targetPct / 100)) {
          hitUp = true;
        }
        if (!hitDown && low <= entryPrice * (1 - targetPct / 100)) {
          hitDown = true;
        }
      }

      if (hitUp) upCount++;
      if (hitDown) downCount++;
    }

    return {
      target: targetPct,
      upFreq: parseFloat(((upCount / n) * 100).toFixed(1)),
      downFreq: parseFloat(((downCount / n) * 100).toFixed(1)),
    };
  });

  // Return medio sull'orizzonte
  for (const idx of matchingIndices) {
    const entryPrice = candles[idx].close;
    const exitIdx = Math.min(idx + horizon, candles.length - 1);
    const exitPrice = candles[exitIdx].close;
    returns.push((exitPrice - entryPrice) / entryPrice);
  }

  const avgReturn =
    returns.length > 0
      ? parseFloat(((returns.reduce((a, b) => a + b, 0) / returns.length) * 100).toFixed(2))
      : 0;

  return { n, frequencies, avgReturn, sampleWarning };
}
