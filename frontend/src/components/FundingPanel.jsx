import React from 'react';

function FundingGauge({ value }) {
  // value: numero tra -0.001 e 0.001 tipicamente
  const clamped = Math.max(-0.001, Math.min(0.001, value));
  const pct = ((clamped + 0.001) / 0.002) * 100; // 0-100%
  const color =
    value < -0.0002
      ? '#00ff88'
      : value > 0.0004
      ? '#ff4466'
      : '#ffaa00';

  return (
    <div className="funding-gauge">
      <div className="gauge-track">
        <div
          className="gauge-fill"
          style={{
            width: `${pct}%`,
            background: color,
          }}
        />
        <div className="gauge-center-line" />
      </div>
      <div className="gauge-labels">
        <span style={{ color: '#00ff88' }}>Short sovraffollati</span>
        <span style={{ color: '#888' }}>Neutro</span>
        <span style={{ color: '#ff4466' }}>Long sovraffollati</span>
      </div>
    </div>
  );
}

export default function FundingPanel({ fundingData, oiData, oiHistory }) {
  const fundingRate =
    fundingData && !fundingData.error
      ? parseFloat(fundingData.lastFundingRate || fundingData.fundingRate || 0)
      : null;

  const oiValue =
    oiData && !oiData.error ? parseFloat(oiData.openInterest || 0) : null;

  // Calcola variazione OI dall'history
  let oiChangePct = null;
  if (oiHistory && Array.isArray(oiHistory) && oiHistory.length >= 2) {
    const first = parseFloat(oiHistory[0]?.sumOpenInterest || 0);
    const last = parseFloat(oiHistory[oiHistory.length - 1]?.sumOpenInterest || 0);
    if (first > 0) {
      oiChangePct = ((last - first) / first) * 100;
    }
  }

  const fundingStatus =
    fundingRate == null
      ? 'Dati non disponibili'
      : Math.abs(fundingRate) < 0.0001
      ? 'Neutro — nessun affollamento evidente'
      : fundingRate > 0.0005
      ? 'Affollamento long — rischio inversione short squeeze'
      : fundingRate > 0.0002
      ? 'Long prevalenti — attenzione'
      : fundingRate < -0.0003
      ? 'Affollamento short — possibile squeeze rialzista'
      : fundingRate < -0.0001
      ? 'Short prevalenti — pressione ribassista'
      : 'Lievemente squilibrato';

  const fundingColor =
    fundingRate == null
      ? '#888'
      : fundingRate < -0.0002
      ? '#00ff88'
      : fundingRate > 0.0003
      ? '#ff4466'
      : '#ffaa00';

  return (
    <div className="card funding-card">
      <h3 className="card-title">Funding Rate & Open Interest</h3>

      <div className="funding-main">
        <div className="funding-rate-display">
          <span className="funding-label">Tasso Funding</span>
          {fundingRate != null ? (
            <>
              <span className="funding-value font-mono" style={{ color: fundingColor }}>
                {(fundingRate * 100).toFixed(4)}%
              </span>
              <span className="funding-period">ogni 8 ore</span>
            </>
          ) : (
            <span className="funding-na">dato non disponibile</span>
          )}
        </div>

        {oiValue != null && (
          <div className="oi-display">
            <span className="oi-label">Open Interest</span>
            <span className="oi-value font-mono">
              {oiValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
            </span>
            {oiChangePct != null && (
              <span
                className={`oi-change ${oiChangePct >= 0 ? 'accent-green' : 'accent-red'}`}
              >
                {oiChangePct >= 0 ? '↑' : '↓'} {Math.abs(oiChangePct).toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {fundingRate != null && <FundingGauge value={fundingRate} />}

      <div className="funding-status-label" style={{ color: fundingColor }}>
        {fundingStatus}
      </div>

      {/* Tabella storico OI */}
      {oiHistory && Array.isArray(oiHistory) && oiHistory.length > 0 && (
        <div className="oi-history">
          <p className="oi-history-title">Storico Open Interest (ultime ore)</p>
          <div className="oi-history-table">
            {oiHistory.slice(-5).map((item, i) => {
              const ts = item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : `T-${5 - i}h`;
              const oi = parseFloat(item.sumOpenInterest || 0);
              return (
                <div key={i} className="oi-row">
                  <span className="oi-time">{ts}</span>
                  <span className="oi-val font-mono">
                    {oi.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel-disclaimer">
        ⚠️ Funding elevato non implica inversione immediata
      </div>
    </div>
  );
}
