import React, { useEffect, useRef, useState } from 'react';

export default function CandleChart({ candles, indicators, liquidationZones }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [error, setError] = useState(null);
  const [lwcAvailable, setLwcAvailable] = useState(false);

  useEffect(() => {
    // Verifica se lightweight-charts è disponibile
    import('lightweight-charts')
      .then(() => setLwcAvailable(true))
      .catch(() => setError('Libreria grafico non disponibile'));
  }, []);

  useEffect(() => {
    if (!lwcAvailable) return;
    if (!chartContainerRef.current) return;

    let chart;
    import('lightweight-charts').then(({ createChart, CrosshairMode, LineStyle }) => {
      const container = chartContainerRef.current;
      if (!container) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 380,
        layout: {
          background: { color: '#12121a' },
          textColor: '#aaaacc',
        },
        grid: {
          vertLines: { color: '#1e1e2e' },
          horzLines: { color: '#1e1e2e' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#1e1e2e',
        },
        timeScale: {
          borderColor: '#1e1e2e',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00ff88',
        downColor: '#ff4466',
        borderDownColor: '#ff4466',
        borderUpColor: '#00ff88',
        wickDownColor: '#ff4466',
        wickUpColor: '#00ff88',
      });
      seriesRef.current.candles = candleSeries;

      // Volume series (in pane separato)
      const volumeSeries = chart.addHistogramSeries({
        color: '#4488ff',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      seriesRef.current.volume = volumeSeries;

      // EMA12 (blue)
      const ema12Series = chart.addLineSeries({
        color: '#4488ff',
        lineWidth: 1,
        title: 'EMA12',
      });
      seriesRef.current.ema12 = ema12Series;

      // EMA26 (orange)
      const ema26Series = chart.addLineSeries({
        color: '#ffaa00',
        lineWidth: 1,
        title: 'EMA26',
      });
      seriesRef.current.ema26 = ema26Series;

      // SMA50 (purple)
      const sma50Series = chart.addLineSeries({
        color: '#aa44ff',
        lineWidth: 1,
        title: 'SMA50',
      });
      seriesRef.current.sma50 = sma50Series;

      // Bollinger upper (gray)
      const bollUpperSeries = chart.addLineSeries({
        color: '#555577',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB+',
      });
      seriesRef.current.bollUpper = bollUpperSeries;

      // Bollinger lower (gray)
      const bollLowerSeries = chart.addLineSeries({
        color: '#555577',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB-',
      });
      seriesRef.current.bollLower = bollLowerSeries;

      // Resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        chart.applyOptions({ width });
      });
      resizeObserver.observe(container);
      chartRef.current._resizeObserver = resizeObserver;
    });

    return () => {
      if (chartRef.current) {
        if (chartRef.current._resizeObserver) {
          chartRef.current._resizeObserver.disconnect();
        }
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = {};
      }
    };
  }, [lwcAvailable]);

  // Aggiorna i dati quando cambiano
  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;

    const { candles: candleSeries, volume: volumeSeries } = seriesRef.current;

    if (candleSeries) {
      const candleData = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      try {
        candleSeries.setData(candleData);
      } catch (_) {}
    }

    if (volumeSeries) {
      const volumeData = candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? '#00ff8844' : '#ff446644',
      }));
      try {
        volumeSeries.setData(volumeData);
      } catch (_) {}
    }

    // EMA12
    if (seriesRef.current.ema12 && indicators?.ema12) {
      const ema12Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.ema12[i] }))
        .filter((d) => !isNaN(d.value));
      try {
        seriesRef.current.ema12.setData(ema12Data);
      } catch (_) {}
    }

    // EMA26
    if (seriesRef.current.ema26 && indicators?.ema26) {
      const ema26Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.ema26[i] }))
        .filter((d) => !isNaN(d.value));
      try {
        seriesRef.current.ema26.setData(ema26Data);
      } catch (_) {}
    }

    // SMA50
    if (seriesRef.current.sma50 && indicators?.sma50) {
      const sma50Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.sma50[i] }))
        .filter((d) => !isNaN(d.value));
      try {
        seriesRef.current.sma50.setData(sma50Data);
      } catch (_) {}
    }

    // Bollinger
    if (seriesRef.current.bollUpper && indicators?.bollinger?.upper) {
      const upperData = candles
        .map((c, i) => ({ time: c.time, value: indicators.bollinger.upper[i] }))
        .filter((d) => !isNaN(d.value));
      const lowerData = candles
        .map((c, i) => ({ time: c.time, value: indicators.bollinger.lower[i] }))
        .filter((d) => !isNaN(d.value));
      try {
        seriesRef.current.bollUpper.setData(upperData);
        seriesRef.current.bollLower.setData(lowerData);
      } catch (_) {}
    }
  }, [candles, indicators]);

  // Liquidation zones
  useEffect(() => {
    if (!chartRef.current || !liquidationZones || !candles || candles.length === 0) return;

    import('lightweight-charts').then(({ LineStyle }) => {
      // Rimuovi le linee precedenti
      const prevLines = seriesRef.current.liqLines || [];
      prevLines.forEach((l) => {
        try {
          chartRef.current.removeSeries(l);
        } catch (_) {}
      });

      const newLines = [];
      liquidationZones.slice(0, 6).forEach((zone) => {
        const isLong = zone.type === 'long_liq';
        try {
          const lineSeries = chartRef.current.addLineSeries({
            color: isLong ? '#ff446688' : '#00ff8888',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            lastValueVisible: true,
            priceLineVisible: false,
            title: `Liq ${zone.leverage}x`,
          });
          const lineData = candles.map((c) => ({ time: c.time, value: zone.level }));
          lineSeries.setData(lineData);
          newLines.push(lineSeries);
        } catch (_) {}
      });

      seriesRef.current.liqLines = newLines;
    });
  }, [liquidationZones, candles]);

  if (error) {
    return (
      <div className="card chart-card">
        <h3 className="card-title">Grafico Candele</h3>
        <div className="chart-error">
          <span>⚠️ {error}</span>
        </div>
      </div>
    );
  }

  if (!lwcAvailable) {
    return (
      <div className="card chart-card">
        <h3 className="card-title">Grafico Candele</h3>
        <div className="chart-loading">Caricamento grafico...</div>
      </div>
    );
  }

  return (
    <div className="card chart-card">
      <div className="card-header">
        <h3 className="card-title">Grafico Candele</h3>
        <div className="chart-legend">
          <span className="legend-item" style={{ color: '#4488ff' }}>■ EMA12</span>
          <span className="legend-item" style={{ color: '#ffaa00' }}>■ EMA26</span>
          <span className="legend-item" style={{ color: '#aa44ff' }}>■ SMA50</span>
          <span className="legend-item" style={{ color: '#555577' }}>- BB</span>
        </div>
      </div>
      <div ref={chartContainerRef} className="chart-container" />
    </div>
  );
}
