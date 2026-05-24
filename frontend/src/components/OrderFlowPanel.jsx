import React from 'react';

export default function OrderFlowPanel({ bookData, ticker }) {
  if (!bookData || bookData.error) {
    return (
      <div className="card orderflow-card">
        <h3 className="card-title">Order Flow</h3>
        <div className="no-data">Dati order book non disponibili</div>
      </div>
    );
  }

  const currentPrice = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : 0;
  const { bids = [], asks = [] } = bookData;

  // Calcola bid/ask pressure entro ±2% del prezzo
  let bidPressure = 0;
  let askPressure = 0;

  if (currentPrice > 0) {
    const priceRange = currentPrice * 0.02;
    bids.forEach(([p, q]) => {
      const price = parseFloat(p);
      if (price >= currentPrice - priceRange) {
        bidPressure += price * parseFloat(q);
      }
    });
    asks.forEach(([p, q]) => {
      const price = parseFloat(p);
      if (price <= currentPrice + priceRange) {
        askPressure += price * parseFloat(q);
      }
    });
  } else {
    bidPressure = bids
      .slice(0, 10)
      .reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
    askPressure = asks
      .slice(0, 10)
      .reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
  }

  const totalPressure = bidPressure + askPressure;
  const bidPct = totalPressure > 0 ? (bidPressure / totalPressure) * 100 : 50;
  const askPct = 100 - bidPct;

  const pressureLabel =
    bidPct > 60
      ? 'Forte domanda (bullish)'
      : bidPct > 52
      ? 'Leggera prevalenza bid'
      : bidPct < 40
      ? 'Forte offerta (bearish)'
      : bidPct < 48
      ? 'Leggera prevalenza ask'
      : 'Equilibrio bid/ask';

  const pressureColor =
    bidPct > 55 ? '#00ff88' : bidPct < 45 ? '#ff4466' : '#ffaa00';

  // Top 5 bid/ask walls
  const topBids = bids
    .slice(0, 5)
    .map(([p, q]) => ({ price: parseFloat(p), size: parseFloat(q) }));

  const topAsks = asks
    .slice(0, 5)
    .map(([p, q]) => ({ price: parseFloat(p), size: parseFloat(q) }));

  const maxBidSize = Math.max(...topBids.map((b) => b.size), 1);
  const maxAskSize = Math.max(...topAsks.map((a) => a.size), 1);

  const formatPrice = (p) =>
    p.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatSize = (s) =>
    s >= 1000 ? `${(s / 1000).toFixed(2)}K` : s.toFixed(3);

  return (
    <div className="card orderflow-card">
      <h3 className="card-title">Order Flow & Libro Ordini</h3>

      {/* Barra pressione */}
      <div className="pressure-section">
        <p className="pressure-title">Pressione Bid/Ask (±2% prezzo)</p>
        <div className="pressure-bar">
          <div
            className="pressure-bid"
            style={{ width: `${bidPct}%`, background: '#00ff88' }}
          >
            {bidPct > 20 && <span className="pressure-label-inner">BID {bidPct.toFixed(0)}%</span>}
          </div>
          <div
            className="pressure-ask"
            style={{ width: `${askPct}%`, background: '#ff4466' }}
          >
            {askPct > 20 && <span className="pressure-label-inner">ASK {askPct.toFixed(0)}%</span>}
          </div>
        </div>
        <p className="pressure-status" style={{ color: pressureColor }}>
          {pressureLabel}
        </p>
      </div>

      {/* Mura bid/ask */}
      <div className="book-walls">
        <div className="walls-column">
          <p className="walls-title accent-green">Top 5 Bid (supporti)</p>
          {topBids.map((b, i) => (
            <div key={i} className="wall-row">
              <span className="wall-price font-mono accent-green">${formatPrice(b.price)}</span>
              <div className="wall-bar-wrapper">
                <div
                  className="wall-bar"
                  style={{
                    width: `${(b.size / maxBidSize) * 100}%`,
                    background: '#00ff8844',
                  }}
                />
              </div>
              <span className="wall-size font-mono">{formatSize(b.size)}</span>
            </div>
          ))}
        </div>

        <div className="walls-divider">
          {currentPrice > 0 && (
            <span className="walls-current-price font-mono">
              ${formatPrice(currentPrice)}
            </span>
          )}
        </div>

        <div className="walls-column">
          <p className="walls-title accent-red">Top 5 Ask (resistenze)</p>
          {topAsks.map((a, i) => (
            <div key={i} className="wall-row">
              <span className="wall-price font-mono accent-red">${formatPrice(a.price)}</span>
              <div className="wall-bar-wrapper">
                <div
                  className="wall-bar"
                  style={{
                    width: `${(a.size / maxAskSize) * 100}%`,
                    background: '#ff446644',
                  }}
                />
              </div>
              <span className="wall-size font-mono">{formatSize(a.size)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-disclaimer">
        Il libro ordini cambia rapidamente — snapshot istantaneo
      </div>
    </div>
  );
}
