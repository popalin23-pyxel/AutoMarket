import React from 'react';

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return 'N/D';
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function calcVerdict({ regime, compositeSignal, backtestResult, rangeStrategy, indicators, candles, capital, leverage }) {
  const regimeType = regime?.regime || 'lateral';
  const isLateral = regimeType === 'lateral';
  const signal = compositeSignal?.signal || 'NEUTRAL';
  const strength = compositeSignal?.strength ?? 0;

  // --- Filtri di sicurezza ---
  const noEdge = !backtestResult || backtestResult.noEdge || backtestResult.expectancy <= 0 || backtestResult.profitFactor < 1;
  const contradictory = strength === 3 || strength === 4; // né LONG (≥5) né SHORT (≤2)

  const lastIdx = candles ? candles.length - 1 : -1;
  const atr = indicators?.atr && lastIdx >= 0 ? indicators.atr[lastIdx] : null;
  const price = candles && lastIdx >= 0 ? candles[lastIdx].close : null;

  // --- Strategia RANGE (regime laterale) ---
  if (isLateral && rangeStrategy && rangeStrategy.signal !== 'NO_TRADE') {
    const rr = rangeStrategy.rr;
    if (rr < 1) {
      return { verdict: 'NO_TRADE', strategy: 'Range', reason: 'R:R < 1 nel range — rischio superiore al guadagno atteso', entry: null };
    }
    const entry = rangeStrategy.entry;
    const stopLoss = rangeStrategy.stopLoss;
    const takeProfit = rangeStrategy.takeProfit;
    const notional = capital * leverage;
    const qty = price > 0 ? notional / price : 0;
    const riskEur = stopLoss ? Math.abs(entry - stopLoss) * qty : null;
    const gainEur = takeProfit ? Math.abs(takeProfit - entry) * qty : null;
    return {
      verdict: rangeStrategy.signal,
      strategy: 'Range',
      reason: rangeStrategy.reason,
      entry, stopLoss, takeProfit,
      leverage,
      sizeEur: (capital * (backtestResult?.kellyFraction || 1.5) / 100),
      gainEur, riskEur, rr,
      targetPct: rangeStrategy.targetPct,
      expectancy: backtestResult?.expectancy ?? null,
      n: null,
    };
  }

  if (isLateral && rangeStrategy?.signal === 'NO_TRADE') {
    return { verdict: 'NO_TRADE', strategy: 'Range', reason: rangeStrategy.reason || 'Prezzo a metà range', entry: null };
  }

  // --- Strategia TREND ---
  if (noEdge) {
    return { verdict: 'NO_TRADE', strategy: 'Trend', reason: 'Nessun vantaggio statistico (expectancy ≤ 0)', entry: null };
  }
  if (contradictory) {
    return { verdict: 'NO_TRADE', strategy: 'Trend', reason: `Segnali contraddittori (${strength}/7 fattori)`, entry: null };
  }
  if (signal === 'NEUTRAL') {
    return { verdict: 'NO_TRADE', strategy: 'Trend', reason: 'Segnale neutro — nessuna direzione chiara', entry: null };
  }

  // Calcola parametri trade trend
  if (!price || !atr) {
    return { verdict: 'NO_TRADE', strategy: 'Trend', reason: 'Dati insufficienti per calcolare i livelli', entry: null };
  }

  const entry = price;
  const stopLoss = signal === 'LONG' ? entry - 1.5 * atr : entry + 1.5 * atr;
  const risk = Math.abs(entry - stopLoss);
  const takeProfit = signal === 'LONG' ? entry + risk * 1.5 : entry - risk * 1.5;
  const rr = 1.5;

  const notional = capital * leverage;
  const qty = entry > 0 ? notional / entry : 0;
  const riskEur = risk * qty;
  const gainEur = Math.abs(takeProfit - entry) * qty;
  const targetPct = (Math.abs(takeProfit - entry) / entry) * 100;

  const kellyPct = backtestResult?.kellyFraction || 1.5;
  const sizeEur = capital * kellyPct / 100;

  return {
    verdict: signal,
    strategy: 'Trend',
    reason: `${regimeType === 'trend_up' ? 'Trend rialzista' : 'Trend ribassista'} · ${strength}/7 fattori`,
    entry, stopLoss, takeProfit, leverage,
    sizeEur, gainEur, riskEur, rr, targetPct,
    expectancy: backtestResult?.expectancy ?? null,
    n: null,
  };
}

export default function VerdictCard({ regime, compositeSignal, backtestResult, rangeStrategy, indicators, candles, capital, leverage, frequencies }) {
  const v = calcVerdict({ regime, compositeSignal, backtestResult, rangeStrategy, indicators, candles, capital, leverage });

  const isNoTrade = v.verdict === 'NO_TRADE';
  const isLong = v.verdict === 'LONG';
  const isShort = v.verdict === 'SHORT';

  const n = frequencies?.n ?? null;
  const expStr = v.expectancy != null ? `Expectancy: ${v.expectancy > 0 ? '+' : ''}${v.expectancy}R` : '';
  const nStr = n ? `N=${n} casi storici` : '';

  return (
    <div className={`verdict-card ${isNoTrade ? 'verdict-no-trade' : isLong ? 'verdict-long' : 'verdict-short'}`}>
      <div className="verdict-strategy-badge">{v.strategy}</div>

      <div className="verdict-status">
        <span className="verdict-emoji">{isNoTrade ? '🟥' : isLong ? '🟩' : '🟥'}</span>
        <span className="verdict-label">
          {isNoTrade ? 'NON FARE TRADING' : isLong ? 'VAI LONG' : 'VAI SHORT'}
        </span>
      </div>

      <p className="verdict-reason">{v.reason}</p>

      {!isNoTrade && v.entry != null && (
        <div className="verdict-params">
          <div className="verdict-row">
            <span className="vp-label">Ingresso</span>
            <span className="vp-value font-mono">${fmt(v.entry)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Stop loss</span>
            <span className="vp-value font-mono accent-red">${fmt(v.stopLoss)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Take profit</span>
            <span className="vp-value font-mono accent-green">${fmt(v.takeProfit)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Target</span>
            <span className="vp-value font-mono">+{fmt(v.targetPct)}%</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Leva suggerita</span>
            <span className="vp-value font-mono">{v.leverage}×</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Size (€)</span>
            <span className="vp-value font-mono accent-green">€{fmt(v.sizeEur)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Guadagno atteso</span>
            <span className="vp-value font-mono accent-green">+€{fmt(v.gainEur)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">Perdita massima</span>
            <span className="vp-value font-mono accent-red">-€{fmt(v.riskEur)}</span>
          </div>
          <div className="verdict-row">
            <span className="vp-label">R:R</span>
            <span className={`vp-value font-mono ${v.rr >= 1.5 ? 'accent-green' : 'accent-orange'}`}>{fmt(v.rr, 1)}:1</span>
          </div>
        </div>
      )}

      {(expStr || nStr) && (
        <p className="verdict-meta">{[expStr, nStr].filter(Boolean).join(' · ')}</p>
      )}

      <p className="verdict-disclaimer">⚠️ Statistica passata, non previsione. Non è consulenza finanziaria.</p>
    </div>
  );
}

export { calcVerdict };
