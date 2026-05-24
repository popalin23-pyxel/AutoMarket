import React, { useState } from 'react';

export default function RiskPanel({
  capital,
  leverage,
  entryPrice,
  onCapitalChange,
  onLeverageChange,
  onEntryPriceChange,
  ticker,
  indicators,
  candles,
}) {
  const [dailyLossBlocked, setDailyLossBlocked] = useState(false);

  const price = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : null;
  const entry = entryPrice || price;
  const lastIdx = candles ? candles.length - 1 : -1;
  const atrValue = indicators?.atr && lastIdx >= 0 ? indicators.atr[lastIdx] : null;

  // Calcoli rischio
  const stopLoss = entry && atrValue ? entry - 1.5 * atrValue : null;
  const stopLossPct = stopLoss && entry ? ((entry - stopLoss) / entry) * 100 : null;
  const liqPrice = entry && leverage > 0 ? entry * (1 - (1 / leverage) * 0.85) : null;
  const liqDistPct = liqPrice && entry ? ((entry - liqPrice) / entry) * 100 : null;

  const notional = capital && leverage ? capital * leverage : null;
  const quantity = notional && entry ? notional / entry : null;
  const lossAtStop = capital && stopLossPct ? (capital * stopLossPct) / 100 : null;

  const liqWarning = liqDistPct != null && liqDistPct < 15;

  const fmt2 = (n) =>
    n != null
      ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'N/D';
  const fmtPct = (n) => (n != null ? `${n.toFixed(2)}%` : 'N/D');

  return (
    <div className="card risk-card">
      <div className="card-header">
        <h3 className="card-title">Calcolatore Rischio</h3>
        {liqWarning && (
          <span className="liq-warning-badge">⚠️ Liquidazione vicina!</span>
        )}
      </div>

      <div className="risk-inputs">
        <div className="risk-input-group">
          <label className="risk-label">Capitale (€)</label>
          <input
            type="number"
            className="risk-input font-mono"
            value={capital}
            min={1}
            max={1000000}
            step={100}
            onChange={(e) => onCapitalChange(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="risk-input-group">
          <label className="risk-label">Leva (1–20x)</label>
          <div className="leverage-control">
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={leverage}
              onChange={(e) => onLeverageChange(parseInt(e.target.value))}
              className="leverage-slider"
            />
            <span className="leverage-display font-mono">{leverage}x</span>
          </div>
        </div>

        <div className="risk-input-group">
          <label className="risk-label">Prezzo entrata ($)</label>
          <input
            type="number"
            className="risk-input font-mono"
            value={entryPrice || price || ''}
            placeholder={price ? `Mercato: ${fmt2(price)}` : 'Inserire prezzo'}
            step={0.01}
            onChange={(e) => onEntryPriceChange(parseFloat(e.target.value) || null)}
          />
        </div>
      </div>

      <div className="risk-results">
        <div className="risk-result-item">
          <span className="rresult-label">Nozionale</span>
          <span className="rresult-value font-mono accent-blue">
            €{fmt2(notional)}
          </span>
        </div>

        <div className="risk-result-item">
          <span className="rresult-label">Quantità stimata</span>
          <span className="rresult-value font-mono">
            {quantity != null ? quantity.toFixed(6) : 'N/D'}
          </span>
        </div>

        <div className="risk-result-item">
          <span className="rresult-label">Stop loss (1.5×ATR)</span>
          <span className="rresult-value font-mono accent-red">
            {stopLoss != null ? `$${fmt2(stopLoss)}` : atrValue == null ? 'ATR non disp.' : 'N/D'}
          </span>
          {stopLossPct != null && (
            <span className="rresult-sub">-{fmtPct(stopLossPct)} dall'entrata</span>
          )}
        </div>

        <div className="risk-result-item">
          <span className="rresult-label">Perdita allo stop</span>
          <span className="rresult-value font-mono accent-red">
            {lossAtStop != null ? `€${fmt2(lossAtStop)}` : 'N/D'}
          </span>
        </div>

        <div className={`risk-result-item ${liqWarning ? 'liq-danger' : ''}`}>
          <span className="rresult-label">Prezzo liquidazione ({leverage}x)</span>
          <span className="rresult-value font-mono accent-red">
            {liqPrice != null ? `$${fmt2(liqPrice)}` : 'N/D'}
          </span>
          {liqDistPct != null && (
            <span className={`rresult-sub ${liqWarning ? 'accent-red' : ''}`}>
              -{fmtPct(liqDistPct)} dal prezzo attuale
              {liqWarning ? ' ⚠️ ZONA PERICOLOSA' : ''}
            </span>
          )}
        </div>
      </div>

      {liqWarning && (
        <div className="liq-danger-alert">
          ⚠️ La liquidazione si trova entro il 15% dal prezzo attuale.
          Ridurre la leva o aumentare il margine.
        </div>
      )}

      <div className="daily-loss-block">
        <div className="daily-loss-header">
          <span className="daily-loss-title">Blocco perdita giornaliera</span>
          <button
            className={`toggle-btn ${dailyLossBlocked ? 'toggle-active' : ''}`}
            onClick={() => setDailyLossBlocked(!dailyLossBlocked)}
          >
            {dailyLossBlocked ? 'ATTIVO' : 'DISATTIVATO'}
          </button>
        </div>
        {dailyLossBlocked && (
          <div className="daily-loss-alert">
            🚫 Stop giornaliero attivato — non aprire nuove posizioni oggi.
            Limite: {capital ? `€${fmt2(capital * 0.05)} (5% del capitale)` : 'N/D'}
          </div>
        )}
      </div>

      <div className="panel-disclaimer">
        ⚠️ Calcoli approssimativi. I prezzi di liquidazione variano per exchange e margine effettivo.
      </div>
    </div>
  );
}
