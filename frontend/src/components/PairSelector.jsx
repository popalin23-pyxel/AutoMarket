import React from 'react';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
const INTERVALS = [
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
];

export default function PairSelector({ selectedPair, selectedInterval, onPairChange, onIntervalChange, ticker }) {
  const price = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : null;
  const change24h = ticker?.priceChangePercent ? parseFloat(ticker.priceChangePercent) : null;

  return (
    <div className="card pair-selector-card">
      <div className="pair-selector-row">
        <div className="selector-group">
          <label className="selector-label">Coppia</label>
          <select
            className="selector-select"
            value={selectedPair}
            onChange={(e) => onPairChange(e.target.value)}
          >
            {PAIRS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="selector-group">
          <label className="selector-label">Timeframe</label>
          <div className="interval-buttons">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                className={`interval-btn${selectedInterval === iv.value ? ' active' : ''}`}
                onClick={() => onIntervalChange(iv.value)}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

        {price != null && (
          <div className="selector-price-info">
            <span className="price-label">{selectedPair}</span>
            <span className="price-value">
              ${price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {change24h != null && (
              <span className={`price-change ${change24h >= 0 ? 'positive' : 'negative'}`}>
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            )}
            <span className="price-source">Binance 24h</span>
          </div>
        )}
      </div>
    </div>
  );
}
