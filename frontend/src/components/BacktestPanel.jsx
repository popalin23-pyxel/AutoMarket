import React from 'react';

export default function BacktestPanel({ backtestResult }) {
  if (!backtestResult) {
    return (
      <div className="card backtest-card">
        <h3 className="card-title">Backtest Storico</h3>
        <div className="no-data">Calcolo in corso...</div>
      </div>
    );
  }

  const {
    winRate,
    profitFactor,
    expectancy,
    maxDrawdown,
    trades,
    kellyFraction,
    noEdge,
  } = backtestResult;

  return (
    <div className="card backtest-card">
      <h3 className="card-title">Backtest Storico</h3>

      {noEdge && (
        <div className="backtest-no-edge">
          ⚠️ QUESTA STRATEGIA NON HA VANTAGGIO: NON OPERARE
        </div>
      )}

      <div className="backtest-grid">
        <div className="backtest-stat">
          <span className="bstat-label">Win Rate</span>
          <span
            className={`bstat-value font-mono ${
              winRate >= 55 ? 'accent-green' : winRate >= 45 ? 'accent-orange' : 'accent-red'
            }`}
          >
            {winRate}%
          </span>
        </div>

        <div className="backtest-stat">
          <span className="bstat-label">Profit Factor</span>
          <span
            className={`bstat-value font-mono ${
              profitFactor >= 1.5
                ? 'accent-green'
                : profitFactor >= 1.0
                ? 'accent-orange'
                : 'accent-red'
            }`}
          >
            {profitFactor}
          </span>
        </div>

        <div className="backtest-stat">
          <span className="bstat-label">Expectancy</span>
          <span
            className={`bstat-value font-mono ${
              expectancy > 0 ? 'accent-green' : 'accent-red'
            }`}
          >
            {expectancy > 0 ? '+' : ''}{expectancy} R
          </span>
        </div>

        <div className="backtest-stat">
          <span className="bstat-label">Max Drawdown</span>
          <span
            className={`bstat-value font-mono ${
              maxDrawdown < 10 ? 'accent-green' : maxDrawdown < 20 ? 'accent-orange' : 'accent-red'
            }`}
          >
            -{maxDrawdown}%
          </span>
        </div>

        <div className="backtest-stat">
          <span className="bstat-label">N° Trade</span>
          <span className="bstat-value font-mono">{trades}</span>
        </div>

        <div className="backtest-stat">
          <span className="bstat-label">Size Kelly/4</span>
          <span
            className={`bstat-value font-mono ${
              noEdge ? 'accent-red' : kellyFraction > 0 ? 'accent-green' : 'accent-orange'
            }`}
          >
            {noEdge ? '0%' : `${kellyFraction}%`}
          </span>
        </div>
      </div>

      {!noEdge && kellyFraction > 0 && (
        <div className="kelly-info">
          <span className="kelly-label">Dimensione posizione suggerita:</span>
          <span className="kelly-value accent-green font-mono">{kellyFraction}% del capitale</span>
          <span className="kelly-sub">(Formula Kelly divisa per 4 — uso conservativo)</span>
        </div>
      )}

      <div className="backtest-chart">
        <p className="bchart-title">Distribuzione esiti (solo storico)</p>
        <div className="bchart-bar-row">
          <span className="bchart-label accent-green">Vincenti</span>
          <div className="bchart-track">
            <div
              className="bchart-fill"
              style={{ width: `${winRate}%`, background: '#00ff88' }}
            />
          </div>
          <span className="bchart-pct font-mono accent-green">{winRate}%</span>
        </div>
        <div className="bchart-bar-row">
          <span className="bchart-label accent-red">Perdenti</span>
          <div className="bchart-track">
            <div
              className="bchart-fill"
              style={{ width: `${100 - winRate}%`, background: '#ff4466' }}
            />
          </div>
          <span className="bchart-pct font-mono accent-red">{(100 - winRate).toFixed(1)}%</span>
        </div>
      </div>

      <div className="panel-disclaimer">
        ⚠️ Performance passate non garantiscono risultati futuri. Backtest su dati storici soggetto a overfitting.
      </div>
    </div>
  );
}
