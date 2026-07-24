import React from 'react';

const fmt = (n, d = 2) => n != null && !isNaN(n) ? Number(n).toFixed(d) : '—';

export default function SignalCard({ signal, indicators, candles }) {
  if (!signal || !indicators) return (
    <div className="card">
      <h3 className="section-title">Indicatori</h3>
      <div className="empty-state">Caricamento...</div>
    </div>
  );

  const last = arr => arr?.[arr.length - 1];
  const price = candles?.[candles.length - 1]?.close;

  const rsiVal = last(indicators.rsi);
  const adxVal = last(indicators.adx);
  const macdH  = last(indicators.macd?.histogram);
  const e12    = last(indicators.ema12);
  const e26    = last(indicators.ema26);
  const atr    = last(indicators.atr);
  const bbL    = last(indicators.bollinger?.lower);
  const bbU    = last(indicators.bollinger?.upper);

  const signalColor = signal.signal === 'LONG' ? '#00ff88' : signal.signal === 'SHORT' ? '#ff4466' : '#ffaa00';

  const rows = [
    {
      label: 'RSI (14)',
      value: fmt(rsiVal, 1),
      note: rsiVal > 70 ? 'ipercomprato ⚠' : rsiVal < 30 ? 'ipervenduto ⚠' : 'neutro',
      color: rsiVal > 70 ? '#ff4466' : rsiVal < 30 ? '#00ff88' : '#888aaa',
    },
    {
      label: 'ADX (14)',
      value: fmt(adxVal, 1),
      note: adxVal > 25 ? 'trend forte' : 'laterale',
      color: adxVal > 25 ? '#4488ff' : '#888aaa',
    },
    {
      label: 'MACD Histo',
      value: fmt(macdH, 5),
      note: macdH > 0 ? 'rialzista' : 'ribassista',
      color: macdH > 0 ? '#00ff88' : '#ff4466',
    },
    {
      label: 'EMA 12/26',
      value: e12 && e26 ? (e12 > e26 ? 'EMA12 sopra' : 'EMA12 sotto') : '—',
      note: e12 && price ? `prezzo ${price > e26 ? 'sopra' : 'sotto'} EMA26` : '',
      color: e12 > e26 ? '#00ff88' : '#ff4466',
    },
    {
      label: 'Bollinger',
      value: price && bbL && bbU ? `${((price - bbL) / (bbU - bbL) * 100).toFixed(0)}% banda` : '—',
      note: price < bbL ? '⚠ sotto banda' : price > bbU ? '⚠ sopra banda' : 'dentro la banda',
      color: price < bbL || price > bbU ? '#ffaa00' : '#888aaa',
    },
    {
      label: 'ATR (14)',
      value: atr ? `$${atr.toLocaleString('it-IT', { maximumFractionDigits: 4 })}` : '—',
      note: 'volatilità media per candela',
      color: '#888aaa',
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="section-title">Indicatori Tecnici</h3>
        <span className="sig-badge" style={{ color: signalColor, borderColor: signalColor + '55', background: signalColor + '11' }}>
          {signal.signal}
        </span>
      </div>

      <div className="indicators-table">
        {rows.map((r, i) => (
          <div key={i} className="ind-row">
            <span className="ind-label">{r.label}</span>
            <span className="ind-value font-mono" style={{ color: r.color }}>{r.value}</span>
            <span className="ind-note">{r.note}</span>
          </div>
        ))}
      </div>

      {signal.reasons?.length > 0 && (
        <div className="signal-reasons">
          <p className="sub-title">Perché questo segnale</p>
          {signal.reasons.slice(0, 4).map((r, i) => (
            <div key={i} className="reason-row">
              <span className="reason-dot" style={{ background: signalColor }} />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
