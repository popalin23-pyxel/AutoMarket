import React, { useState, useEffect } from 'react';

export default function JournalPanel({ compositeSignal, regime, selectedPair, verdictStrategy }) {
  const [trades, setTrades] = useState(() => {
    try {
      const saved = localStorage.getItem('trading_journal');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newTrade, setNewTrade] = useState({
    date: new Date().toISOString().slice(0, 10),
    pair: selectedPair || 'BTCUSDT',
    signal: compositeSignal?.signal || 'NEUTRAL',
    regime: regime?.regime || 'lateral',
    strategy: verdictStrategy || 'Trend',
    result: '',
    notes: '',
  });

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    localStorage.setItem('trading_journal', JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    setNewTrade((prev) => ({
      ...prev,
      pair: selectedPair || prev.pair,
      signal: compositeSignal?.signal || prev.signal,
      regime: regime?.regime || prev.regime,
      strategy: verdictStrategy || prev.strategy,
    }));
  }, [selectedPair, compositeSignal, regime, verdictStrategy]);

  const addTrade = () => {
    if (!newTrade.result) return;
    const trade = { ...newTrade, id: Date.now(), createdAt: new Date().toISOString() };
    setTrades((prev) => [trade, ...prev]);
    setNewTrade((prev) => ({ ...prev, result: '', notes: '' }));
    setShowForm(false);
  };

  const removeTrade = (id) => {
    if (!window.confirm('Rimuovere questo trade dal diario?')) return;
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const calcStats = () => {
    if (trades.length < 30) return null;

    const wins = trades.filter((t) => t.result === 'win');
    const losses = trades.filter((t) => t.result === 'loss');

    // Statistiche per strategia Trend vs Range
    const byStrategy = { Trend: { wins: 0, total: 0 }, Range: { wins: 0, total: 0 } };
    trades.forEach((t) => {
      const s = t.strategy || 'Trend';
      if (!byStrategy[s]) byStrategy[s] = { wins: 0, total: 0 };
      byStrategy[s].total++;
      if (t.result === 'win') byStrategy[s].wins++;
    });

    // Miglior/peggior setup (segnale + regime)
    const setups = {};
    trades.forEach((t) => {
      const key = `${t.signal}_${t.regime}`;
      if (!setups[key]) setups[key] = { wins: 0, total: 0 };
      setups[key].total++;
      if (t.result === 'win') setups[key].wins++;
    });
    const setupEntries = Object.entries(setups)
      .map(([key, v]) => ({ key, winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0, total: v.total }))
      .sort((a, b) => b.winRate - a.winRate);

    return {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / trades.length) * 100,
      byStrategy,
      bestSetup: setupEntries[0],
      worstSetup: setupEntries[setupEntries.length - 1],
    };
  };

  const stats = calcStats();

  const REGIME_LABELS = {
    trend_up: 'Trend ↑',
    trend_down: 'Trend ↓',
    lateral: 'Laterale',
    high_volatility: 'Alta Vol.',
  };

  return (
    <div className="card journal-card">
      <div className="card-header">
        <h3 className="card-title">Diario di Trading</h3>
        <button className="add-trade-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annulla' : '+ Aggiungi'}
        </button>
      </div>

      {showForm && (
        <div className="journal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={newTrade.date}
                onChange={(e) => setNewTrade((p) => ({ ...p, date: e.target.value }))}
                className="form-input" />
            </div>
            <div className="form-group">
              <label>Coppia</label>
              <select value={newTrade.pair}
                onChange={(e) => setNewTrade((p) => ({ ...p, pair: e.target.value }))}
                className="form-input">
                {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Strategia</label>
              <select value={newTrade.strategy}
                onChange={(e) => setNewTrade((p) => ({ ...p, strategy: e.target.value }))}
                className="form-input">
                <option value="Trend">Trend</option>
                <option value="Range">Range</option>
              </select>
            </div>
            <div className="form-group">
              <label>Segnale</label>
              <select value={newTrade.signal}
                onChange={(e) => setNewTrade((p) => ({ ...p, signal: e.target.value }))}
                className="form-input">
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </select>
            </div>
            <div className="form-group">
              <label>Regime</label>
              <select value={newTrade.regime}
                onChange={(e) => setNewTrade((p) => ({ ...p, regime: e.target.value }))}
                className="form-input">
                <option value="trend_up">Trend ↑</option>
                <option value="trend_down">Trend ↓</option>
                <option value="lateral">Laterale</option>
                <option value="high_volatility">Alta Vol.</option>
              </select>
            </div>
            <div className="form-group">
              <label>Esito</label>
              <select value={newTrade.result}
                onChange={(e) => setNewTrade((p) => ({ ...p, result: e.target.value }))}
                className="form-input">
                <option value="">Seleziona...</option>
                <option value="win">✅ Win</option>
                <option value="loss">❌ Loss</option>
                <option value="breakeven">➡️ Break-even</option>
              </select>
            </div>
          </div>
          <div className="form-group full-width">
            <label>Note</label>
            <textarea value={newTrade.notes}
              onChange={(e) => setNewTrade((p) => ({ ...p, notes: e.target.value }))}
              className="form-input form-textarea"
              placeholder="Note sul trade (opzionale)..." rows={2} />
          </div>
          <button className="save-trade-btn" onClick={addTrade} disabled={!newTrade.result}>
            Salva nel diario
          </button>
        </div>
      )}

      {stats && (
        <div className="journal-stats">
          <h4 className="jstat-title">Statistiche personali ({stats.total} trade)</h4>
          <div className="jstat-grid">
            <div className="jstat-item">
              <span className="jstat-label">Win rate totale</span>
              <span className={`jstat-value font-mono ${stats.winRate >= 50 ? 'accent-green' : 'accent-red'}`}>
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
            <div className="jstat-item">
              <span className="jstat-label">Vittorie / Perdite</span>
              <span className="jstat-value font-mono">
                <span className="accent-green">{stats.wins}</span>
                {' / '}
                <span className="accent-red">{stats.losses}</span>
              </span>
            </div>
          </div>

          {/* Trend vs Range */}
          <div className="strategy-comparison">
            {['Trend', 'Range'].map((s) => {
              const sd = stats.byStrategy[s];
              if (!sd || sd.total === 0) return null;
              const wr = (sd.wins / sd.total) * 100;
              return (
                <div key={s} className="strategy-stat-item">
                  <span className="strategy-stat-name">{s}</span>
                  <span className={`strategy-stat-wr font-mono ${wr >= 50 ? 'accent-green' : 'accent-red'}`}>
                    {wr.toFixed(0)}% WR
                  </span>
                  <span className="strategy-stat-n font-mono">{sd.total} trade</span>
                </div>
              );
            })}
          </div>

          {stats.bestSetup && stats.bestSetup !== stats.worstSetup && (
            <div className="best-worst-setup">
              <div className="setup-item setup-best">
                <span className="setup-icon">🏆</span>
                <span className="setup-label">Miglior setup:</span>
                <span className="setup-key font-mono">{stats.bestSetup.key}</span>
                <span className="setup-wr accent-green">
                  {stats.bestSetup.winRate.toFixed(0)}% WR ({stats.bestSetup.total})
                </span>
              </div>
              <div className="setup-item setup-worst">
                <span className="setup-icon">⚠️</span>
                <span className="setup-label">Setup da evitare:</span>
                <span className="setup-key font-mono">{stats.worstSetup.key}</span>
                <span className="setup-wr accent-red">
                  {stats.worstSetup.winRate.toFixed(0)}% WR ({stats.worstSetup.total})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {trades.length < 30 && trades.length > 0 && (
        <div className="journal-progress">
          <div className="journal-progress-bar">
            <div className="journal-progress-fill" style={{ width: `${(trades.length / 30) * 100}%` }} />
          </div>
          <p className="journal-progress-text">
            {trades.length}/30 trade per statistiche personali
          </p>
        </div>
      )}

      {trades.length === 0 ? (
        <div className="no-data">Nessun trade registrato. Aggiungi il tuo primo trade!</div>
      ) : (
        <div className="journal-table-wrapper">
          <table className="journal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Coppia</th>
                <th>Strat.</th>
                <th>Segnale</th>
                <th>Regime</th>
                <th>Esito</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 50).map((trade) => (
                <tr key={trade.id} className={`journal-row result-${trade.result}`}>
                  <td className="font-mono">{trade.date}</td>
                  <td className="font-mono">{trade.pair}</td>
                  <td>
                    <span className={`strategy-badge strat-${(trade.strategy || 'Trend').toLowerCase()}`}>
                      {trade.strategy || 'Trend'}
                    </span>
                  </td>
                  <td>
                    <span className={`trade-signal-badge ${
                      trade.signal === 'LONG' ? 'badge-long' : trade.signal === 'SHORT' ? 'badge-short' : 'badge-neutral'
                    }`}>{trade.signal}</span>
                  </td>
                  <td>{REGIME_LABELS[trade.regime] || trade.regime}</td>
                  <td>
                    <span className={`result-badge result-${trade.result}`}>
                      {trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '➡️'} {trade.result}
                    </span>
                  </td>
                  <td className="notes-cell">{trade.notes || '—'}</td>
                  <td>
                    <button className="remove-trade-btn" onClick={() => removeTrade(trade.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trades.length > 50 && (
            <p className="table-overflow-note">Mostrati 50 trade più recenti su {trades.length} totali</p>
          )}
        </div>
      )}
    </div>
  );
}
