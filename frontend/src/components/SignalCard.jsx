import React from 'react';

const REGIME_LABELS = {
  trend_up: { label: 'Trend Rialzista', cls: 'regime-up' },
  trend_down: { label: 'Trend Ribassista', cls: 'regime-down' },
  lateral: { label: 'Laterale', cls: 'regime-lateral' },
  high_volatility: { label: 'Alta Volatilità', cls: 'regime-volatile' },
};

export default function SignalCard({
  selectedPair,
  ticker,
  compositeSignal,
  regime,
  frequencies,
  fundingData,
  oiData,
  bookData,
  backtestResult,
  capital,
  leverage,
  entryPrice,
  indicators,
  candles,
}) {
  const price = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : null;

  const regimeInfo = REGIME_LABELS[regime?.regime] || REGIME_LABELS.lateral;

  const signal = compositeSignal?.signal || 'NEUTRAL';
  const strength = compositeSignal?.strength ?? 0;
  const factors = compositeSignal?.factors || [];

  const signalClass =
    signal === 'LONG' ? 'signal-long' : signal === 'SHORT' ? 'signal-short' : 'signal-neutral';

  // Funding
  const fundingRate = fundingData
    ? parseFloat(fundingData.lastFundingRate || fundingData.fundingRate || 0)
    : null;
  const fundingStatus =
    fundingRate == null
      ? 'N/D'
      : Math.abs(fundingRate) < 0.0001
      ? 'Neutro'
      : fundingRate > 0.0003
      ? 'Long sovraffollati'
      : fundingRate < -0.0003
      ? 'Short sovraffollati'
      : fundingRate > 0
      ? 'Lievemente long'
      : 'Lievemente short';

  // OI
  const oiValue = oiData?.openInterest ? parseFloat(oiData.openInterest) : null;

  // Book
  let bidPct = null;
  if (bookData?.bids && bookData?.asks) {
    const bidVol = bookData.bids
      .slice(0, 10)
      .reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
    const askVol = bookData.asks
      .slice(0, 10)
      .reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
    const tot = bidVol + askVol;
    bidPct = tot > 0 ? (bidVol / tot) * 100 : null;
  }

  // Rischio / stop
  const lastIdx = candles ? candles.length - 1 : -1;
  const atrValue =
    indicators?.atr && lastIdx >= 0 ? indicators.atr[lastIdx] : null;
  const entry = entryPrice || price;
  const stopLoss = entry && atrValue ? entry - 1.5 * atrValue : null;
  const liqPrice =
    entry && leverage > 0
      ? entry * (1 - (1 / leverage) * 0.85)
      : null;

  // Frequenze
  const freqData = frequencies?.frequencies || [];
  const freqN = frequencies?.n ?? 0;
  const bestFreq = freqData.find((f) => f.target === 5);

  return (
    <div className={`card signal-card ${signalClass}-card`}>
      <div className="signal-header">
        <div className="signal-pair-info">
          <span className="signal-pair">{selectedPair}</span>
          {price != null && (
            <span className="signal-price">
              ${price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          )}
          <span className="signal-source">Binance</span>
        </div>
        <div className="signal-badge-group">
          <span className={`signal-badge ${signalClass}`}>{signal}</span>
          <span className="signal-strength">{strength}/7 fattori concordi</span>
        </div>
      </div>

      <div className="signal-regime">
        <span className={`regime-badge ${regimeInfo.cls}`}>{regimeInfo.label}</span>
        {regime?.description && (
          <span className="regime-desc">{regime.description}</span>
        )}
      </div>

      {freqN > 0 && bestFreq && (
        <div className="signal-freq-summary">
          <span className="freq-icon">📊</span>
          <span>
            N={freqN} casi → +5% in {frequencies?.frequencies?.[0]?.upFreq ?? 0}% delle volte
            ({frequencies?.frequencies?.[0]?.target}% target)
          </span>
        </div>
      )}

      <div className="signal-details-grid">
        {/* Funding */}
        <div className="signal-detail-item">
          <span className="detail-label">Funding</span>
          <span
            className={`detail-value ${
              fundingRate == null
                ? ''
                : fundingRate < -0.0001
                ? 'accent-green'
                : fundingRate > 0.0003
                ? 'accent-red'
                : 'accent-orange'
            }`}
          >
            {fundingRate != null
              ? `${(fundingRate * 100).toFixed(4)}%`
              : 'N/D'}
          </span>
          <span className="detail-sub">{fundingStatus}</span>
        </div>

        {/* Order flow */}
        <div className="signal-detail-item">
          <span className="detail-label">Pressione book</span>
          <span
            className={`detail-value ${
              bidPct == null ? '' : bidPct > 55 ? 'accent-green' : bidPct < 45 ? 'accent-red' : ''
            }`}
          >
            {bidPct != null ? `Bid ${bidPct.toFixed(0)}%` : 'N/D'}
          </span>
          <span className="detail-sub">
            {bidPct == null
              ? ''
              : bidPct > 55
              ? 'Domanda prevalente'
              : bidPct < 45
              ? 'Offerta prevalente'
              : 'Equilibrato'}
          </span>
        </div>

        {/* Backtest */}
        <div className="signal-detail-item">
          <span className="detail-label">Backtest</span>
          <span className="detail-value font-mono">
            {backtestResult
              ? `WR ${backtestResult.winRate}% | PF ${backtestResult.profitFactor}`
              : 'N/D'}
          </span>
          <span className="detail-sub">
            {backtestResult
              ? `Expect. ${backtestResult.expectancy > 0 ? '+' : ''}${backtestResult.expectancy} R`
              : ''}
          </span>
        </div>

        {/* Kelly size */}
        <div className="signal-detail-item">
          <span className="detail-label">Size suggerita</span>
          <span
            className={`detail-value ${
              backtestResult?.noEdge ? 'accent-red' : 'accent-green'
            }`}
          >
            {backtestResult?.noEdge
              ? 'NON OPERARE'
              : backtestResult
              ? `${backtestResult.kellyFraction}% capitale`
              : 'N/D'}
          </span>
          <span className="detail-sub">Kelly / 4</span>
        </div>

        {/* Stop loss */}
        <div className="signal-detail-item">
          <span className="detail-label">Stop loss</span>
          <span className="detail-value accent-red font-mono">
            {stopLoss != null
              ? `$${stopLoss.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
              : 'N/D'}
          </span>
          <span className="detail-sub">1.5 × ATR</span>
        </div>

        {/* Liquidazione */}
        <div className="signal-detail-item">
          <span className="detail-label">Liq. stimata</span>
          <span className="detail-value accent-red font-mono">
            {liqPrice != null
              ? `$${liqPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
              : 'N/D'}
          </span>
          <span className="detail-sub">{leverage}x leva</span>
        </div>
      </div>

      {/* Fattori */}
      {factors.length > 0 && (
        <div className="signal-factors">
          <p className="factors-title">Fattori analizzati</p>
          <div className="factors-grid">
            {factors.map((f, i) => (
              <div key={i} className={`factor-item ${f.bullish ? 'bullish' : 'bearish'}`}>
                <span className="factor-icon">{f.bullish ? '▲' : '▼'}</span>
                <span className="factor-name">{f.name}</span>
                <span className="factor-value font-mono">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="signal-disclaimer">
        ⚠️ Statistica passata, non previsione.
      </div>
    </div>
  );
}
