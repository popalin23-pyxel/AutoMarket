/**
 * Modulo segnali di trading e analisi regime di mercato
 */

/**
 * Rileva il regime di mercato corrente
 * @param {Array} candles - Array di candele
 * @param {Object} indicators - Oggetto con tutti gli indicatori calcolati
 * @returns {{ regime: string, description: string }}
 */
export function detectRegime(candles, indicators) {
  if (!candles || candles.length < 30 || !indicators) {
    return { regime: 'lateral', description: 'Dati insufficienti' };
  }

  const { adx, atr } = indicators;
  if (!adx || !atr) return { regime: 'lateral', description: 'Indicatori non disponibili' };

  const lastIdx = candles.length - 1;
  const currentADX = adx[lastIdx];
  const currentATR = atr[lastIdx];
  const currentPrice = candles[lastIdx].close;

  // ATR relativo al prezzo (volatilità normalizzata)
  const relativeATR = currentPrice > 0 ? (currentATR / currentPrice) * 100 : 0;

  // Direzione trend tramite EMA
  const { ema12, ema26 } = indicators;
  const lastEMA12 = ema12 ? ema12[lastIdx] : null;
  const lastEMA26 = ema26 ? ema26[lastIdx] : null;

  if (isNaN(currentADX)) {
    return { regime: 'lateral', description: 'ADX non calcolato' };
  }

  // Alta volatilità: ATR > 3% del prezzo
  if (relativeATR > 3) {
    return {
      regime: 'high_volatility',
      description: `Alta volatilità (ATR ${relativeATR.toFixed(2)}% del prezzo)`,
    };
  }

  // Trend forte: ADX > 25
  if (currentADX > 25) {
    if (lastEMA12 && lastEMA26 && !isNaN(lastEMA12) && !isNaN(lastEMA26)) {
      if (lastEMA12 > lastEMA26) {
        return {
          regime: 'trend_up',
          description: `Trend rialzista (ADX ${currentADX.toFixed(1)})`,
        };
      } else {
        return {
          regime: 'trend_down',
          description: `Trend ribassista (ADX ${currentADX.toFixed(1)})`,
        };
      }
    }
    return {
      regime: 'trend_up',
      description: `Trend in corso (ADX ${currentADX.toFixed(1)})`,
    };
  }

  // Mercato laterale: ADX < 20
  if (currentADX < 20) {
    return {
      regime: 'lateral',
      description: `Mercato laterale (ADX ${currentADX.toFixed(1)})`,
    };
  }

  // ADX tra 20 e 25: transizione
  return {
    regime: 'lateral',
    description: `Mercato in transizione (ADX ${currentADX.toFixed(1)})`,
  };
}

/**
 * Calcola il segnale composito basato su 7 fattori
 * @param {Array} candles
 * @param {Object} indicators
 * @param {Object|null} fundingData
 * @param {Object|null} bookData
 * @returns {{ signal: string, strength: number, factors: Array }}
 */
export function calcCompositeSignal(candles, indicators, fundingData = null, bookData = null) {
  if (!candles || candles.length < 50 || !indicators) {
    return { signal: 'NEUTRAL', strength: 0, factors: [] };
  }

  const lastIdx = candles.length - 1;
  const price = candles[lastIdx].close;

  const { ema12, ema26, rsi, macd, bollinger } = indicators;

  const factors = [];
  let bullishCount = 0;

  // Fattore 1: Prezzo vs EMA26
  const lastEMA26 = ema26 ? ema26[lastIdx] : null;
  if (lastEMA26 && !isNaN(lastEMA26)) {
    const isBullish = price > lastEMA26;
    factors.push({
      name: 'Prezzo vs EMA26',
      value: `${isBullish ? '+' : '-'}${Math.abs(((price - lastEMA26) / lastEMA26) * 100).toFixed(2)}%`,
      bullish: isBullish,
    });
    if (isBullish) bullishCount++;
  } else {
    factors.push({ name: 'Prezzo vs EMA26', value: 'N/D', bullish: false });
  }

  // Fattore 2: EMA12 vs EMA26 (incrocio veloce/lento)
  const lastEMA12 = ema12 ? ema12[lastIdx] : null;
  if (lastEMA12 && lastEMA26 && !isNaN(lastEMA12) && !isNaN(lastEMA26)) {
    const isBullish = lastEMA12 > lastEMA26;
    const spread = ((lastEMA12 - lastEMA26) / lastEMA26) * 100;
    factors.push({
      name: 'EMA12 vs EMA26',
      value: `${isBullish ? '+' : ''}${spread.toFixed(2)}%`,
      bullish: isBullish,
    });
    if (isBullish) bullishCount++;
  } else {
    factors.push({ name: 'EMA12 vs EMA26', value: 'N/D', bullish: false });
  }

  // Fattore 3: RSI (estremi)
  const lastRSI = rsi ? rsi[lastIdx] : null;
  if (lastRSI && !isNaN(lastRSI)) {
    const isBullish = lastRSI < 50; // oversold zona favorevole a long
    let rsiLabel = lastRSI.toFixed(1);
    if (lastRSI < 30) rsiLabel += ' (ipervenduto)';
    else if (lastRSI > 70) rsiLabel += ' (ipercomprato)';
    factors.push({
      name: 'RSI',
      value: rsiLabel,
      bullish: isBullish,
    });
    // RSI < 30 = forte segnale long (ipervenduto)
    if (lastRSI < 30) bullishCount++;
    else if (lastRSI > 70) { /* bearish, non incrementare */ }
    else if (isBullish) bullishCount++;
  } else {
    factors.push({ name: 'RSI', value: 'N/D', bullish: false });
  }

  // Fattore 4: MACD vs Signal line
  if (macd && macd.macd && macd.signal) {
    const lastMACD = macd.macd[lastIdx];
    const lastSignal = macd.signal[lastIdx];
    if (!isNaN(lastMACD) && !isNaN(lastSignal)) {
      const isBullish = lastMACD > lastSignal;
      factors.push({
        name: 'MACD vs Signal',
        value: `${isBullish ? '+' : ''}${(lastMACD - lastSignal).toFixed(4)}`,
        bullish: isBullish,
      });
      if (isBullish) bullishCount++;
    } else {
      factors.push({ name: 'MACD vs Signal', value: 'N/D', bullish: false });
    }
  } else {
    factors.push({ name: 'MACD vs Signal', value: 'N/D', bullish: false });
  }

  // Fattore 5: Posizione nelle Bande di Bollinger
  if (bollinger) {
    const lastUpper = bollinger.upper[lastIdx];
    const lastMiddle = bollinger.middle[lastIdx];
    const lastLower = bollinger.lower[lastIdx];
    if (!isNaN(lastUpper) && !isNaN(lastLower) && !isNaN(lastMiddle)) {
      const bandwidth = lastUpper - lastLower;
      const positionInBand = bandwidth > 0 ? ((price - lastLower) / bandwidth) * 100 : 50;
      const isBullish = positionInBand < 50; // sotto la mediana = potenziale rimbalzo
      factors.push({
        name: 'Bollinger',
        value: `${positionInBand.toFixed(0)}% della banda`,
        bullish: isBullish,
      });
      if (isBullish) bullishCount++;
    } else {
      factors.push({ name: 'Bollinger', value: 'N/D', bullish: false });
    }
  } else {
    factors.push({ name: 'Bollinger', value: 'N/D', bullish: false });
  }

  // Fattore 6: Funding/OI (affollamento)
  if (fundingData && !fundingData.error) {
    const fundingRate = parseFloat(fundingData.lastFundingRate || fundingData.fundingRate || 0);
    // Funding molto positivo = long sovraffollati = bearish
    // Funding molto negativo = short sovraffollati = bullish
    const isBullish = fundingRate < -0.0001; // funding negativo favorisce long
    const isNeutral = Math.abs(fundingRate) < 0.0002;
    factors.push({
      name: 'Funding/OI',
      value: `${(fundingRate * 100).toFixed(4)}%`,
      bullish: !isNeutral ? isBullish : false,
    });
    if (isBullish) bullishCount++;
  } else {
    factors.push({ name: 'Funding/OI', value: 'N/D', bullish: false });
  }

  // Fattore 7: Pressione order book
  if (bookData && !bookData.error && bookData.bids && bookData.asks) {
    const bidVolume = bookData.bids
      .slice(0, 10)
      .reduce((sum, [p, q]) => sum + parseFloat(p) * parseFloat(q), 0);
    const askVolume = bookData.asks
      .slice(0, 10)
      .reduce((sum, [p, q]) => sum + parseFloat(p) * parseFloat(q), 0);
    const total = bidVolume + askVolume;
    const bidRatio = total > 0 ? (bidVolume / total) * 100 : 50;
    const isBullish = bidRatio > 55;
    factors.push({
      name: 'Order Book',
      value: `Bid ${bidRatio.toFixed(0)}%`,
      bullish: isBullish,
    });
    if (isBullish) bullishCount++;
  } else {
    factors.push({ name: 'Order Book', value: 'N/D', bullish: false });
  }

  // Determina segnale finale
  const strength = bullishCount;
  let signal = 'NEUTRAL';
  if (bullishCount >= 5) signal = 'LONG';
  else if (bullishCount <= 2) signal = 'SHORT';

  return { signal, strength, factors };
}

/**
 * Calcola la strategia range per mercati laterali
 * @param {Array} candles
 * @param {Object} indicators
 * @returns {Object|null}
 */
export function calcRangeStrategy(candles, indicators) {
  if (!candles || candles.length < 20 || !indicators?.bollinger) return null;

  const lookback = 20;
  const recent = candles.slice(-lookback);
  const lastIdx = candles.length - 1;
  const price = candles[lastIdx].close;

  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));
  const bolUpper = indicators.bollinger.upper[lastIdx];
  const bolLower = indicators.bollinger.lower[lastIdx];

  if (isNaN(bolUpper) || isNaN(bolLower)) return null;

  const resistance = (recentHigh + bolUpper) / 2;
  const support = (recentLow + bolLower) / 2;
  const middle = (resistance + support) / 2;
  const rangeWidth = resistance - support;

  if (rangeWidth <= 0) return null;

  const positionInRange = (price - support) / rangeWidth;

  let signal = 'NO_TRADE';
  let stopLoss = null;
  let takeProfit = null;
  let reason = 'Prezzo a metà range — attendi i bordi';

  if (positionInRange < 0.25) {
    signal = 'LONG';
    stopLoss = support - rangeWidth * 0.05;
    takeProfit = middle;
    reason = 'Prezzo vicino al supporto del range';
  } else if (positionInRange > 0.75) {
    signal = 'SHORT';
    stopLoss = resistance + rangeWidth * 0.05;
    takeProfit = middle;
    reason = 'Prezzo vicino alla resistenza del range';
  }

  const risk = stopLoss ? Math.abs(price - stopLoss) : 0;
  const reward = takeProfit ? Math.abs(takeProfit - price) : 0;
  const rr = risk > 0 ? reward / risk : 0;
  const targetPct = takeProfit ? (Math.abs(takeProfit - price) / price) * 100 : 0;

  return { signal, entry: price, stopLoss, takeProfit, support, resistance, middle, positionInRange, reason, rr, targetPct };
}

/**
 * Calcola le zone di liquidazione approssimative
 * @param {number} price - Prezzo corrente
 * @param {number|null} openInterest - Open interest (per stima)
 * @param {number[]} leverages - Array di leve da considerare
 * @returns {Array<{level: number, leverage: number, type: string}>}
 */
export function calcLiquidationZones(price, openInterest = null, leverages = [5, 10, 25]) {
  if (!price || price <= 0) return [];

  const zones = [];

  leverages.forEach((lev) => {
    // Liquidazione long: prezzo scende del (1/lev - maintenance) ≈ 1/lev * 0.85
    const longLiqPrice = price * (1 - (1 / lev) * 0.85);
    // Liquidazione short: prezzo sale del (1/lev - maintenance) ≈ 1/lev * 0.85
    const shortLiqPrice = price * (1 + (1 / lev) * 0.85);

    zones.push({
      level: parseFloat(longLiqPrice.toFixed(2)),
      leverage: lev,
      type: 'long_liq',
    });
    zones.push({
      level: parseFloat(shortLiqPrice.toFixed(2)),
      leverage: lev,
      type: 'short_liq',
    });
  });

  return zones.sort((a, b) => a.level - b.level);
}
