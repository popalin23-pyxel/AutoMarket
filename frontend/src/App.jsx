import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from './utils/indicators.js';
import { calcCompositeSignal } from './utils/signals.js';
import { calcPrisma } from './utils/prisma.js';
import { runRetroactiveAnalysis } from './utils/verdictLog.js';
import { fetchCandles, fetchTicker } from './services/api.js';

import PrismaPanel from './components/PrismaPanel.jsx';
import VerdictCard from './components/VerdictCard.jsx';
import SignalCard from './components/SignalCard.jsx';
import OraclePanel from './components/OraclePanel.jsx';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT'];
const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];
const REFRESH_MS = 30000;

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [ticker, setTicker] = useState(null);
  const [candles, setCandles] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [signal, setSignal] = useState(null);
  const [prismaData, setPrismaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('verdetto');

  const timerRef = useRef(null);

  const computeIndicators = useCallback((candleData) => {
    if (!candleData || candleData.length < 30) return null;
    const closes = candleData.map(c => c.close);
    return {
      ema12: calcEMA(closes, 12), ema26: calcEMA(closes, 26), sma50: calcSMA(closes, 50),
      rsi: calcRSI(closes, 14), macd: calcMACD(closes, 12, 26, 9),
      bollinger: calcBollinger(closes, 20, 2), atr: calcATR(candleData, 14), adx: calcADX(candleData, 14),
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setError(null);
    try {
      const [candlesRes, tickerRes] = await Promise.allSettled([
        fetchCandles(symbol, selectedInterval, 500),
        fetchTicker(symbol),
      ]);

      const newCandles = candlesRes.status === 'fulfilled' ? candlesRes.value : null;
      const newTicker = tickerRes.status === 'fulfilled' ? tickerRes.value : null;

      setTicker(newTicker);

      if (newCandles?.length > 0) {
        setCandles(newCandles);
        const ind = computeIndicators(newCandles);
        setIndicators(ind);
        if (ind) {
          setSignal(calcCompositeSignal(newCandles, ind));
          const closes = newCandles.map(c => c.close);
          setPrismaData(calcPrisma(closes, newCandles));
          setTimeout(() => {
            runRetroactiveAnalysis(newCandles, symbol, selectedInterval).catch(console.warn);
          }, 500);
        }
      } else if (!newCandles) {
        setError('Impossibile caricare i dati. Verifica la connessione.');
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError('Errore di connessione.');
    } finally {
      setLoading(false);
    }
  }, [symbol, selectedInterval, computeIndicators]);

  useEffect(() => {
    setLoading(true);
    setCandles(null); setIndicators(null); setSignal(null); setPrismaData(null);
    fetchAllData();
    timerRef.current = setInterval(fetchAllData, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [symbol, selectedInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtTime = d => d
    ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const TABS = [
    { id: 'verdetto', label: 'Verdetto' },
    { id: 'segnali', label: 'Segnali' },
    { id: 'oracle', label: 'Oracle' },
  ];

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-name">AutoMarket</span>
            <span className="header-badge">ARIA</span>
          </div>
          {ticker && (
            <div className="header-price">
              <span className="hp-price font-mono">
                ${ticker.price.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
              </span>
              <span className={`hp-change font-mono ${ticker.change >= 0 ? 'green' : 'red'}`}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        <div className="selectors-row">
          <div className="selector-group">
            <span className="selector-label">Coppia</span>
            <select className="selector-select" value={symbol} onChange={e => setSymbol(e.target.value)}>
              {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="selector-group">
            <span className="selector-label">Timeframe</span>
            <div className="interval-buttons">
              {INTERVALS.map(iv => (
                <button
                  key={iv}
                  className={`interval-btn ${selectedInterval === iv ? 'active' : ''}`}
                  onClick={() => setSelectedInterval(iv)}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>
          {lastUpdate && (
            <span className="last-update">Aggiornato {fmtTime(lastUpdate)} · auto 30s</span>
          )}
        </div>

        <nav className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading && (
          <div className="app-loading">
            <div className="loading-spinner" />
            <span>Caricamento dati di mercato...</span>
          </div>
        )}

        {error && !loading && (
          <div className="card error-card">
            <p className="red">⚠️ {error}</p>
          </div>
        )}

        {!loading && activeTab === 'verdetto' && (
          <>
            <PrismaPanel prismaData={prismaData} />
            <VerdictCard signal={signal} indicators={indicators} prismaData={prismaData} candles={candles} />
          </>
        )}

        {!loading && activeTab === 'segnali' && (
          <SignalCard signal={signal} indicators={indicators} candles={candles} />
        )}

        {!loading && activeTab === 'oracle' && (
          <OraclePanel selectedPair={symbol} selectedInterval={selectedInterval} />
        )}
      </div>

      <footer className="app-footer">
        ⚠️ Solo scopo educativo. Non è consulenza finanziaria.
      </footer>
    </div>
  );
}
