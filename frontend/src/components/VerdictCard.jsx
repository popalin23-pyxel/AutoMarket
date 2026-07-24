import React from 'react';

const fmtPrice = (n) =>
  n != null && !isNaN(n)
    ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '—';

export default function VerdictCard({ signal, indicators, prismaData, candles }) {
  if (!signal || !indicators || !prismaData) return (
    <div className="card">
      <h3 className="section-title">Verdetto ARIA</h3>
      <div className="empty-state">Calcolo in corso...</div>
    </div>
  );

  const price = candles?.[candles.length - 1]?.close;
  const atr = indicators.atr?.[indicators.atr.length - 1];

  // Calcola livelli operativi
  let stopLoss, takeProfit;
  if (price && atr && signal.signal !== 'NEUTRAL') {
    stopLoss   = signal.signal === 'LONG' ? price - 2 * atr : price + 2 * atr;
    takeProfit = signal.signal === 'LONG' ? price + 3 * atr : price - 3 * atr;
  }

  // Verdetto finale con logica PRISMA
  let verdict, verdictColor, verdictIcon, desc;
  if (prismaData.state === 'noise') {
    verdict = 'NON FARE TRADING';
    verdictColor = '#ff4466';
    verdictIcon = '🔴';
    desc = 'Il mercato è troppo caotico — PRISMA ha bloccato il segnale';
  } else if (signal.signal === 'NEUTRAL' || signal.strength < 30) {
    verdict = 'ATTENDI';
    verdictColor = '#ffaa00';
    verdictIcon = '🟡';
    desc = 'Segnali contrastanti — aspetta una direzione più chiara';
  } else if (signal.signal === 'LONG') {
    verdict = 'VAI LONG';
    verdictColor = '#00ff88';
    verdictIcon = '🟢';
    desc = prismaData.state === 'range'
      ? 'Compra ai supporti — mercato laterale, punta alla mediana'
      : prismaData.state === 'impulse'
      ? 'Impulso rialzista forte — condizioni ottimali per entrare'
      : 'Trend rialzista confermato — segui il trend';
  } else {
    verdict = 'VAI SHORT';
    verdictColor = '#ff4466';
    verdictIcon = '🔴';
    desc = prismaData.state === 'range'
      ? 'Vendi alle resistenze — mercato laterale, punta alla mediana'
      : prismaData.state === 'impulse'
      ? 'Impulso ribassista forte — condizioni ottimali per entrare'
      : 'Trend ribassista confermato — segui il trend';
  }

  return (
    <div className="card verdict-card">
      <h3 className="section-title">Verdetto ARIA</h3>

      {/* Verdict principale — grande e chiaro */}
      <div className="verdict-main" style={{ borderColor: verdictColor + '40', background: verdictColor + '0c' }}>
        <div className="verdict-icon">{verdictIcon}</div>
        <div className="verdict-text" style={{ color: verdictColor }}>{verdict}</div>
        <div className="verdict-desc">{desc}</div>
      </div>

      {/* Livelli operativi */}
      {stopLoss && takeProfit && (
        <div className="verdict-levels">
          <div className="vl-item">
            <span className="vl-label">Ingresso</span>
            <span className="vl-value font-mono">${fmtPrice(price)}</span>
          </div>
          <div className="vl-item">
            <span className="vl-label">Stop Loss</span>
            <span className="vl-value font-mono red">${fmtPrice(stopLoss)}</span>
          </div>
          <div className="vl-item">
            <span className="vl-label">Take Profit</span>
            <span className="vl-value font-mono green">${fmtPrice(takeProfit)}</span>
          </div>
          <div className="vl-item">
            <span className="vl-label">R:R</span>
            <span className="vl-value font-mono">1 : 1.5</span>
          </div>
        </div>
      )}

      {/* Forza segnale */}
      <div className="verdict-strength">
        <span className="vs-label">Forza segnale</span>
        <div className="vs-bar-track">
          <div className="vs-bar-fill" style={{ width: `${signal.strength}%`, background: verdictColor }} />
        </div>
        <span className="vs-pct font-mono" style={{ color: verdictColor }}>{signal.strength}%</span>
      </div>
    </div>
  );
}
