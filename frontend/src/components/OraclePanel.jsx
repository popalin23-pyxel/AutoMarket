import React, { useState, useEffect } from 'react';
import { getAllOracleData } from '../utils/verdictLog.js';

function AccuracyBand({ label, entries }) {
  const verified = entries.filter(e => e.outcome === 'hit_target' || e.outcome === 'hit_stop');
  const correct = verified.filter(e => e.outcome === 'hit_target');
  const n = verified.length;
  const pending = entries.filter(e => e.outcome === null || e.outcome === undefined).length;
  if (n === 0 && pending === 0) return null;
  const pct = n > 0 ? Math.round(correct.length / n * 100) : null;
  const color = pct === null ? '#555577' : pct >= 60 ? '#00ff88' : pct >= 45 ? '#ffaa00' : '#ff4466';
  return (
    <div className="oracle-band">
      <span className="ob-label">{label}</span>
      <span className="ob-pct font-mono" style={{ color }}>{pct !== null ? `${pct}%` : '—'}</span>
      <span className="ob-n font-mono">N={n}{pending > 0 ? ` +${pending}⏳` : ''}</span>
    </div>
  );
}

const outcomeIcon = (o) =>
  o === 'hit_target' ? '✅' : o === 'hit_stop' ? '❌' : o === 'expired' ? '⏸️' : '⏳';

export default function OraclePanel({ selectedPair, selectedInterval }) {
  const [data, setData] = useState([]);
  const [view, setView] = useState('accuracy');

  useEffect(() => {
    const refresh = () => setData(getAllOracleData());
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [selectedPair, selectedInterval]);

  const pairData = data.filter(e => e.pair === selectedPair);
  const liveData = data.filter(e => (e.source ?? 'live') !== 'retro');
  const retroData = data.filter(e => e.source === 'retro' && e.pair === selectedPair);

  const highPrisma = pairData.filter(e => (e.prismaScore ?? 0) >= 65);
  const midPrisma = pairData.filter(e => (e.prismaScore ?? 0) >= 50 && (e.prismaScore ?? 0) < 65);
  const lowPrisma = pairData.filter(e => (e.prismaScore ?? 0) < 50);

  const byTF = {};
  pairData.forEach(e => {
    const tf = e.timeframe ?? selectedInterval;
    if (!byTF[tf]) byTF[tf] = [];
    byTF[tf].push(e);
  });

  const allVerified = pairData.filter(e => e.outcome === 'hit_target' || e.outcome === 'hit_stop');
  const allCorrect = allVerified.filter(e => e.outcome === 'hit_target');
  const overallAcc = allVerified.length > 0 ? Math.round(allCorrect.length / allVerified.length * 100) : null;

  return (
    <div className="card oracle-card">
      <div className="card-header">
        <h3 className="panel-title">ORACLE — Calibrazione</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`tab-btn-sm ${view === 'accuracy' ? 'active' : ''}`} onClick={() => setView('accuracy')}>Accuratezza</button>
          <button className={`tab-btn-sm ${view === 'log' ? 'active' : ''}`} onClick={() => setView('log')}>Log</button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="oracle-empty">Nessun dato. La retroazione si avvia al prossimo refresh.</p>
      ) : view === 'accuracy' ? (
        <>
          <div className="oracle-summary">
            <div className="os-item">
              <span className="os-label">Accuratezza</span>
              <span className="os-value font-mono" style={{ color: overallAcc === null ? '#555' : overallAcc >= 60 ? '#00ff88' : overallAcc >= 45 ? '#ffaa00' : '#ff4466' }}>
                {overallAcc !== null ? `${overallAcc}%` : '—'}
              </span>
              <span className="os-sub">N={allVerified.length}</span>
            </div>
            <div className="os-item">
              <span className="os-label">Segnali live</span>
              <span className="os-value font-mono" style={{ color: '#4488ff' }}>{liveData.length}</span>
            </div>
            <div className="os-item">
              <span className="os-label">Retroattivi</span>
              <span className="os-value font-mono" style={{ color: '#555577' }}>{retroData.length}</span>
            </div>
          </div>

          <p className="oracle-section-title">Per PRISMA Score</p>
          <div className="oracle-bands">
            <AccuracyBand label="PRISMA ≥ 65 (alta)" entries={highPrisma} />
            <AccuracyBand label="PRISMA 50-65 (media)" entries={midPrisma} />
            <AccuracyBand label="PRISMA < 50 (bassa)" entries={lowPrisma} />
          </div>

          {Object.keys(byTF).length > 1 && (
            <>
              <p className="oracle-section-title">Per timeframe</p>
              <div className="oracle-bands">
                {Object.entries(byTF).map(([tf, es]) => (
                  <AccuracyBand key={tf} label={tf} entries={es} />
                ))}
              </div>
            </>
          )}

          <p className="oracle-note">
            ⚡ {retroData.length} segnali retroattivi già verificati.
            I segnali live si aggiungono a ogni refresh.
          </p>
        </>
      ) : (
        <div className="oracle-log">
          {pairData.slice(0, 40).map((e, i) => (
            <div key={e.id || i} className={`oracle-entry ${e.outcome === 'hit_target' ? 'oe-win' : e.outcome === 'hit_stop' ? 'oe-loss' : 'oe-pending'}`}>
              <span className="oe-icon">{outcomeIcon(e.outcome)}</span>
              <div className="oe-main">
                <span className="oe-dir font-mono" style={{ color: e.direction === 'LONG' ? '#00ff88' : '#ff4466' }}>{e.direction}</span>
                <span className="oe-price font-mono">${e.entryPrice?.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
                <span className={`oe-pnl font-mono ${e.outcome === 'hit_target' ? 'green' : e.outcome === 'hit_stop' ? 'red' : ''}`}>
                  {e.outcome === null || e.outcome === undefined ? 'in attesa' : e.outcome === 'hit_target' ? 'target ✓' : e.outcome === 'hit_stop' ? 'stop ✗' : 'scaduto'}
                </span>
              </div>
              <div className="oe-meta">
                {e.prismaScore != null && (
                  <span className="oe-prisma" style={{ color: e.prismaScore >= 65 ? '#00ff88' : e.prismaScore >= 50 ? '#ffaa00' : '#ff4466' }}>P:{e.prismaScore}</span>
                )}
                <span className="oe-tf" style={{ color: '#555577' }}>{e.timeframe}</span>
                <span className="oe-source" style={{ color: '#333355' }}>{e.source === 'retro' ? 'storico' : 'live'}</span>
              </div>
            </div>
          ))}
          {pairData.length === 0 && <p className="oracle-empty">Nessun segnale per {selectedPair}</p>}
        </div>
      )}
    </div>
  );
}
