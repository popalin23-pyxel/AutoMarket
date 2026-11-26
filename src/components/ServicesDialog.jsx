import React, { useEffect, useMemo, useState } from 'react';
import { monthDays } from '../lib/calc.js';
import { computeServiceList, taxLines } from '../lib/services.js';
import { professionalHeaderLines, rivalsaLabel } from '../lib/defaults.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import { loadChunk } from '../lib/loadChunk.js';

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loadDoc = () => loadChunk(() => import('../lib/servicesDoc.js'));
const KIND_KEY = 'horarya.servicesKind'; // ultima scelta: 'me' (con tasse e netto) o 'client' (da mandare)
const readKind = () => { try { return localStorage.getItem(KIND_KEY) === 'client' ? 'client' : 'me'; } catch { return 'me'; } };

// Elenco prestazioni del periodo (di base il mese aperto): ogni prestazione con descrizione
// e importo, e le cifre che ne risultano.
export default function ServicesDialog({ state, year, month, siteId = null, onClose }) {
  const sites = state.sites;
  const pad = (n) => String(n).padStart(2, '0');
  const [kind, setKindRaw] = useState(readKind);
  const setKind = (k) => { setKindRaw(k); try { localStorage.setItem(KIND_KEY, k); } catch {} };
  const forClient = kind === 'client';
  const [sel, setSel] = useState(siteId ?? sites[0]?.id ?? null);
  const [from, setFrom] = useState(`${year}-${pad(month)}-01`);
  const [to, setTo] = useState(`${year}-${pad(month)}-${pad(monthDays(year, month))}`);
  const [busy, setBusy] = useState(false);
  useLockBodyScroll();
  useBackClose(onClose);
  useEffect(() => { loadDoc().catch(() => {}); }, []); // pronto al tocco (condivisione su iPhone)

  const list = useMemo(() => (from && to && from <= to ? computeServiceList({
    shifts: state.shifts, sites, settings: state.settings, occasionalWork: state.occasionalWork,
    fromISO: from, toISO: to, siteId: sel, forClient,
  }) : null), [state.shifts, sites, state.settings, state.occasionalWork, from, to, sel, forClient]);
  const rivLabel = rivalsaLabel(state.settings);
  const opts = { headerLines: professionalHeaderLines(state.settings), rivalsaLabel: rivLabel, settings: state.settings };

  const run = async (format) => {
    if (!list) return;
    setBusy(true);
    try {
      const mod = await loadDoc();
      await (format === 'pdf' ? mod.exportServicesPdf(list, opts) : mod.exportServicesExcel(list, opts));
    } finally { setBusy(false); }
  };

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Elenco prestazioni</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="panel-desc">
          Ogni prestazione con data, descrizione, ore, tariffa e importo, raggruppata per sede, e in fondo i totali.
        </p>

        <div className="editor-label">Per chi è</div>
        <div className="site-picker" role="radiogroup" aria-label="Per chi è l'elenco">
          <button type="button" role="radio" aria-checked={!forClient} className={`site-pick-btn ${!forClient ? 'sel' : ''}`} onClick={() => setKind('me')}>
            📊 Per me / commercialista
          </button>
          <button type="button" role="radio" aria-checked={forClient} className={`site-pick-btn ${forClient ? 'sel' : ''}`} onClick={() => setKind('client')}>
            🧾 Da mandare al cliente
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          {forClient
            ? 'Una sola sede, senza tasse né netto, con le diciture da riportare in fattura e lo spazio per la firma.'
            : 'Tutte le sedi e le prestazioni occasionali, con contributi, tasse e netto stimati.'}
        </p>

        {forClient && <>
          <div className="editor-label">Cliente</div>
          {sites.length === 0 && <p className="hint hint-warn">Non hai ancora sedi: aggiungile in Altro → Sedi e paghe.</p>}
          <div className="site-picker">
            {sites.map((s) => (
              <button key={s.id} type="button" className={`site-pick-btn ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
                <span className="site-dot" style={{ background: s.color }} />{s.name}
              </button>
            ))}
          </div>
        </>}

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

        {list && (
          <div className="editor-breakdown">
            <div className="editor-breakdown-row"><span>Prestazioni</span><span>{list.count}</span></div>
            <div className="editor-breakdown-row"><span>Ore</span><span>{fmt(list.totalHours)}</span></div>
            <div className="editor-breakdown-row"><span>Compensi</span><span>€{fmt(list.revenue)}</span></div>
            {list.rivalsa > 0 && (
              <div className="editor-breakdown-row"><span>{rivLabel}</span><span>€{fmt(list.rivalsa)}</span></div>
            )}
            <div className="editor-breakdown-row total"><span>{forClient ? 'Totale da pagare' : 'Totale fatturato'}</span><span>€{fmt(list.invoice)}</span></div>
            {!forClient && <>
              {taxLines(list).map(([label, v]) => (
                <div key={label} className="editor-breakdown-row"><span>{label}</span><span>−€{fmt(v)}</span></div>
              ))}
              {list.occasional.length > 0 && (
                <div className="editor-breakdown-row"><span>Prestazioni occasionali (netto)</span><span>€{fmt(list.occasionalNet)}</span></div>
              )}
              <div className="editor-breakdown-row total"><span>{list.occasional.length ? 'Netto totale' : 'Netto stimato'}</span><span>€{fmt(list.netTotal)}</span></div>
            </>}
          </div>
        )}
        {list && list.count === 0 && <p className="hint hint-warn" style={{ marginTop: 10 }}>Nessuna prestazione in questo periodo{forClient ? ' per questo cliente' : ''}.</p>}
        {from > to && <p className="hint hint-warn" style={{ marginTop: 10 }}>La data di fine viene prima di quella di inizio.</p>}

        <div className="editor-actions">
          <button className="btn btn-primary btn-block" onClick={() => run('pdf')} disabled={!list || !list.count || busy}>⬇ PDF</button>
          <button className="btn btn-block" onClick={() => run('xlsx')} disabled={!list || !list.count || busy}>⬇ Excel</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
