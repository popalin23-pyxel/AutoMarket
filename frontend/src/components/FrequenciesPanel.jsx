import React from 'react';

export default function FrequenciesPanel({ frequencies, compositeSignal }) {
  if (!frequencies) {
    return (
      <div className="card frequencies-card">
        <h3 className="card-title">Frequenze Storiche</h3>
        <div className="no-data">Calcolo frequenze in corso...</div>
      </div>
    );
  }

  const { n, frequencies: freqData, avgReturn, sampleWarning } = frequencies;
  const signal = compositeSignal?.signal || 'NEUTRAL';

  const signalColor =
    signal === 'LONG' ? '#00ff88' : signal === 'SHORT' ? '#ff4466' : '#888';

  return (
    <div className="card frequencies-card">
      <div className="card-header">
        <h3 className="card-title">Frequenze Storiche</h3>
        <div className="freq-sample">
          <span className="sample-label">Campione:</span>
          <span className={`sample-n font-mono ${sampleWarning ? 'accent-red' : 'accent-green'}`}>
            N = {n}
          </span>
          {sampleWarning && (
            <span className="sample-warning-badge">⚠️ Campione ridotto</span>
          )}
        </div>
      </div>

      <div className="freq-context">
        <span>Segnale attuale: </span>
        <span className="font-mono" style={{ color: signalColor }}>
          {signal}
        </span>
        <span> — casi simili trovati nel passato</span>
      </div>

      {n === 0 ? (
        <div className="no-data">Nessun caso simile trovato nei dati storici</div>
      ) : (
        <>
          <div className="freq-table">
            <div className="freq-table-header">
              <span>Target</span>
              <span>↑ Raggiunto</span>
              <span>↓ Raggiunto</span>
              <span>Differenziale</span>
            </div>
            {freqData.map((row) => {
              const diff = row.upFreq - row.downFreq;
              const diffColor = diff > 5 ? '#00ff88' : diff < -5 ? '#ff4466' : '#ffaa00';
              return (
                <div key={row.target} className="freq-table-row">
                  <span className="freq-target font-mono">±{row.target}%</span>
                  <span className="freq-up font-mono accent-green">{row.upFreq}%</span>
                  <span className="freq-down font-mono accent-red">{row.downFreq}%</span>
                  <span className="freq-diff font-mono" style={{ color: diffColor }}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="freq-avg-return">
            <span className="avg-label">Ritorno medio (orizzonte 24h):</span>
            <span
              className={`avg-value font-mono ${avgReturn >= 0 ? 'accent-green' : 'accent-red'}`}
            >
              {avgReturn >= 0 ? '+' : ''}{avgReturn}%
            </span>
          </div>

          {sampleWarning && (
            <div className="sample-warning-detail">
              ⚠️ Campione inferiore a 20 casi: dati statisticamente poco affidabili.
              Aumentare la serie storica per risultati più robusti.
            </div>
          )}
        </>
      )}

      <div className="panel-disclaimer">
        Frequenza storica, non previsione. Passato ≠ futuro.
      </div>
    </div>
  );
}
