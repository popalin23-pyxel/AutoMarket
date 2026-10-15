import React, { useMemo, useState } from 'react';
import { computeMonthSummary, todayISO } from '../lib/calc.js';
import { updateFiscalSettings, updateSettings } from '../lib/store.js';
import NumberInput from './NumberInput.jsx';
import Icon from './icons/Icon.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REGIMES = [
  { id: 'forfettario', label: 'Forfettario' },
  { id: 'ordinario', label: 'Ordinario' },
  { id: 'altro', label: 'Altro' },
];

export default function FiscalSettingsTab({ state, setState, onBack }) {
  const [sub, setSub] = useState('details');
  const { settings } = state;

  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const example = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, y, m),
    [state.shifts, state.sites, state.settings, y, m],
  );

  const patch = (p) => setState((s) => updateFiscalSettings(s, p));
  const patchSettings = (p) => setState((s) => updateSettings(s, p));

  const occasionalYearGross = useMemo(
    () => state.occasionalWork.filter((o) => (o.date || '').slice(0, 4) === String(y))
      .reduce((a, o) => a + (Number(o.grossAmount) || 0), 0),
    [state.occasionalWork, y],
  );

  return (
    <div className="panel">
      {onBack && <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>‹ Profilo</button>}
      <h2 className="panel-title">Impostazioni fiscali</h2>

      <div className="tabs">
        <button className={`tab ${sub === 'details' ? 'active' : ''}`} onClick={() => setSub('details')}>Dettagli calcolo</button>
        <button className={`tab ${sub === 'params' ? 'active' : ''}`} onClick={() => setSub('params')}>Parametri</button>
      </div>

      {sub === 'details' ? (
        <>
          <p className="panel-desc">Come Turnio arriva al netto stimato, con i tuoi numeri del mese in corso come esempio.</p>
          <div className="fiscal-flow">
            <div className="fiscal-flow-row">
              <span>Fatturato ({REGIMES.find((r) => r.id === settings.fiscalRegime)?.label ?? 'regime'})</span>
              <span className="mono">€{fmt(example.totalInvoice)}</span>
            </div>
            <div className="fiscal-flow-row sub">
              <span>− Aliquota imposta ({settings.taxRatePercent}%)</span>
              <span className="mono">−€{fmt(example.totalInvoice * (settings.taxRatePercent / 100))}</span>
            </div>
            <div className="fiscal-flow-row sub">
              <span>− Contributi ENPAPI/INPS ({settings.contributionsPercent}%)</span>
              <span className="mono">−€{fmt(example.totalInvoice * (settings.contributionsPercent / 100))}</span>
            </div>
            <div className="fiscal-flow-row total">
              <span>= Netto stimato</span>
              <span className="mono">€{fmt(example.net)}</span>
            </div>
          </div>

          <div className="hint hint-info" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, marginBottom: 0 }}>
            <Icon name="hourglass" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Il netto è una <b>stima</b> basata sulla percentuale che imposti qui: non sostituisce il calcolo
              del tuo commercialista e non tiene conto di ogni deduzione o caso particolare del tuo regime fiscale.
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="panel-desc">
            L'aliquota imposta e i contributi si sommano nella percentuale totale accantonata sul fatturato.
            Chiedi al tuo commercialista i valori corretti per la tua situazione.
          </p>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Regime fiscale</label>
            <select value={settings.fiscalRegime} onChange={(e) => patch({ fiscalRegime: e.target.value })}>
              {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label">Aliquota imposta (%)</label>
              <NumberInput value={settings.taxRatePercent} onChange={(v) => patch({ taxRatePercent: v })} min={0} max={100} />
            </div>
            <div className="field">
              <label className="field-label">Contributi ENPAPI/INPS (%)</label>
              <NumberInput value={settings.contributionsPercent} onChange={(v) => patch({ contributionsPercent: v })} min={0} max={100} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Rivalsa default (%)</label>
            <NumberInput value={settings.rivalsaPercent} onChange={(v) => patch({ rivalsaPercent: v })} min={0} max={100} />
          </div>

          <div className="hint hint-info" style={{ marginBottom: 0 }}>
            Totale accantonato sul fatturato: <b>{(Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0)}%</b>.
            Ogni sede può avere una rivalsa diversa da quella di default (scheda "Sedi").
          </div>

          <h2 className="panel-title" style={{ marginTop: 22 }}>Prestazioni occasionali</h2>
          <p className="panel-desc">
            Reddito diverso dal lavoro nelle sedi (es. consulenze, corsi) — niente rivalsa, e si tassa secondo
            gli scaglioni IRPEF ordinari invece dell'aliquota del regime forfettario, che vale solo per il
            fatturato da partita IVA.
          </p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Aliquota stimata da accantonare (%)</label>
            <NumberInput value={settings.occasionalTaxRatePercent} onChange={(v) => patchSettings({ occasionalTaxRatePercent: v })} min={0} max={100} />
          </div>
          <div className="hint hint-info" style={{ marginBottom: 0 }}>
            È solo una stima (23% = primo scaglione IRPEF): l'aliquota reale dipende dal tuo reddito complessivo
            e si calcola in dichiarazione dei redditi — verificala col commercialista.
            {occasionalYearGross > 0 && (
              <> Nel {y} hai dichiarato finora <b>€{fmt(occasionalYearGross)}</b> di prestazioni occasionali
                {occasionalYearGross > 5000 ? ', sopra la soglia di €5.000: oltre questa cifra potrebbe essere dovuto il contributo INPS Gestione Separata.' : ' (soglia €5.000/anno oltre la quale potrebbe servire il contributo INPS Gestione Separata).'}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
