import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

import { calcEMA, calcSMA, calcRSI, calcMACD, calcBollinger, calcATR, calcADX } from './utils/indicators.js';
import { detectRegime, calcCompositeSignal, calcLiquidationZones } from './utils/signals.js';
import { runBacktest, calcHistoricalFrequencies } from './utils/backtest.js';
import {
  fetchCandles,
  fetchTicker,
  fetchBook,
  fetchFunding,
  fetchOpenInterest,
  fetchOIHistory,
  fetchGlobal,
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

const REFRESH_INTERVAL = 30000; // 30 secondi

export default function App() {
  // ---- Parametri utente ----
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [capital, setCapital] = useState(15);
  const [leverage, setLeverage] = useState(5);
  const [entryPrice, setEntryPrice] = useState(null);
  const [demoMode, setDemoMode] = useState(true);

  // ---- Dati di mercato ----
  const [candles, setCandles] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [bookData, setBookData] = useState(null);
  const [fundingData, setFundingData] = useState(null);
  const [oiData, setOiData] = useState(null);
  const [oiHistory, setOiHistory] = useState(null);
  const [globalData, setGlobalData] = useState(null);

  // ---- Indicatori calcolati ----
  const [indicators, setIndicators] = useState(null);

  // ---- Segnali e analisi ----
  const [compositeSignal, setCompositeSignal] = useState(null);
  const [regime, setRegime] = useState(null);
  const [liquidationZones, setLiquidationZones] = useState([]);
  const [backtestResult, setBacktestResult] = useState(null);
  const [frequencies, setFrequencies] = useState(null);

  // ---- Stato UI ----
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const backtestWorkerRef = useRef(null);

  // ---- Calcola indicatori ----
  const computeIndicators = useCallback((candleData) => {
    if (!candleData || candleData.length < 30) return null;
    const closes = candleData.map((c) => c.close);

    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const sma50 = calcSMA(closes, 50);
    const rsi = calcRSI(closes, 14);
    const macd = calcMACD(closes, 12, 26, 9);
    const bollinger = calcBollinger(closes, 20, 2);
    const atr = calcATR(candleData, 14);
    const adx = calcADX(candleData, 14);

    return { ema12, ema26, sma50, rsi, macd, bollinger, atr, adx };
  }, []);

  // ---- Fetch tutti i dati ----
  const fetchAllData = useCallback(async () => {
    setError(null);
    try {
      // Fetch in parallelo
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

        // Calcola indicatori
        const newIndicators = computeIndicators(newCandles);
        setIndicators(newIndicators);

        if (newIndicators) {
          // Regime di mercato
          const newRegime = detectRegime(newCandles, newIndicators);
          setRegime(newRegime);

          // Segnale composito
          const newSignal = calcCompositeSignal(
            newCandles,
            newIndicators,
            newFunding,
            newBook
          );
          setCompositeSignal(newSignal);

          // Zone di liquidazione
          const lastPrice = newCandles[newCandles.length - 1].close;
          const oiValue = newOi?.openInterest ? parseFloat(newOi.openInterest) : null;
          const zones = calcLiquidationZones(lastPrice, oiValue, [5, 10, 25]);
          setLiquidationZones(zones);

          // Backtest (può essere lento, lo eseguiamo in modo asincrono non bloccante)
          setTimeout(() => {
            try {
              const bt = runBacktest(newCandles, newIndicators);
              setBacktestResult(bt);
            } catch (e) {
              console.warn('Backtest error:', e.message);
            }
          }, 100);

          // Frequenze storiche
          setTimeout(() => {
            try {
              const freq = calcHistoricalFrequencies(newCandles, newIndicators, 24, [5, 10, 20]);
              setFrequencies(freq);
            } catch (e) {
              console.warn('Frequencies error:', e.message);
            }
          }, 200);
        }
      } else if (!newCandles) {
        setError('Impossibile caricare le candele. Verificare la connessione.');
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('fetchAllData error:', err);
      setError('Errore di connessione al backend.');
    } finally {
      setLoading(false);
    }
  }, [selectedPair, selectedInterval, computeIndicators]);

  // ---- Effetto principale: fetch al montaggio e ogni 30s ----
  useEffect(() => {
    setLoading(true);
    setCandles(null);
    setIndicators(null);
    setCompositeSignal(null);
    setRegime(null);
    setBacktestResult(null);
    setFrequencies(null);

    fetchAllData();

    intervalRef.current = setInterval(fetchAllData, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedPair, selectedInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Handlers ----
  const handlePairChange = (pair) => {
    setSelectedPair(pair);
    setEntryPrice(null);
  };

  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
  };

  const formatLastUpdate = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="app-wrapper">
      <Header globalData={globalData} />

      <div className="app-content">
        {/* Pair selector sempre visibile */}
        <div className="dashboard-full">
          <PairSelector
            selectedPair={selectedPair}
            selectedInterval={selectedInterval}
            onPairChange={handlePairChange}
            onIntervalChange={handleIntervalChange}
            ticker={ticker}
          />
        </div>

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
              Il backend deve essere avviato su http://localhost:3001
            </p>
          </div>
        )}

        {!loading && (
          <>
            {lastUpdate && (
              <p className="last-update">
                Ultimo aggiornamento: {formatLastUpdate(lastUpdate)} — auto-refresh 30s
              </p>
            )}

            <div className="dashboard-grid">
              {/* Colonna sinistra: segnale principale */}
              <div>
                <SignalCard
                  selectedPair={selectedPair}
                  ticker={ticker}
                  compositeSignal={compositeSignal}
                  regime={regime}
                  frequencies={frequencies}
                  fundingData={fundingData}
                  oiData={oiData}
                  bookData={bookData}
                  backtestResult={backtestResult}
                  capital={capital}
                  leverage={leverage}
                  entryPrice={entryPrice}
                  indicators={indicators}
                  candles={candles}
                />

                <RiskPanel
                  capital={capital}
                  leverage={leverage}
                  entryPrice={entryPrice}
                  onCapitalChange={setCapital}
                  onLeverageChange={setLeverage}
                  onEntryPriceChange={setEntryPrice}
                  ticker={ticker}
                  indicators={indicators}
                  candles={candles}
                />
              </div>

              {/* Colonna centrale: grafico */}
              <div className="dashboard-2col">
                <CandleChart
                  candles={candles}
                  indicators={indicators}
                  liquidationZones={liquidationZones}
                />

                <IndicatorsPanel
                  indicators={indicators}
                  candles={candles}
                />
              </div>

              {/* Seconda riga: analisi approfondita */}
              <div>
                <FundingPanel
                  fundingData={fundingData}
                  oiData={oiData}
                  oiHistory={oiHistory}
                />

                <FrequenciesPanel
                  frequencies={frequencies}
                  compositeSignal={compositeSignal}
                />
              </div>

              <div>
                <OrderFlowPanel
                  bookData={bookData}
                  ticker={ticker}
                />

                <BacktestPanel
                  backtestResult={backtestResult}
                />
              </div>

              <div>
                <DemoPanel
                  demoMode={demoMode}
                  onDemoModeChange={setDemoMode}
                  compositeSignal={compositeSignal}
                  ticker={ticker}
                  selectedPair={selectedPair}
                />
              </div>

              {/* Journal a tutta larghezza */}
              <div className="dashboard-full">
                <JournalPanel
                  compositeSignal={compositeSignal}
                  regime={regime}
                  selectedPair={selectedPair}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <WarningBanner />
    </div>
  );
}
