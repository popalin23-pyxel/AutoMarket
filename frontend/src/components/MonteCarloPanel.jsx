import React, { useState, useMemo } from 'react';

/**
 * Simulazione Monte Carlo pura (non dipende da moduli esterni)
 */
function runMonteCarlo(winRate, avgRR, sizeRatio, simCount = 3000, tradeCount = 100) {
  const finalCapitals = [];
  const maxDrawdowns = [];

  for (let s = 0; s < simCount; s++) {
    let capital = 1.0;
    let peak = 1.0;
    let maxDD = 0;

    for (let t = 0; t < tradeCount; t++) {
      const isWin = Math.random() < winRate;
      const pnl = isWin ? sizeRatio * avgRR : -sizeRatio;
      capital *= 1 + pnl;
      if (capital > peak) peak = capital;
      const dd = (peak - capital) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    finalCapitals.push(capital);
    maxDrawdowns.push(maxDD);
  }

  finalCapitals.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => b - a); // decrescente

  const worstDD5 = maxDrawdowns[Math.floor(simCount * 0.05)];
  const ruinCount = finalCapitals.filter((c) => c < 0.1).length;
  const ruinProbability = ruinCount / simCount;
  const medianFinal = finalCapitals[Math.floor(simCount / 2)];

  return { worstDD5, ruinProbability, medianFinal };
}

export default function MonteCarloPanel({ backtestResult, capital }) {
  const [open, setOpen] = useState(false);

  const mcResult = useMemo(() => {
    if (!backtestResult || backtestResult.noEdge) return null;

    const winRate = (backtestResult.winRate || 0) / 100;
    // avgRR stimato da profitFactor / winRate
    const pf = backtestResult.profitFactor || 1;
    const wr = winRate || 0.5;
    // avgRR = pf * (1 - wr) / wr
    const avgRR = wr > 0 ? (pf * (1 - wr)) / wr : 1.5;
    // Kelly/4 come fraction
    const kellyPct = backtestResult.kellyFraction || 1.5;
    const sizeRatio = Math.min(kellyPct / 100, 0.05); // cap al 5%

    if (winRate <= 0 || winRate >= 1) return null;

    return runMonteCarlo(winRate, avgRR, sizeRatio, 3000, 100);
  }, [backtestResult]);

  if (!backtestResult) return null;

  const pct = (v) => (v * 100).toFixed(1) + '%';
  const capFmt = (v) => (v >= 0 ? '+' : '') + ((v - 1) * 100).toFixed(1) + '%';

  return (
    <div className="card">
      <div className="mc-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="mc-toggle-title">Simulazione Monte Carlo (100 trade)</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <>
          {backtestResult.noEdge || !mcResult ? (
            <div className="no-data">
              Strategia senza vantaggio — simulazione non disponibile.
            </div>
          ) : (
            <>
              <div className="mc-result-grid">
                <div className="mc-item">
                  <div className="mc-item-label">Drawdown peggiore (5%)</div>
                  <div
                    className="mc-item-value"
                    style={{
                      color:
                        mcResult.worstDD5 > 0.3
                          ? 'var(--accent-red)'
                          : mcResult.worstDD5 > 0.15
                          ? 'var(--accent-orange)'
                          : 'var(--accent-green)',
                    }}
                  >
                    -{pct(mcResult.worstDD5)}
                  </div>
                </div>

                <div className="mc-item">
                  <div className="mc-item-label">Prob. rovina (&lt;10%)</div>
                  <div
                    className="mc-item-value"
                    style={{
                      color:
                        mcResult.ruinProbability > 0.1
                          ? 'var(--accent-red)'
                          : mcResult.ruinProbability > 0.05
                          ? 'var(--accent-orange)'
                          : 'var(--accent-green)',
                    }}
                  >
                    {pct(mcResult.ruinProbability)}
                  </div>
                </div>

                <div className="mc-item">
                  <div className="mc-item-label">Capitale mediano finale</div>
                  <div
                    className="mc-item-value"
                    style={{
                      color:
                        mcResult.medianFinal >= 1
                          ? 'var(--accent-green)'
                          : 'var(--accent-red)',
                    }}
                  >
                    {capFmt(mcResult.medianFinal)}
                  </div>
                </div>
              </div>

              {mcResult.ruinProbability > 0.05 && (
                <div className="mc-ruin-alert">
                  ⚠️ Probabilità di rovina superiore al 5% — ridurre la dimensione della posizione
                </div>
              )}

              <div className="panel-disclaimer">
                Monte Carlo su {3000} simulazioni di 100 trade. Basato su win rate e kelly storico.
                Non predice il futuro.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
