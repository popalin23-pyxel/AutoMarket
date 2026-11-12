import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  QUESTIONS, answer, questionText, defaultParams, periodPresets, samePeriod, askSites,
} from '../lib/ask.js';
import { monthsWithData } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';

const MAX_THREAD = 30;

// un pezzo di risposta: testo normale, numero in evidenza, soldi che restano, grassetto
function Piece({ x }) {
  if (typeof x === 'string') return x;
  if (x.t === 'g') return <span className="ask-g">{x.v}</span>;
  if (x.t === 'n') return <span className="ask-n">{x.v}</span>;
  return <b>{x.v}</b>;
}

function Answer({ a, onNavigate }) {
  return (
    <div className="ask-a">
      {a.lines.map((line, i) => <p key={i}>{line.map((x, j) => <Piece key={j} x={x} />)}</p>)}
      {a.table && (
        <div className="ask-tab">
          {a.table.title && <div className="ask-tab-t">{a.table.title}</div>}
          {a.table.rows.map(([label, value], i) => <div key={i} className="ask-tab-r"><span>{label}</span><span>{value}</span></div>)}
        </div>
      )}
      {a.note && <p className="ask-note">{a.note}</p>}
      {a.action && (
        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => onNavigate(...a.action.route)}>{a.action.label}</button>
      )}
      <div className="ask-src"><Icon name="calc" size={13} /> Calcolato da Turnio con i tuoi dati</div>
    </div>
  );
}

// Chiedi a Turnio: si sceglie una domanda dall'elenco e la si completa con i tasti (periodo,
// sede). Le risposte le calcola l'app sul telefono (lib/ask.js): nessun dato esce da qui.
export default function AskPage({ state, now, onNavigate }) {
  const [thread, setThread] = useState([]); // [{ key, id, params }]
  const lastRef = useRef(null);
  const presets = useMemo(() => periodPresets(now), [now.getFullYear(), now.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps
  const sites = useMemo(() => askSites(state), [state.shifts, state.sites]);
  const months = useMemo(() => monthsWithData(state.shifts, state.occasionalWork ?? []), [state.shifts, state.occasionalWork]);

  const ask = (id, params) => setThread((t) => [...t, { key: `${Date.now()}-${t.length}`, id, params: params ?? defaultParams(id, now) }].slice(-MAX_THREAD));
  // la nuova domanda sale in cima allo schermo
  useEffect(() => { if (thread.length) lastRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }, [thread.length]);

  const last = thread[thread.length - 1];
  const lastQ = last && QUESTIONS.find((q) => q.id === last.id);
  const periodChoices = lastQ?.uses.period === 'years' ? presets.filter((p) => p.period.type !== 'month') : presets;
  const otherMonth = last?.params.period?.type === 'month' && !presets.some((p) => samePeriod(p.period, last.params.period));

  return (
    <>
      {thread.length === 0 && (
        <div className="ncard ask-intro">
          <span className="ask-intro-ic"><Icon name="spark" size={28} /></span>
          <h2>Chiedimi dei tuoi turni e dei tuoi soldi</h2>
          <p>Scegli una domanda qui sotto: la risposta la calcolo con i tuoi dati, qui sul telefono.</p>
        </div>
      )}

      <div className="ask-thread">
        {thread.map((ex, i) => (
          <React.Fragment key={ex.key}>
            <div className="ask-u" ref={i === thread.length - 1 ? lastRef : undefined}>{questionText(ex.id, ex.params, state, now)}</div>
            <Answer a={answer(ex.id, ex.params, state, now)} onNavigate={onNavigate} />
          </React.Fragment>
        ))}
      </div>

      {last && (lastQ.uses.period || (lastQ.uses.site && sites.length > 1)) && (
        <div className="ncard ask-refine">
          {lastQ.uses.period && (
            <>
              <div className="ask-refine-t">Cambia periodo</div>
              <div className="ask-chips">
                {periodChoices.map((p) => (
                  <button key={p.id} type="button" className={`ask-chip ${samePeriod(p.period, last.params.period) ? 'on' : ''}`}
                    onClick={() => !samePeriod(p.period, last.params.period) && ask(last.id, { ...last.params, period: p.period })}>
                    {p.label}
                  </button>
                ))}
                {lastQ.uses.period === 'any' && months.length > 0 && (
                  <select className={`ask-chip ask-select ${otherMonth ? 'on' : ''}`} aria-label="Scegli un altro mese"
                    value={otherMonth ? `${last.params.period.y}-${last.params.period.m}` : ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [y, m] = e.target.value.split('-').map(Number);
                      ask(last.id, { ...last.params, period: { type: 'month', y, m } });
                    }}>
                    <option value="">Altro mese…</option>
                    {months.map(({ year, month }) => <option key={`${year}-${month}`} value={`${year}-${month}`}>{MONTHS_IT[month - 1]} {year}</option>)}
                  </select>
                )}
              </div>
            </>
          )}
          {lastQ.uses.site && sites.length > 1 && (
            <>
              <div className="ask-refine-t">Cambia sede</div>
              <div className="ask-chips">
                <button type="button" className={`ask-chip ${last.params.siteId == null ? 'on' : ''}`}
                  onClick={() => last.params.siteId != null && ask(last.id, { ...last.params, siteId: null })}>Tutte</button>
                {sites.map((s) => (
                  <button key={s.id} type="button" className={`ask-chip ${last.params.siteId === s.id ? 'on' : ''}`}
                    onClick={() => last.params.siteId !== s.id && ask(last.id, { ...last.params, siteId: s.id })}>
                    <span className="site-dot" style={{ background: s.color }} />{s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grp-title">{thread.length ? 'Un’altra domanda' : 'Scegli una domanda'}</div>
      <div className="lcard">
        {QUESTIONS.map((q) => (
          <button key={q.id} type="button" className="lrow ask-q" onClick={() => ask(q.id)}>
            <span className="ask-q-e">{q.emoji}</span>
            <span className="lrow-tx"><span className="lrow-t" style={{ display: 'block' }}>{q.title}</span></span>
            <span className="lrow-end"><Icon name="chevronRight" size={19} /></span>
          </button>
        ))}
      </div>
      {thread.length > 0 && (
        <button type="button" className="link-btn ask-reset" onClick={() => { setThread([]); window.scrollTo(0, 0); }}>Ricomincia da capo</button>
      )}
    </>
  );
}
