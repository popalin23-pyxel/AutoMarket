import React, { useState, useEffect } from 'react';
import { getVerdictLog, clearVerdictLog } from '../utils/verdictLog.js';
import { fmtPct, sampleWarning } from '../utils/stats.js';

function filterByPeriod(log, period) {
  const now = Date.now();
  const cutoff = period === 'day' ? now - 86400000 : period === 'week' ? now - 604800000 : 0;
  return log.filter((e) => new Date(e.date).getTime() >= cutoff);
}

function calcGroupStats(entries) {
  const verified = entries.filter((e) => e.outcome !== null && e.outcome !== 'expired');
  const correct = verified.filter((e) => e.outcome === 'hit_target');
  const total = verified.length;
  const pending = entries.filter((e) => e.outcome === null).length;
  return { total, correct: correct.length, pending, winRate: total > 0 ? correct.length / total : null };
}

function StatCell({ label, successes, total, pending }) {
  const warn = sampleWarning(total);
  const text = total === 0 ? (pending > 0 ? `${pending} in attesa` : 'N/D') : fmtPct(successes, total);
  const color = total < 5 ? 'var(--text-muted)' : successes / total >= 0.55 ? 'var(--accent-green)' : successes / total <= 0.4 ? 'var(--accent-red)' : 'var(--accent-orange)';
  return (
    <div className="report-cell">
      <div className="report-cell-label">{label}</div>
      <div className="report-cell-value" style={{ color }}>{text}</div>
      {warn && <div className="report-cell-sub sample-small">⚠️ {warn}</div>}
      {total > 0 && <div className="report-cell-sub">N={total}</div>}
    </div>
  );
}

function generateSummary(log, period) {
  const entries = filterByPeriod(log, period);
  const verified = entries.filter((e) => e.outcome && e.outcome !== 'expired');
  if (verified.length < 3) return 'Dati insufficienti per una sintesi — accumula più segnali.';

  const byTF = {};
  verified.forEach((e) => {
    if (!byTF[e.timeframe]) byTF[e.timeframe] = { correct: 0, total: 0 };
    byTF[e.timeframe].total++;
    if (e.outcome === 'hit_target') byTF[e.timeframe].correct++;
  });

  let bestTF = null, worstTF = null;
  Object.entries(byTF).forEach(([tf, d]) => {
    if (d.total < 3) return;
    const wr = d.correct / d.total;
    if (!bestTF || wr > byTF[bestTF].correct / byTF[bestTF].total) bestTF = tf;
    if (!worstTF || wr < byTF[worstTF].correct / byTF[worstTF].total) worstTF = tf;
  });

  const byDir = { LONG: { correct: 0, total: 0 }, SHORT: { correct: 0, total: 0 } };
  verified.forEach((e) => {
    if (!byDir[e.direction]) return;
    byDir[e.direction].total++;
    if (e.outcome === 'hit_target') byDir[e.direction].correct++;
  });

  const longWR = byDir.LONG.total > 0 ? byDir.LONG.correct / byDir.LONG.total : null;
  const shortWR = byDir.SHORT.total > 0 ? byDir.SHORT.correct / byDir.SHORT.total : null;

  let text = `Su ${verified.length} segnali verificati: `;
  if (bestTF && worstTF && bestTF !== worstTF)
    text += `l'app ha funzionato meglio sul timeframe ${bestTF} e peggio sul ${worstTF}. `;
  else if (bestTF)
    text += `il timeframe più affidabile è ${bestTF}. `;
  if (longWR !== null && shortWR !== null)
    text += longWR >= shortWR ? 'I segnali LONG sono stati più precisi di quelli SHORT.' : 'I segnali SHORT sono stati più precisi di quelli LONG.';
  return text;
}

export default function ReportPanel() {
  const [period, setPeriod] = useState('week');
  const [log, setLog] = useState([]);

  useEffect(() => {
    setLog(getVerdictLog());
  }, []);

  const refresh = () => setLog(getVerdictLog());

  const entries = filterByPeriod(log, period);
  const overall = calcGroupStats(entries);

  const byTF = {};
  entries.forEach((e) => {
    if (!byTF[e.timeframe]) byTF[e.timeframe] = [];
    byTF[e.timeframe].push(e);
  });

  const byStrategy = {};
  entries.forEach((e) => {
    const k = e.strategy || 'Trend';
    if (!byStrategy[k]) byStrategy[k] = [];
    byStrategy[k].push(e);
  });

  const byDir = {};
  entries.forEach((e) => {
    if (!byDir[e.direction]) byDir[e.direction] = [];
    byDir[e.direction].push(e);
  });

  const allOverall = calcGroupStats(log);
  const summary = generateSummary(log, period);

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <h3 className="card-title">Report Calibrazione</h3>
        <button className="period-btn active" onClick={refresh} style={{ fontSize: 11 }}>↻ Aggiorna</button>
      </div>

      <div className="report-period-selector">
        {[['day', 'Oggi'], ['week', 'Settimana'], ['all', 'Tutto']].map(([v, l]) => (
          <button key={v} className={`period-btn ${period === v ? 'active' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="no-data">
          Nessun segnale registrato nel periodo selezionato.<br />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            I verdetti LONG/SHORT vengono registrati automaticamente ad ogni calcolo.
          </span>
        </div>
      ) : (
        <>
          {/* Totale periodo */}
          <p className="report-section-title">Totale periodo ({entries.length} segnali)</p>
          <div className="report-grid">
            <StatCell label="Correttezza" successes={overall.correct} total={overall.total} pending={overall.pending} />
            <div className="report-cell">
              <div className="report-cell-label">In attesa</div>
              <div className="report-cell-value" style={{ color: 'var(--accent-orange)' }}>{overall.pending}</div>
            </div>
            <div className="report-cell">
              <div className="report-cell-label">Verificati</div>
              <div className="report-cell-value font-mono">{overall.total}</div>
            </div>
          </div>

          {/* Per timeframe */}
          {Object.keys(byTF).length > 0 && (
            <>
              <p className="report-section-title">Per timeframe</p>
              <div className="report-grid">
                {Object.entries(byTF).map(([tf, es]) => {
                  const s = calcGroupStats(es);
                  return <StatCell key={tf} label={tf} successes={s.correct} total={s.total} pending={s.pending} />;
                })}
              </div>
            </>
          )}

          {/* Per strategia */}
          {Object.keys(byStrategy).length > 0 && (
            <>
              <p className="report-section-title">Per strategia</p>
              <div className="report-grid">
                {Object.entries(byStrategy).map(([strat, es]) => {
                  const s = calcGroupStats(es);
                  return <StatCell key={strat} label={strat} successes={s.correct} total={s.total} pending={s.pending} />;
                })}
              </div>
            </>
          )}

          {/* Per direzione */}
          {Object.keys(byDir).length > 0 && (
            <>
              <p className="report-section-title">Per direzione</p>
              <div className="report-grid">
                {Object.entries(byDir).map(([dir, es]) => {
                  const s = calcGroupStats(es);
                  return <StatCell key={dir} label={dir} successes={s.correct} total={s.total} pending={s.pending} />;
                })}
              </div>
            </>
          )}

          {/* Storico totale (se period != all) */}
          {period !== 'all' && log.length > entries.length && (
            <>
              <p className="report-section-title">Storico totale ({log.length} segnali)</p>
              <div className="report-grid">
                <StatCell label="Correttezza tot." successes={allOverall.correct} total={allOverall.total} pending={allOverall.pending} />
              </div>
            </>
          )}

          {/* Sintesi testuale */}
          <div className="report-summary-text">{summary}</div>
        </>
      )}

      <div className="report-warning">
        ⚠️ Una settimana è poco. Servono 50-100+ segnali prima che queste percentuali significhino qualcosa. N è sempre visibile: fidati solo dei gruppi con N elevato.
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button
          onClick={() => { if (window.confirm('Cancellare tutto il log dei verdetti?')) { clearVerdictLog(); setLog([]); } }}
          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
        >
          Svuota log
        </button>
      </div>
    </div>
  );
}
