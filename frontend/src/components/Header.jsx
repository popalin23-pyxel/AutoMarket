import React from 'react';

export default function Header({ globalData }) {
  const dominance = globalData?.data?.market_cap_percentage?.btc;
  const totalMcap = globalData?.data?.total_market_cap?.usd;

  const formatTrillion = (n) => {
    if (!n) return 'N/D';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <header className="app-header">
      <div className="header-main">
        <div className="header-brand">
          <span className="header-logo">◈</span>
          <div className="header-titles">
            <h1 className="header-name">AutoMarket Pro</h1>
            <p className="header-subtitle">Dashboard crypto avanzata</p>
          </div>
        </div>
        <div className="header-stats">
          {dominance != null && (
            <div className="header-stat">
              <span className="stat-label">BTC Dom.</span>
              <span className="stat-value accent-orange">{dominance.toFixed(1)}%</span>
            </div>
          )}
          {totalMcap && (
            <div className="header-stat">
              <span className="stat-label">Market Cap</span>
              <span className="stat-value accent-blue">{formatTrillion(totalMcap)}</span>
            </div>
          )}
          <div className="header-stat">
            <span className="status-dot status-live"></span>
            <span className="stat-label">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
