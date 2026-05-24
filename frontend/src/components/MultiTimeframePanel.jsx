import React, { useState, useEffect, useRef } from 'react';
import { fetchCandles } from '../services/api.js';
import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from '../utils/indicators.js';
import { calcCompositeSignal } from '../utils/signals.js';

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];
const REFRESH_MS = 60000; // 60 secondi

function computeIndicators(candleData) {
  if (!candleData || candleData.length < 30) return null;
  const closes = candleData.map((c) => c.close);
  return {
    ema12: calcEMA(closes, 12),
    ema26: calcEMA(closes, 26),
    sma50: calcSMA(closes, 50),
    rsi: calcRSI(closes, 14),
    macd: calcMACD(closes, 12, 26, 9),
    bollinger: calcBollinger(closes, 20, 2),
    atr: calcATR(candleData, 14),
    adx: calcADX(candleData, 14),
  };
}

export default function MultiTimeframePanel({ selectedPair, currentSignal, currentInterval }) {
  const [tfSignals, setTfSignals] = useState({});
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchAll = async () => {
    const results = {};
    await Promise.allSettled(
      TIMEFRAMES.map(async (tf) => {
        try {
          const candles = await fetchCandles(selectedPair, tf, 200);
          if (!candles || candles.length < 30) {
            results[tf] = { signal: 'N/D', strength: 0 };
            return;
          }
          const indicators = computeIndicators(candles);
          if (!indicators) {
            results[tf] = { signal: 'N/D', strength: 0 };
            return;
          }
          const { signal, strength } = calcCompositeSignal(candles, indicators, null, null);
          results[tf] = { signal, strength };
        } catch (e) {
          results[tf] = { signal: 'N/D', strength: 0 };
        }
      })
    );
    setTfSignals(results);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setTfSignals({});
    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calcola concordanza
  const signals = TIMEFRAMES.map((tf) => tfSignals[tf]?.signal).filter(
    (s) => s && s !== 'N/D'
  );
  const longCount = signals.filter((s) => s === 'LONG').length;
  const shortCount = signals.filter((s) => s === 'SHORT').length;
  const neutralCount = signals.filter((s) => s === 'NEUTRAL').length;

  let concordanceMsg = '';
  let concordanceColor = 'var(--text-secondary)';

  if (longCount >= 3) {
    concordanceMsg = `Concordanza RIALZISTA su ${longCount}/4 timeframe`;
    concordanceColor = 'var(--accent-green)';
  } else if (shortCount >= 3) {
    concordanceMsg = `Concordanza RIBASSISTA su ${shortCount}/4 timeframe`;
    concordanceColor = 'var(--accent-red)';
  } else if (longCount === 2) {
    concordanceMsg = 'Segnale rialzista debole (solo 2/4 timeframe)';
    concordanceColor = 'var(--accent-orange)';
  } else if (shortCount === 2) {
    concordanceMsg = 'Segnale ribassista debole (solo 2/4 timeframe)';
    concordanceColor = 'var(--accent-orange)';
  } else {
    concordanceMsg = 'Timeframe discordanti — NON FARE TRADING';
    concordanceColor = 'var(--accent-red)';
  }

  const signalColor = (s) => {
    if (s === 'LONG') return 'var(--accent-green)';
    if (s === 'SHORT') return 'var(--accent-red)';
    return 'var(--text-muted)';
  };

  const signalIcon = (s) => {
    if (s === 'LONG') return '▲';
    if (s === 'SHORT') return '▼';
    if (s === 'N/D') return '?';
    return '–';
  };

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 12 }}>
        Multi-Timeframe ({selectedPair})
      </h3>

      {loading ? (
        <div className="no-data">Caricamento segnali multi-timeframe...</div>
      ) : (
        <>
          <div className="mtf-grid">
            {TIMEFRAMES.map((tf) => {
              const info = tfSignals[tf] || { signal: 'N/D', strength: 0 };
              const isCurrent = tf === currentInterval;
              return (
                <div
                  key={tf}
                  className="mtf-cell"
                  style={isCurrent ? { borderColor: 'var(--accent-blue)' } : {}}
                >
                  <div className="mtf-tf">
                    {tf}
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--accent-blue)',
                          marginLeft: 3,
                        }}
                      >
                        ●
                      </span>
                    )}
                  </div>
                  <div
                    className="mtf-signal"
                    style={{ color: signalColor(info.signal) }}
                  >
                    {signalIcon(info.signal)} {info.signal}
                  </div>
                  <div className="mtf-strength">
                    {info.signal !== 'N/D'
                      ? `${info.strength}/7 fattori`
                      : 'dati n/d'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mtf-agree" style={{ color: concordanceColor }}>
            {concordanceMsg}
          </div>
        </>
      )}

      <div className="panel-disclaimer">
        Aggiornamento ogni 60s. Il pallino blu indica il timeframe corrente selezionato.
      </div>
    </div>
  );
}
