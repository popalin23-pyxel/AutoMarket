import React, { useEffect, useMemo, useState } from 'react';
import { computeTimesheet, monthDays } from '../lib/calc.js';
import { professionalHeaderLines, rivalsaLabel } from '../lib/defaults.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import { loadChunk } from '../lib/loadChunk.js';

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loadTimesheet = () => loadChunk(() => import('../lib/timesheet.js'));
const KIND_KEY = 'horarya.timesheetKind'; // ultima scelta: 'money' (ore e compenso) o 'hours' (solo ore)
const readKind = () => { try { return localStorage.getItem(KIND_KEY) === 'hours' ? 'hours' : 'money'; } catch { return 'money'; } };

// Foglio ore da mandare a una struttura: una sede, un periodo (di base il mese aperto).
export default function TimesheetDialog({ state, siteId, year, month, onClose }) {
  const sites = state.sites;
  const pad = (n) => String(n).padStart(2, '0');
  const [sel, setSel] = useState(siteId ?? sites[0]?.id ?? null);
  const [from, setFrom] = useState(`${year}-${pad(month)}-01`);
  const [to, setTo] = useState(`${year}-${pad(month)}-${pad(monthDays(year, month))}`);
  const [busy, setBusy] = useState(false);
  const [kind, setKindRaw] = useState(readKind);
  const setKind = (k) => { setKindRaw(k); try { localStorage.setItem(KIND_KEY, k); } catch {} };
  const withMoney = kind === 'money';
  useLockBodyScroll();
  useBackClose(onClose);
  useEffect(() => { loadTimesheet().catch(() => {}); }, []); // pronto al tocco (condivisione su iPhone)

  const site = sites.find((s) => s.id === sel);
  const ts = useMemo(() => (site && from && to && from <= to
    ? computeTimesheet(state.shifts, site, state.settings, from, to) : null), [state.shifts, state.settings, site, from, to]);
  const opts = { headerLines: professionalHeaderLines(state.settings), rivalsaLabel: rivalsaLabel(state.settings), withMoney };

  const run = async (format) => {
    if (!ts) return;
    setBusy(true);
    try {
      const mod = await loadTimesheet();
      await (format === 'pdf' ? mod.exportTimesheetPdf(ts, opts) : mod.exportTimesheetExcel(ts, opts));
    } finally { setBusy(false); }
  };

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Foglio ore per la struttura</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="panel-desc">
          L'elenco dei turni di una sola sede, con lo spazio per la firma.
          Non contiene tasse, netto né le altre sedi: si può mandare al cliente.
        </p>

        <div className="editor-label">Cosa mostrare</div>
        <div className="site-picker" role="radiogroup" aria-label="Cosa mostrare nel foglio">
          <button type="button" role="radio" aria-checked={!withMoney} className={`site-pick-btn ${!withMoney ? 'sel' : ''}`} onClick={() => setKind('hours')}>
            🕒 Solo ore
          </button>
          <button type="button" role="radio" aria-checked={withMoney} className={`site-pick-btn ${withMoney ? 'sel' : ''}`} onClick={() => setKind('money')}>
            💶 Ore, tariffa e totale
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          {withMoney ? 'Ogni turno con la tariffa oraria e l\'importo, più il totale da pagare.' : 'Solo date, orari e ore: nessuna cifra in euro.'}
        </p>

        <div className="editor-label">Struttura</div>
        {sites.length === 0 && <p className="hint hint-warn">Non hai ancora sedi: aggiungile in Altro → Sedi e paghe.</p>}
        <div className="site-picker">
          {sites.map((s) => (
            <button key={s.id} type="button" className={`site-pick-btn ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
              <span className="site-dot" style={{ background: s.color }} />{s.name}
            </button>
          ))}
        </div>

        <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="field">
            <label className="field-label">Dal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Al</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {ts && (
          <div className="editor-breakdown">
            <div className="editor-breakdown-row"><span>Turni</span><span>{ts.rows.length}</span></div>
            <div className="editor-breakdown-row"><span>Ore</span><span>{fmt(ts.totalHours)}</span></div>
            {withMoney && <>
            <div className="editor-breakdown-row"><span>{ts.inclusive ? 'Compenso (scorporato)' : 'Compenso'}</span><span>€{fmt(ts.revenue)}</span></div>
            {ts.rivalsaPercent > 0 && (
              <div className="editor-breakdown-row"><span>{opts.rivalsaLabel} {ts.rivalsaPercent}%</span><span>€{fmt(ts.rivalsa)}</span></div>
            )}
            <div className="editor-breakdown-row total"><span>Totale</span><span>€{fmt(ts.total)}</span></div>
            </>}
          </div>
        )}
        {from > to && <p className="hint hint-warn" style={{ marginTop: 10 }}>La data di fine viene prima di quella di inizio.</p>}

        <div className="editor-actions">
          <button className="btn btn-primary btn-block" onClick={() => run('pdf')} disabled={!ts || busy}>⬇ PDF</button>
          <button className="btn btn-block" onClick={() => run('xlsx')} disabled={!ts || busy}>⬇ Excel</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
