import React, { useState } from 'react';
import { todayISO, sitePayOn, scheduledRateChange, addDaysISO, payPercent } from '../lib/calc.js';
import { SITE_COLORS } from '../lib/defaults.js';
import { choiceOf, termsOf, payChoices, hourText, payText, defaultPercent, extraName, pctText } from '../lib/payOptions.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import NumberInput from './NumberInput.jsx';
import Icon from './icons/Icon.jsx';

const fmtDay = (iso) => iso.split('-').reverse().join('/');

// Stessa paga in pratica (stessa tariffa, stesso modo, stessa % effettiva).
const samePay = (a, b, settings) => (Number(a.rate) || 0) === (Number(b.rate) || 0)
  && (a.payMode === 'inclusive') === (b.payMode === 'inclusive')
  && payPercent(a.rivalsaPercent, settings) === payPercent(b.rivalsaPercent, settings);

// Nuova sede o modifica di una sede: nome, colore, paga oraria e come paga
// ("+ 4%" in fattura, omnicomprensiva, altra percentuale). Se la paga cambia e la sede ha già
// turni si chiede da quando vale, come nelle fatture già fatte.
export default function SiteEditor({ site, state, onSubmit, onClose, onDetails, onArchive }) {
  const settings = state.settings;
  const isNew = !site;
  const today = todayISO();
  const scheduled = site ? scheduledRateChange(site, today) : null;
  // con un cambio già fissato nel futuro si modifica quello (stessa data)
  const initial = site ? sitePayOn(site, scheduled ? null : today) : { rate: '', payMode: 'plus', rivalsaPercent: null };
  const def = defaultPercent(settings);
  const choices = payChoices(settings);

  const [name, setName] = useState(site?.name ?? '');
  const [color, setColor] = useState(site?.color ?? SITE_COLORS[state.sites.length % SITE_COLORS.length]);
  const [rate, setRate] = useState(initial.rate);
  const [choice, setChoice] = useState(() => {
    const c = choiceOf(initial, settings);
    return choices.includes(c) ? c : 'custom';
  });
  const [customPct, setCustomPct] = useState(initial.rivalsaPercent ?? def);
  const [customIncl, setCustomIncl] = useState(initial.payMode === 'inclusive');
  const [when, setWhen] = useState('from'); // 'from' | 'all'
  const [from, setFrom] = useState(scheduled ? scheduled.from : today);
  const [error, setError] = useState('');
  useLockBodyScroll();
  useBackClose(onClose);

  const hasRate = rate !== '' && rate != null;
  const termsFor = (c) => termsOf(c, rate, settings, { pct: customPct, inclusive: customIncl });
  const terms = termsFor(choice);
  const payChanged = !isNew && !samePay(terms, initial, settings);
  const hasShifts = !isNew && state.shifts.some((sh) => sh.siteId === site.id);
  const askWhen = payChanged && hasShifts;
  const before = site && from ? sitePayOn(site, addDaysISO(from, -1)) : initial;
  const extra = extraName(settings);

  const save = () => {
    const n = name.trim();
    if (!n) { setError('Scrivi il nome della sede.'); return; }
    if (!hasRate) { setError('Scrivi la paga oraria (anche 0, se non è pagata).'); return; }
    if (askWhen && when === 'from' && !from) { setError('Scegli da quando vale la nuova paga.'); return; }
    onSubmit({ name: n, color, terms, payChanged, from: askWhen && when === 'from' ? from : null });
  };

  const option = (c) => {
    const t = termsFor(c);
    const title = c === 'plus' ? `+ ${pctText(def)} in fattura`
      : c === 'inclusive' ? 'Omnicomprensiva'
        : c === 'none' ? 'Senza maggiorazione' : 'Altra percentuale';
    const what = c === 'plus' ? `Alla paga si aggiunge il ${pctText(def)} di ${extra}.`
      : c === 'inclusive' ? `Il ${pctText(def)} di ${extra} è già dentro la paga.`
        : c === 'none' ? 'In fattura c’è solo la paga oraria.'
          : (settings.rivalsaType === 'integrativo' ? 'Per esempio il 2% verso la pubblica amministrazione.' : 'Una percentuale diversa per questa sede.');
    return (
      <label key={c} className={`pay-opt ${choice === c ? 'sel' : ''}`}>
        <input type="radio" name="pay-choice" checked={choice === c} onChange={() => setChoice(c)} />
        <span className="pay-opt-tx">
          <b>{title}</b>
          <small>{what}</small>
          {c === 'custom' && choice === 'custom' && (
            <span className="pay-custom" onClick={(e) => e.preventDefault()}>
              <span className="pay-pct">
                <NumberInput value={customPct} onChange={(v) => setCustomPct(v ?? 0)} min={0} max={100} aria-label="Percentuale" />
                <span>%</span>
              </span>
              <span className="seg pay-seg">
                <button type="button" className={!customIncl ? 'on' : ''} onClick={() => setCustomIncl(false)}>Si aggiunge</button>
                <button type="button" className={customIncl ? 'on' : ''} onClick={() => setCustomIncl(true)}>Già compresa</button>
              </span>
            </span>
          )}
          {hasRate && choice === c && <span className="pay-hour">{hourText(t, settings)}</span>}
        </span>
      </label>
    );
  };

  return (
    <Portal>
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet site-sheet" role="dialog" aria-label={isNew ? 'Nuova sede' : `Modifica ${site.name}`} onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-head">
            <h2>{isNew ? 'Nuova sede' : 'Modifica sede'}</h2>
            <button type="button" className="round-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" size={20} /></button>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="site-name">Nome</label>
            <input id="site-name" type="text" value={name} placeholder="Es. CDS, Villa Rosa…" autoComplete="off"
              onChange={(e) => { setName(e.target.value); setError(''); }} />
          </div>

          <div className="field-label site-sheet-lbl">Colore</div>
          <div className="site-colors">
            {SITE_COLORS.map((c) => (
              <button key={c} type="button" className={`site-color ${color === c ? 'sel' : ''}`} style={{ '--c': c }}
                onClick={() => setColor(c)} aria-label={`Colore ${c}`} aria-pressed={color === c} />
            ))}
          </div>

          <div className="field-label site-sheet-lbl">Paga oraria</div>
          <div className="pay-rate">
            <span className="pay-rate-cur">€</span>
            <NumberInput value={rate} onChange={(v) => { setRate(v); setError(''); }} min={0} max={999} allowEmpty
              placeholder="0,00" aria-label="Paga oraria in euro" />
            <span className="pay-rate-unit">l’ora</span>
          </div>

          <div className="field-label site-sheet-lbl">Come ti paga</div>
          <div className="pay-opts">{choices.map(option)}</div>

          {askWhen && (
            <>
              <div className="field-label site-sheet-lbl">Da quando vale la nuova paga</div>
              {scheduled && (
                <p className="site-sheet-note">Già fissato: <b>{payText(initial, settings)} dal {fmtDay(scheduled.from)}</b>. Qui puoi modificarlo.</p>
              )}
              <div className="pay-opts">
                <label className={`pay-opt ${when === 'from' ? 'sel' : ''}`}>
                  <input type="radio" name="pay-when" checked={when === 'from'} onChange={() => setWhen('from')} />
                  <span className="pay-opt-tx">
                    <b>Dai turni del</b>
                    <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setWhen('from'); }} />
                    <small>I turni prima restano a {payText(before, settings)}, come nelle fatture già fatte.</small>
                  </span>
                </label>
                <label className={`pay-opt ${when === 'all' ? 'sel' : ''}`}>
                  <input type="radio" name="pay-when" checked={when === 'all'} onChange={() => setWhen('all')} />
                  <span className="pay-opt-tx">
                    <b>Correzione: per tutti i turni</b>
                    <small>Se avevi scritto una cifra sbagliata. Cambiano anche i mesi passati.</small>
                  </span>
                </label>
              </div>
            </>
          )}

          {error && <p className="hint hint-warn" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}

          <button type="button" className="btn btn-primary btn-block site-sheet-save" onClick={save}>
            {isNew ? 'Aggiungi la sede' : 'Salva'}
          </button>
          {!isNew && (
            <div className="site-sheet-more">
              <button type="button" className="btn" onClick={onDetails}><Icon name="clipboard" size={17} /> Scheda struttura</button>
              <button type="button" className="btn" onClick={onArchive}><Icon name="archive" size={17} /> Archivia</button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
