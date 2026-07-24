import React from 'react';

const fmtPrice = (n) =>
  n != null && !isNaN(n)
    ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '—';

// Calcola stop loss e take profit in base allo stato PRISMA
// Range → usa Bollinger (stop fuori dalla banda, target alla mediana)
// Trend → R:R 1:2  (1.5×ATR stop, 3×ATR target)
// Impulso → R:R 1:2.5 (1.5×ATR stop, 3.75×ATR target)
function calcLevels(signal, prismaState, price, atr, indicators) {
  if (!price || !atr || signal === 'NEUTRAL') return {};

  const bbL = indicators?.bollinger?.lower?.at(-1);
  const bbU = indicators?.bollinger?.upper?.at(-1);
  const bbM = indicators?.bollinger?.middle?.at(-1);

  if (prismaState === 'range' && bbL && bbU && bbM) {
    const stopPad = atr * 0.3; // piccolo margine oltre la banda
    if (signal === 'LONG') {
      return {
        stopLoss:   bbL - stopPad,
        takeProfit: bbM,
        rrLabel: 'R:R variabile (range)',
      };
    } else {
      return {
        stopLoss:   bbU + stopPad,
        takeProfit: bbM,
        rrLabel: 'R:R variabile (range)',
      };
    }
  }

  const stopDist = 1.5 * atr;
  const tpMult   = prismaState === 'impulse' ? 3.75 : 3;
  const rr       = (tpMult / 1.5).toFixed(1);

  return {
    stopLoss:   signal === 'LONG' ? price - stopDist : price + stopDist,
    takeProfit: signal === 'LONG' ? price + tpMult * atr : price - tpMult * atr,
    rrLabel: `R:R 1 : ${rr}`,
  };
}

export default function VerdictCard({ signal, indicators, prismaData, candles }) {
  if (!signal || !indicators || !prismaData) return (
    <div className="card">
      <h3 className="section-title">Verdetto ARIA</h3>
      <div className="empty-state">Calcolo in corso...</div>
    </div>
  );

  const price = candles?.[candles.length - 1]?.close;
  const atr   = indicators.atr?.at(-1);

  const { stopLoss, takeProfit, rrLabel } = calcLevels(
    signal.signal, prismaData.state, price, atr, indicators
  );

  // Verdetto finale con filtro PRISMA
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
      ? 'Compra al supporto — target la banda mediana di Bollinger'
      : prismaData.state === 'impulse'
      ? 'Impulso rialzista forte — condizioni ottimali (R:R 1:2.5)'
      : 'Trend rialzista confermato — segui il trend (R:R 1:2)';
  } else {
    verdict = 'VAI SHORT';
    verdictColor = '#ff4466';
    verdictIcon = '🔴';
    desc = prismaData.state === 'range'
      ? 'Vendi alla resistenza — target la banda mediana di Bollinger'
      : prismaData.state === 'impulse'
      ? 'Impulso ribassista forte — condizioni ottimali (R:R 1:2.5)'
      : 'Trend ribassista confermato — segui il trend (R:R 1:2)';
  }

  return (
    <div className="card verdict-card">
      <h3 className="section-title">Verdetto ARIA</h3>

      {/* Verdetto principale */}
      <div className="verdict-main" style={{ borderColor: verdictColor + '40', background: verdictColor + '0c' }}>
        <div className="verdict-icon">{verdictIcon}</div>
        <div className="verdict-text" style={{ color: verdictColor }}>{verdict}</div>
        <div className="verdict-desc">{desc}</div>
      </div>

      {/* Livelli operativi adattivi */}
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
            <span className="vl-label">Rischio/Rendimento</span>
            <span className="vl-value font-mono">{rrLabel}</span>
          </div>
        </div>
      )}

      {/* Barra forza segnale */}
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
