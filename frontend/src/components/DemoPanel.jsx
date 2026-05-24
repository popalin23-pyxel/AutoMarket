import React, { useState, useEffect } from 'react';

const INITIAL_PORTFOLIO = 10000; // € virtuali

export default function DemoPanel({ demoMode, onDemoModeChange, compositeSignal, ticker, selectedPair }) {
  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('demo_portfolio');
    return saved ? JSON.parse(saved) : {
      cash: INITIAL_PORTFOLIO,
      positions: [],
      pnl: 0,
      totalTrades: 0,
      winCount: 0,
    };
  });

  const currentPrice = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : null;
  const signal = compositeSignal?.signal;

  useEffect(() => {
    localStorage.setItem('demo_portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  // Aggiorna P&L posizioni aperte
  useEffect(() => {
    if (!currentPrice || portfolio.positions.length === 0) return;
    // Solo aggiorna il valore corrente, non chiude posizioni
  }, [currentPrice]);

  const openPosition = (type) => {
    if (!currentPrice) return;
    const size = portfolio.cash * 0.1; // 10% del cash per posizione demo
    if (size < 10) return;
    const qty = size / currentPrice;

    const newPosition = {
      id: Date.now(),
      pair: selectedPair,
      type,
      entryPrice: currentPrice,
      qty,
      size,
      signal: signal || 'MANUAL',
      openedAt: new Date().toISOString(),
    };

    setPortfolio((prev) => ({
      ...prev,
      cash: prev.cash - size,
      positions: [...prev.positions, newPosition],
    }));
  };

  const closePosition = (posId) => {
    if (!currentPrice) return;
    setPortfolio((prev) => {
      const pos = prev.positions.find((p) => p.id === posId);
      if (!pos) return prev;

      let pnl;
      if (pos.type === 'LONG') {
        pnl = (currentPrice - pos.entryPrice) * pos.qty;
      } else {
        pnl = (pos.entryPrice - currentPrice) * pos.qty;
      }

      const closedCash = pos.size + pnl;
      const isWin = pnl > 0;

      return {
        ...prev,
        cash: prev.cash + closedCash,
        positions: prev.positions.filter((p) => p.id !== posId),
        pnl: prev.pnl + pnl,
        totalTrades: prev.totalTrades + 1,
        winCount: prev.winCount + (isWin ? 1 : 0),
      };
    });
  };

  const resetPortfolio = () => {
    if (!window.confirm('Azzerare il portafoglio demo?')) return;
    setPortfolio({
      cash: INITIAL_PORTFOLIO,
      positions: [],
      pnl: 0,
      totalTrades: 0,
      winCount: 0,
    });
  };

  // Calcola P&L corrente sulle posizioni aperte
  const openPnl = currentPrice
    ? portfolio.positions.reduce((sum, pos) => {
        const pnl =
          pos.type === 'LONG'
            ? (currentPrice - pos.entryPrice) * pos.qty
            : (pos.entryPrice - currentPrice) * pos.qty;
        return sum + pnl;
      }, 0)
    : 0;

  const totalEquity = portfolio.cash + portfolio.positions.reduce((s, p) => s + p.size, 0) + openPnl;
  const totalReturn = ((totalEquity - INITIAL_PORTFOLIO) / INITIAL_PORTFOLIO) * 100;
  const winRate =
    portfolio.totalTrades > 0 ? (portfolio.winCount / portfolio.totalTrades) * 100 : null;

  const fmt2 = (n) =>
    n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="card demo-card">
      <div className="card-header">
        <h3 className="card-title">
          {demoMode ? '🎮 Modalità Demo' : '⚠️ Modalità Reale'}
        </h3>
        <button
          className={`demo-toggle-btn ${demoMode ? 'demo-active' : 'real-mode'}`}
          onClick={() => onDemoModeChange(!demoMode)}
        >
          {demoMode ? 'DEMO' : 'REALE'}
        </button>
      </div>

      {!demoMode && (
        <div className="real-mode-warning">
          ⚠️ Modalità reale selezionata. I segnali qui visualizzati NON devono essere usati
          direttamente per operazioni reali senza adeguata formazione.
        </div>
      )}

      {demoMode && (
        <>
          <div className="demo-portfolio">
            <div className="portfolio-stat">
              <span className="pstat-label">Equity totale</span>
              <span className={`pstat-value font-mono ${totalReturn >= 0 ? 'accent-green' : 'accent-red'}`}>
                €{fmt2(totalEquity)}
              </span>
            </div>
            <div className="portfolio-stat">
              <span className="pstat-label">Cash disponibile</span>
              <span className="pstat-value font-mono">€{fmt2(portfolio.cash)}</span>
            </div>
            <div className="portfolio-stat">
              <span className="pstat-label">P&L realizzato</span>
              <span className={`pstat-value font-mono ${portfolio.pnl >= 0 ? 'accent-green' : 'accent-red'}`}>
                {portfolio.pnl >= 0 ? '+' : ''}€{fmt2(portfolio.pnl)}
              </span>
            </div>
            <div className="portfolio-stat">
              <span className="pstat-label">P&L non realiz.</span>
              <span className={`pstat-value font-mono ${openPnl >= 0 ? 'accent-green' : 'accent-red'}`}>
                {openPnl >= 0 ? '+' : ''}€{fmt2(openPnl)}
              </span>
            </div>
            <div className="portfolio-stat">
              <span className="pstat-label">Rendimento totale</span>
              <span className={`pstat-value font-mono ${totalReturn >= 0 ? 'accent-green' : 'accent-red'}`}>
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
              </span>
            </div>
            <div className="portfolio-stat">
              <span className="pstat-label">Trade effettuati</span>
              <span className="pstat-value font-mono">{portfolio.totalTrades}</span>
            </div>
            {winRate != null && (
              <div className="portfolio-stat">
                <span className="pstat-label">Win rate demo</span>
                <span className={`pstat-value font-mono ${winRate >= 50 ? 'accent-green' : 'accent-red'}`}>
                  {winRate.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Suggerimento trades demo */}
          <div className={`demo-progress ${portfolio.totalTrades >= 30 ? 'demo-ready' : ''}`}>
            {portfolio.totalTrades < 30 ? (
              <>
                <div className="demo-progress-bar">
                  <div
                    className="demo-progress-fill"
                    style={{ width: `${(portfolio.totalTrades / 30) * 100}%` }}
                  />
                </div>
                <p className="demo-advice">
                  📊 Fai ≥30 trade in demo prima del reale — completati {portfolio.totalTrades}/30
                </p>
              </>
            ) : (
              <p className="demo-ready-msg accent-green">
                ✅ Hai completato 30+ trade demo! Puoi valutare la transizione al reale.
              </p>
            )}
          </div>

          {/* Azioni rapide */}
          <div className="demo-actions">
            <button
              className="demo-action-btn long-btn"
              onClick={() => openPosition('LONG')}
              disabled={!currentPrice || portfolio.cash < 10}
            >
              ▲ LONG Demo
            </button>
            <button
              className="demo-action-btn short-btn"
              onClick={() => openPosition('SHORT')}
              disabled={!currentPrice || portfolio.cash < 10}
            >
              ▼ SHORT Demo
            </button>
          </div>

          {/* Posizioni aperte */}
          {portfolio.positions.length > 0 && (
            <div className="demo-positions">
              <p className="positions-title">Posizioni aperte</p>
              {portfolio.positions.map((pos) => {
                const currentPnl = currentPrice
                  ? pos.type === 'LONG'
                    ? (currentPrice - pos.entryPrice) * pos.qty
                    : (pos.entryPrice - currentPrice) * pos.qty
                  : 0;
                const pnlPct = (currentPnl / pos.size) * 100;

                return (
                  <div key={pos.id} className="demo-position-row">
                    <span className={`pos-type ${pos.type === 'LONG' ? 'accent-green' : 'accent-red'}`}>
                      {pos.type}
                    </span>
                    <span className="pos-pair font-mono">{pos.pair}</span>
                    <span className="pos-entry font-mono">
                      @${pos.entryPrice.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                    </span>
                    <span className={`pos-pnl font-mono ${currentPnl >= 0 ? 'accent-green' : 'accent-red'}`}>
                      {currentPnl >= 0 ? '+' : ''}€{fmt2(currentPnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                    <button
                      className="pos-close-btn"
                      onClick={() => closePosition(pos.id)}
                    >
                      Chiudi
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button className="reset-btn" onClick={resetPortfolio}>
            Azzera portafoglio demo
          </button>
        </>
      )}
    </div>
  );
}
