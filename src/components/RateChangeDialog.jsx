import React, { useState } from 'react';
import { todayISO, siteRateOn, scheduledRateChange, addDaysISO } from '../lib/calc.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import NumberInput from './NumberInput.jsx';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cambio della paga oraria di una sede: da una certa data in poi (i turni precedenti
// restano con la tariffa di allora) oppure come correzione su tutti i turni.
export default function RateChangeDialog({ site, onSave, onClose }) {
  const today = todayISO();
  const currentRate = siteRateOn(site, today);
  // se c'è già un cambio fissato nel futuro, si propone di modificare quello (stessa data):
  // partire da oggi anticiperebbe la nuova tariffa anche ai turni intermedi
  const scheduled = scheduledRateChange(site, today);
  const [rate, setRate] = useState(scheduled ? scheduled.rate : currentRate);
  const [mode, setMode] = useState('from'); // 'from' | 'all'
  const [from, setFrom] = useState(scheduled ? scheduled.from : today);
  const rateBefore = from ? siteRateOn(site, addDaysISO(from, -1)) : currentRate;
  useLockBodyScroll();
  useBackClose(onClose);

  const valid = rate !== '' && rate != null && (mode === 'all' || !!from);
  const save = () => { if (valid) onSave(Number(rate) || 0, mode === 'from' ? from : null); };

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Paga oraria · {site.name}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="panel-desc">
          Oggi: €{fmt(currentRate)}/h
          {scheduled && <> · già fissato: <b>€{fmt(scheduled.rate)}/h dal {scheduled.from.split('-').reverse().join('/')}</b> (qui puoi modificarlo)</>}
        </p>

        <div className="field" style={{ maxWidth: 160 }}>
          <label className="field-label">Nuova paga oraria (€)</label>
          <NumberInput value={rate} onChange={setRate} min={0} max={999} allowEmpty />
        </div>

        <div className="editor-label">Da quando vale</div>
        <div className="rate-mode">
          <label className={`rate-mode-opt ${mode === 'from' ? 'sel' : ''}`}>
            <input type="radio" name="rate-mode" checked={mode === 'from'} onChange={() => setMode('from')} />
            <span>
              <b>Dai turni del</b>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setMode('from'); }} />
              <small>I turni prima di questa data restano a €{fmt(rateBefore)}/h, come nelle fatture già fatte.</small>
            </span>
          </label>
          <label className={`rate-mode-opt ${mode === 'all' ? 'sel' : ''}`}>
            <input type="radio" name="rate-mode" checked={mode === 'all'} onChange={() => setMode('all')} />
            <span>
              <b>Correzione: per tutti i turni</b>
              <small>Se avevi scritto la cifra sbagliata. Cambiano anche i mesi passati.</small>
            </span>
          </label>
        </div>

        <div className="editor-actions">
          <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>Salva</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
