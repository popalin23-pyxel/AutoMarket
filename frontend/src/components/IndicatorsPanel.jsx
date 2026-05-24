import React, { useEffect, useRef, useState } from 'react';

function MiniChart({ title, data, candles, color = '#4488ff', lines = [] }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data || !candles) return;

    let chart;
    import('lightweight-charts').then(({ createChart }) => {
      if (!containerRef.current) return;
      const container = containerRef.current;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 120,
        layout: {
          background: { color: '#0d0d15' },
          textColor: '#aaaacc',
        },
        grid: {
          vertLines: { color: '#1a1a2a' },
          horzLines: { color: '#1a1a2a' },
        },
        rightPriceScale: {
          borderColor: '#1e1e2e',
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: {
          borderColor: '#1e1e2e',
          timeVisible: false,
        },
        handleScale: false,
        handleScroll: false,
      });

      chartRef.current = chart;

      const series = chart.addLineSeries({ color, lineWidth: 1 });
      const chartData = candles
        .map((c, i) => ({ time: c.time, value: data[i] }))
        .filter((d) => !isNaN(d.value) && d.value != null);
      if (chartData.length > 0) {
        series.setData(chartData);
      }

      // Linee orizzontali (es. overbought/oversold)
      lines.forEach((l) => {
        const hLine = chart.addLineSeries({
          color: l.color || '#555555',
          lineWidth: 1,
          lineStyle: 2, // dashed
          lastValueVisible: false,
          priceLineVisible: false,
        });
        if (chartData.length > 0) {
          hLine.setData([
            { time: chartData[0].time, value: l.value },
            { time: chartData[chartData.length - 1].time, value: l.value },
          ]);
        }
      });

      const resizeObserver = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        chart.applyOptions({ width });
      });
      resizeObserver.observe(container);
      chartRef.current._ro = resizeObserver;
    });

    return () => {
      if (chartRef.current) {
        if (chartRef.current._ro) chartRef.current._ro.disconnect();
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, candles, color]);

  return (
    <div className="mini-chart-wrapper">
      <p className="mini-chart-title">{title}</p>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}

function MACDMiniChart({ macd, candles }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !macd || !candles) return;

    let chart;
    import('lightweight-charts').then(({ createChart }) => {
      if (!containerRef.current) return;
      const container = containerRef.current;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 120,
        layout: {
          background: { color: '#0d0d15' },
          textColor: '#aaaacc',
        },
        grid: {
          vertLines: { color: '#1a1a2a' },
          horzLines: { color: '#1a1a2a' },
        },
        rightPriceScale: { borderColor: '#1e1e2e' },
        timeScale: { borderColor: '#1e1e2e', timeVisible: false },
        handleScale: false,
        handleScroll: false,
      });
      chartRef.current = chart;

      // Histogram
      const histSeries = chart.addHistogramSeries({
        priceScaleId: 'right',
      });
      const histData = candles
        .map((c, i) => ({
          time: c.time,
          value: macd.histogram[i],
          color: macd.histogram[i] >= 0 ? '#00ff8866' : '#ff446666',
        }))
        .filter((d) => !isNaN(d.value) && d.value != null);
      if (histData.length > 0) histSeries.setData(histData);

      // MACD line
      const macdLine = chart.addLineSeries({ color: '#4488ff', lineWidth: 1, title: 'MACD' });
      const macdData = candles
        .map((c, i) => ({ time: c.time, value: macd.macd[i] }))
        .filter((d) => !isNaN(d.value) && d.value != null);
      if (macdData.length > 0) macdLine.setData(macdData);

      // Signal line
      const signalLine = chart.addLineSeries({ color: '#ffaa00', lineWidth: 1, title: 'Signal' });
      const signalData = candles
        .map((c, i) => ({ time: c.time, value: macd.signal[i] }))
        .filter((d) => !isNaN(d.value) && d.value != null);
      if (signalData.length > 0) signalLine.setData(signalData);

      const ro = new ResizeObserver((e) => chart.applyOptions({ width: e[0].contentRect.width }));
      ro.observe(container);
      chartRef.current._ro = ro;
    });

    return () => {
      if (chartRef.current) {
        if (chartRef.current._ro) chartRef.current._ro.disconnect();
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [macd, candles]);

  return (
    <div className="mini-chart-wrapper">
      <p className="mini-chart-title">MACD</p>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}

export default function IndicatorsPanel({ indicators, candles }) {
  if (!indicators || !candles || candles.length === 0) {
    return (
      <div className="card indicators-card">
        <h3 className="card-title">Indicatori Tecnici</h3>
        <div className="no-data">Dati non disponibili</div>
      </div>
    );
  }

  const lastIdx = candles.length - 1;
  const lastRSI = indicators.rsi ? indicators.rsi[lastIdx] : null;
  const lastATR = indicators.atr ? indicators.atr[lastIdx] : null;
  const lastMACD =
    indicators.macd?.macd ? indicators.macd.macd[lastIdx] : null;
  const lastSignal =
    indicators.macd?.signal ? indicators.macd.signal[lastIdx] : null;

  return (
    <div className="card indicators-card">
      <div className="card-header">
        <h3 className="card-title">Indicatori Tecnici</h3>
        <div className="indicator-badges">
          {lastRSI != null && !isNaN(lastRSI) && (
            <span
              className={`indicator-badge ${
                lastRSI > 70 ? 'badge-red' : lastRSI < 30 ? 'badge-green' : 'badge-neutral'
              }`}
            >
              RSI {lastRSI.toFixed(1)}
            </span>
          )}
          {lastATR != null && !isNaN(lastATR) && (
            <span className="indicator-badge badge-neutral">
              ATR {lastATR.toFixed(2)}
            </span>
          )}
          {lastMACD != null && lastSignal != null && !isNaN(lastMACD) && !isNaN(lastSignal) && (
            <span
              className={`indicator-badge ${
                lastMACD > lastSignal ? 'badge-green' : 'badge-red'
              }`}
            >
              MACD {lastMACD > lastSignal ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      <MiniChart
        title="RSI (14)"
        data={indicators.rsi}
        candles={candles}
        color="#ffaa00"
        lines={[
          { value: 70, color: '#ff446666' },
          { value: 30, color: '#00ff8866' },
          { value: 50, color: '#44444466' },
        ]}
      />

      <MACDMiniChart macd={indicators.macd} candles={candles} />

      <MiniChart
        title="ATR (14)"
        data={indicators.atr}
        candles={candles}
        color="#aa44ff"
      />
    </div>
  );
}
