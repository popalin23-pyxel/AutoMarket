import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from './utils/indicators.js';
import { detectRegime, calcCompositeSignal, calcLiquidationZones, calcRangeStrategy } from './utils/signals.js';
import { runBacktest, calcHistoricalFrequencies, runWalkForwardBacktest } from './utils/backtest.js';
import { logVerdict, verifyPendingVerdicts, runRetroactiveAnalysis } from './utils/verdictLog.js';
import { calcPrisma } from './utils/prisma.js';
import {
  fetchCandles, fetchTicker, fetchBook, fetchFunding,
  fetchOpenInterest, fetchOIHistory, fetchGlobal,
} from './services/api.js';

import Header from './components/Header.jsx';
import WarningBanner from './components/WarningBanner.jsx';
import PairSelector from './components/PairSelector.jsx';
import SignalCard from './components/SignalCard.jsx';
import CandleChart from './components/CandleChart.jsx';
import IndicatorsPanel from './components/IndicatorsPanel.jsx';
import FundingPanel from './components/FundingPanel.jsx';
import OrderFlowPanel from './components/OrderFlowPanel.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import FrequenciesPanel from './components/FrequenciesPanel.jsx';
import RiskPanel from './components/RiskPanel.jsx';
import DemoPanel from './components/DemoPanel.jsx';
import JournalPanel from './components/JournalPanel.jsx';
import VerdictCard, { calcVerdict } from './components/VerdictCard.jsx';
import MonteCarloPanel from './components/MonteCarloPanel.jsx';
import MultiTimeframePanel from './components/MultiTimeframePanel.jsx';
import ReportPanel from './components/ReportPanel.jsx';
import PrismaPanel from './components/PrismaPanel.jsx';
import OraclePanel from './components/OraclePanel.jsx';

const REFRESH_INTERVAL = 30000;
const INTERVAL_HORIZON_MS = { '5m': 900000, '15m': 2700000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };

export default function App() {
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [capital, setCapital] = useState(15);
  const [leverage, setLeverage] = useState(5);
  const [entryPrice, setEntryPrice] = useState(null);
  const [demoMode, setDemoMode] = useState(true);
  const [activeTab, setActiveTab] = useState('verdetto');

  const [candles, setCandles] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [bookData, setBookData] = useState(null);
  const [fundingData, setFundingData] = useState(null);
  const [oiData, setOiData] = useState(null);
  const [oiHistory, setOiHistory] = useState(null);
  const [globalData, setGlobalData] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [compositeSignal, setCompositeSignal] = useState(null);
  const [regime, setRegime] = useState(null);
  const [liquidationZones, setLiquidationZones] = useState([]);
  const [backtestResult, setBacktestResult] = useState(null);
  const [walkForwardResult, setWalkForwardResult] = useState(null);
  const [frequencies, setFrequencies] = useState(null);
  const [rangeStrategy, setRangeStrategy] = useState(null);
  const [prismaData, setPrismaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const lastLoggedVerdictRef = useRef(null);

  const computeIndicators = useCallback((candleData) => {
    if (!candleData || candleData.length < 30) return null;
    const closes = candleData.map((c) => c.close);
    return {
      ema12: calcEMA(closes, 12), ema26: calcEMA(closes, 26), sma50: calcSMA(closes, 50),
      rsi: calcRSI(closes, 14), macd: calcMACD(closes, 12, 26, 9),
      bollinger: calcBollinger(closes, 20, 2), atr: calcATR(candleData, 14), adx: calcADX(candleData, 14),
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setError(null);
    try {
      const [candlesRes, tickerRes, bookRes, fundingRes, oiRes, oiHistRes, globalRes] =
        await Promise.allSettled([
          fetchCandles(selectedPair, selectedInterval, 500),
          fetchTicker(selectedPair),
          fetchBook(selectedPair),
          fetchFunding(selectedPair),
          fetchOpenInterest(selectedPair),
          fetchOIHistory(selectedPair),
          fetchGlobal(),
        ]);

      const newCandles = candlesRes.status === 'fulfilled' ? candlesRes.value : null;
      const newTicker = tickerRes.status === 'fulfilled' ? tickerRes.value : null;
      const newBook = bookRes.status === 'fulfilled' ? bookRes.value : null;
      const newFunding = fundingRes.status === 'fulfilled' ? fundingRes.value : null;
      const newOi = oiRes.status === 'fulfilled' ? oiRes.value : null;
      const newOiHist = oiHistRes.status === 'fulfilled' ? oiHistRes.value : null;
      const newGlobal = globalRes.status === 'fulfilled' ? globalRes.value : null;

      setTicker(newTicker);
      setBookData(newBook);
      setFundingData(newFunding);
      setOiData(newOi);
      setOiHistory(newOiHist);
      setGlobalData(newGlobal);

      if (newCandles && newCandles.length > 0) {
        setCandles(newCandles);
        verifyPendingVerdicts(newCandles, selectedPair, selectedInterval);

        const newIndicators = computeIndicators(newCandles);
        setIndicators(newIndicators);

        if (newIndicators) {
          const newRegime = detectRegime(newCandles, newIndicators);
          setRegime(newRegime);

          const newSignal = calcCompositeSignal(newCandles, newIndicators, newFunding, newBook);
          setCompositeSignal(newSignal);

          const newRangeStrategy = calcRangeStrategy(newCandles, newIndicators);
          setRangeStrategy(newRangeStrategy);

          const lastPrice = newCandles[newCandles.length - 1].close;
          const oiValue = newOi?.openInterest ? parseFloat(newOi.openInterest) : null;
          setLiquidationZones(calcLiquidationZones(lastPrice, oiValue, [5, 10, 25]));

          setTimeout(() => {
            try {
              const bt = runBacktest(newCandles, newIndicators);
              setBacktestResult(bt);
              // Log verdetto se non NO_TRADE
              const v = calcVerdict({ regime: newRegime, compositeSignal: newSignal, backtestResult: bt, rangeStrategy: newRangeStrategy, indicators: newIndicators, candles: newCandles, capital, leverage });
              if (v.verdict !== 'NO_TRADE' && v.entry) {
                const key = `${selectedPair}_${selectedInterval}_${v.verdict}_${Math.round(v.entry)}`;
                if (lastLoggedVerdictRef.current !== key) {
                  lastLoggedVerdictRef.current = key;
                  logVerdict({
                    id: Date.now(),
                    date: new Date().toISOString(),
                    pair: selectedPair,
                    timeframe: selectedInterval,
                    strategy: v.strategy,
                    direction: v.verdict,
                    entryPrice: v.entry,
                    target: v.takeProfit,
                    stop: v.stopLoss,
                    horizonMs: INTERVAL_HORIZON_MS[selectedInterval] || 3600000,
                    verifiedAt: null,
                    outcome: null,
                  });
                }
              }
            } catch (e) { console.warn('Backtest error:', e.message); }
          }, 100);

          setTimeout(() => {
            try {
              const freq = calcHistoricalFrequencies(newCandles, newIndicators, 24, [5, 10, 20]);
              setFrequencies(freq);
            } catch (e) { console.warn('Frequencies error:', e.message); }
          }, 200);

          setTimeout(() => {
            try {
              const wf = runWalkForwardBacktest(newCandles, newIndicators);
              setWalkForwardResult(wf);
            } catch (e) { console.warn('Walk-forward error:', e.message); }
          }, 400);

          // PRISMA score (Hurst + ApEn + Volume Gravity)
          setTimeout(() => {
            try {
              const closes = newCandles.map(c => c.close);
              const newPrisma = calcPrisma(closes, newCandles);
              setPrismaData(newPrisma);
            } catch (e) { console.warn('PRISMA error:', e.message); }
          }, 600);

          // Analisi retroattiva ORACLE (cached in localStorage)
          setTimeout(() => {
            runRetroactiveAnalysis(newCandles, selectedPair, selectedInterval)
              .catch(e => console.warn('ORACLE retro error:', e.message));
          }, 800);
        }
      } else if (!newCandles) {
        setError('Impossibile caricare le candele. Verificare la connessione.');
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('fetchAllData error:', err);
      setError('Errore di connessione.');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, selectedInterval, computeIndicators, capital, leverage]);

  useEffect(() => {
    setLoading(true);
    setCandles(null); setIndicators(null); setCompositeSignal(null);
    setRegime(null); setBacktestResult(null); setFrequencies(null);
    setRangeStrategy(null); setWalkForwardResult(null); setPrismaData(null);
    fetchAllData();
    intervalRef.current = setInterval(fetchAllData, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedPair, selectedInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePairChange = (pair) => { setSelectedPair(pair); setEntryPrice(null); };
  const handleIntervalChange = (interval) => { setSelectedInterval(interval); };
  const fmtTime = (d) => d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  const verdictStrategy = (regime?.regime === 'lateral' && rangeStrategy) ? 'Range' : 'Trend';

  const TABS = [
    { id: 'verdetto', label: 'Verdetto' },
    { id: 'grafico', label: 'Grafico' },
    { id: 'report', label: 'Report' },
    { id: 'dettagli', label: 'Dettagli' },
  ];

  return (
    <div className="app-wrapper">
      <Header globalData={globalData} />

      <div className="app-content">
        {/* PairSelector sempre visibile */}
        <div className="dashboard-full">
          <PairSelector
            selectedPair={selectedPair} selectedInterval={selectedInterval}
            onPairChange={handlePairChange} onIntervalChange={handleIntervalChange} ticker={ticker}
          />
        </div>

        {/* Tab bar */}
        <nav className="tab-bar">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
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
          <div className="card" style={{ borderColor: 'var(--accent-red)', marginBottom: 16 }}>
            <p style={{ color: 'var(--accent-red)', fontWeight: 600 }}>⚠️ {error}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Controlla la connessione internet e ricarica la pagina.
            </p>
          </div>
        )}

        {!loading && lastUpdate && (
          <p className="last-update">Ultimo aggiornamento: {fmtTime(lastUpdate)} — auto-refresh 30s</p>
        )}

        {/* TAB: VERDETTO */}
        {!loading && activeTab === 'verdetto' && (
          <div className="dashboard-grid">
            <div className="dashboard-full">
              <PrismaPanel prismaData={prismaData} />
            </div>
            <div className="dashboard-full">
              <VerdictCard
                regime={regime} compositeSignal={compositeSignal} backtestResult={backtestResult}
                rangeStrategy={rangeStrategy} indicators={indicators} candles={candles}
                capital={capital} leverage={leverage} frequencies={frequencies}
                prismaData={prismaData}
              />
            </div>
            <div className="dashboard-full">
              <MultiTimeframePanel selectedPair={selectedPair} currentSignal={compositeSignal} currentInterval={selectedInterval} />
            </div>
            <div>
              <SignalCard
                selectedPair={selectedPair} ticker={ticker} compositeSignal={compositeSignal}
                regime={regime} frequencies={frequencies} fundingData={fundingData}
                oiData={oiData} bookData={bookData} backtestResult={backtestResult}
                capital={capital} leverage={leverage} entryPrice={entryPrice}
                indicators={indicators} candles={candles}
              />
            </div>
            <div>
              <RiskPanel
                capital={capital} leverage={leverage} entryPrice={entryPrice}
                onCapitalChange={setCapital} onLeverageChange={setLeverage}
                onEntryPriceChange={setEntryPrice} ticker={ticker}
                indicators={indicators} candles={candles}
              />
            </div>
          </div>
        )}

        {/* TAB: GRAFICO */}
        {!loading && activeTab === 'grafico' && (
          <div className="dashboard-grid">
            <div className="dashboard-full">
              <CandleChart candles={candles} indicators={indicators} liquidationZones={liquidationZones} />
            </div>
            <div className="dashboard-full">
              <IndicatorsPanel indicators={indicators} candles={candles} />
            </div>
          </div>
        )}

        {/* TAB: REPORT */}
        {!loading && activeTab === 'report' && (
          <div className="dashboard-grid">
            <div className="dashboard-full">
              <OraclePanel selectedPair={selectedPair} selectedInterval={selectedInterval} />
            </div>
            <div className="dashboard-full">
              <ReportPanel />
            </div>
          </div>
        )}

        {/* TAB: DETTAGLI */}
        {!loading && activeTab === 'dettagli' && (
          <div className="dashboard-grid">
            <div>
              <FundingPanel fundingData={fundingData} oiData={oiData} oiHistory={oiHistory} />
              <FrequenciesPanel frequencies={frequencies} compositeSignal={compositeSignal} />
            </div>
            <div>
              <OrderFlowPanel bookData={bookData} ticker={ticker} />
              <BacktestPanel backtestResult={backtestResult} walkForwardResult={walkForwardResult} />
              <MonteCarloPanel backtestResult={backtestResult} capital={capital} />
            </div>
            <div>
              <DemoPanel
                demoMode={demoMode} onDemoModeChange={setDemoMode}
                compositeSignal={compositeSignal} ticker={ticker} selectedPair={selectedPair}
              />
            </div>
            <div className="dashboard-full">
              <JournalPanel
                compositeSignal={compositeSignal} regime={regime}
                selectedPair={selectedPair} verdictStrategy={verdictStrategy}
              />
            </div>
          </div>
        )}
      </div>

      <WarningBanner />
    </div>
  );
}
