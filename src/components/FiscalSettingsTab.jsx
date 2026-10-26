import React, { useMemo, useState } from 'react';
import { computeMonthSummary, computeYearSummary, todayISO, isShiftDone } from '../lib/calc.js';
import { updateFiscalSettings, updateSettings } from '../lib/store.js';
import { PENSION_FUNDS, suggestedFund, rivalsaLabel } from '../lib/defaults.js';
import NumberInput from './NumberInput.jsx';
import Icon from './icons/Icon.jsx';

const fmt = (n) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });

const REGIMES = [
  { id: 'forfettario', label: 'Forfettario' },
  { id: 'ordinario', label: 'Ordinario' },
  { id: 'altro', label: 'Altro' },
];

// Valori della cassa scelta (contributi per il calcolo forfettario, maggiorazione in fattura).
const fundPatch = (fund) => (fund && fund.forfContributionsPercent != null
  ? { forfContributionsPercent: fund.forfContributionsPercent, rivalsaPercent: fund.rivalsaPercent, rivalsaType: fund.rivalsaType }
  : {});

export default function FiscalSettingsTab({ state, setState }) {
  const [sub, setSub] = useState('params');
  const { settings } = state;
  const exact = settings.taxMode === 'forfettario';
  const fundId = settings.pensionFund || '';
  const fund = PENSION_FUNDS.find((f) => f.id === fundId) ?? null;
  const suggested = !fundId ? PENSION_FUNDS.find((f) => f.id === suggestedFund(settings)) : null;

  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const example = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, y, m),
    [state.shifts, state.sites, state.settings, y, m],
  );
  // "nell'anno, finora": solo i turni già svolti (non quelli in programma)
  const yearSum = useMemo(() => {
    const now = new Date();
    return computeYearSummary(state.shifts.filter((s) => isShiftDone(s, now)), state.sites, state.settings, y);
  }, [state.shifts, state.sites, state.settings, y]);

  const patch = (p) => setState((s) => updateFiscalSettings(s, p));
  const patchSettings = (p) => setState((s) => updateSettings(s, p));
  const chooseFund = (id) => {
    const f = PENSION_FUNDS.find((x) => x.id === id);
    patch({ pensionFund: id, ...fundPatch(f) });
  };

  const occasionalYearGross = useMemo(
    () => state.occasionalWork.filter((o) => (o.date || '').slice(0, 4) === String(y))
      .reduce((a, o) => a + (Number(o.grossAmount) || 0), 0),
    [state.occasionalWork, y],
  );

  const riv = rivalsaLabel(settings);

  return (
    <div className="panel">
      <h2 className="panel-title">Impostazioni fiscali</h2>

      <div className="theme-switch" style={{ margin: '10px 0 14px' }}>
        <button className={`theme-opt ${sub === 'params' ? 'active' : ''}`} onClick={() => setSub('params')}>Parametri</button>
        <button className={`theme-opt ${sub === 'details' ? 'active' : ''}`} onClick={() => setSub('details')}>Come si calcola</button>
      </div>

      {sub === 'details' ? (
        <>
          <p className="panel-desc">
            Come Turnio arriva al netto stimato ({exact ? 'formula del regime forfettario' : 'calcolo semplice'}),
            con i tuoi numeri del mese in corso come esempio.
          </p>
          {exact ? (
            <div className="fiscal-flow">
              <div className="fiscal-flow-row"><span>Compensi (ore × paga)</span><span className="mono">€{fmt(example.totalRevenue)}</span></div>
              <div className="fiscal-flow-row sub">
                <span>+ {riv} in fattura{settings.rivalsaType === 'integrativo' ? ' (va alla cassa)' : ''}</span>
                <span className="mono">€{fmt(example.totalRivalsa)}</span>
              </div>
              <div className="fiscal-flow-row"><span>= Fatturato</span><span className="mono">€{fmt(example.totalInvoice)}</span></div>
              <div className="fiscal-flow-row sub">
                <span>Reddito imponibile: {settings.rivalsaType === 'integrativo' ? 'compensi' : 'compensi + rivalsa'} × {pct(settings.coefficientPercent)}%</span>
                <span className="mono">€{fmt(example.taxable)}</span>
              </div>
              <div className="fiscal-flow-row sub">
                <span>− Contributi {fund && fund.id !== 'altro' ? fund.label : 'previdenziali'} ({pct(settings.forfContributionsPercent)}% del reddito)</span>
                <span className="mono">−€{fmt(example.contributions)}</span>
              </div>
              <div className="fiscal-flow-row sub">
                <span>− Imposta sostitutiva ({pct(settings.forfTaxRatePercent)}% di reddito − contributi)</span>
                <span className="mono">−€{fmt(example.incomeTax)}</span>
              </div>
              {example.integrativo > 0 && (
                <div className="fiscal-flow-row sub">
                  <span>− Integrativo da versare alla cassa</span>
                  <span className="mono">−€{fmt(example.integrativo)}</span>
                </div>
              )}
              <div className="fiscal-flow-row total"><span>= Netto stimato</span><span className="mono">€{fmt(example.net)}</span></div>
            </div>
          ) : (
            <div className="fiscal-flow">
              <div className="fiscal-flow-row">
                <span>Fatturato ({REGIMES.find((r) => r.id === settings.fiscalRegime)?.label ?? 'regime'})</span>
                <span className="mono">€{fmt(example.totalInvoice)}</span>
              </div>
              <div className="fiscal-flow-row sub">
                <span>− Aliquota imposta ({pct(settings.taxRatePercent)}% del fatturato)</span>
                <span className="mono">−€{fmt(example.incomeTax)}</span>
              </div>
              <div className="fiscal-flow-row sub">
                <span>− Contributi ({pct(settings.contributionsPercent)}% del fatturato)</span>
                <span className="mono">−€{fmt(example.contributions)}</span>
              </div>
              <div className="fiscal-flow-row total"><span>= Netto stimato</span><span className="mono">€{fmt(example.net)}</span></div>
            </div>
          )}

          {exact && yearSum.months.length > 0 && (
            <>
              <h2 className="panel-title" style={{ marginTop: 20 }}>Nell'anno {y}, finora</h2>
              <div className="fiscal-flow">
                <div className="fiscal-flow-row"><span>Reddito imponibile</span><span className="mono">€{fmt(yearSum.totalTaxable)}</span></div>
                <div className="fiscal-flow-row sub"><span>Contributi stimati</span><span className="mono">€{fmt(yearSum.totalContributions)}</span></div>
                <div className="fiscal-flow-row sub"><span>Imposta sostitutiva stimata</span><span className="mono">€{fmt(yearSum.totalIncomeTax)}</span></div>
                {yearSum.totalIntegrativo > 0 && (
                  <div className="fiscal-flow-row sub"><span>Integrativo incassato da versare</span><span className="mono">€{fmt(yearSum.totalIntegrativo)}</span></div>
                )}
              </div>
              {fund?.info && (
                <ul className="fund-info">{fund.info.map((t) => <li key={t}>{t}</li>)}</ul>
              )}
            </>
          )}

          <div className="hint hint-info" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, marginBottom: 0 }}>
            <Icon name="hourglass" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Il netto è una <b>stima</b>: non sostituisce il calcolo del tuo commercialista.
              {exact
                ? ' Nel forfettario si tassano i compensi incassati e si deducono i contributi versati nell\'anno; qui, per stimare mese per mese, si usano i turni e i contributi dello stesso periodo. I minimi annuali della cassa non sono compresi.'
                : ' Usa la percentuale che imposti qui e non tiene conto di deduzioni o casi particolari del tuo regime.'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Regime fiscale</label>
            <select value={settings.fiscalRegime} onChange={(e) => patch({
              fiscalRegime: e.target.value,
              // la formula esatta vale solo per il forfettario
              ...(e.target.value !== 'forfettario' && exact ? { taxMode: 'semplice' } : {}),
            })}>
              {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label className="field-label">Cassa previdenziale</label>
            <select value={fundId} onChange={(e) => chooseFund(e.target.value)}>
              <option value="">— scegli —</option>
              {PENSION_FUNDS.map((f) => <option key={f.id} value={f.id}>{f.label}{f.who ? ` (${f.who})` : ''}</option>)}
            </select>
          </div>
          {suggested && (
            <button className="link-btn" style={{ marginBottom: 10 }} onClick={() => chooseFund(suggested.id)}>
              Per il tuo ruolo di solito è {suggested.label}: usa questa →
            </button>
          )}
          {fund && (
            <ul className="fund-info">{fund.info.map((t) => <li key={t}>{t}</li>)}</ul>
          )}

          <div className="editor-label" style={{ marginTop: 16 }}>Come calcolare tasse e contributi</div>
          <div className="rate-mode">
            <label className={`rate-mode-opt ${!exact ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={!exact} onChange={() => patch({ taxMode: 'semplice' })} />
              <span>
                <b>Semplice (come finora)</b>
                <small>Una percentuale fissa di tutto il fatturato, che decidi tu.</small>
              </span>
            </label>
            <label className={`rate-mode-opt ${exact ? 'sel' : ''} ${settings.fiscalRegime !== 'forfettario' ? 'disabled' : ''}`}>
              <input type="radio" name="tax-mode" checked={exact} disabled={settings.fiscalRegime !== 'forfettario'}
                onChange={() => patch({ taxMode: 'forfettario' })} />
              <span>
                <b>Forfettario, formula esatta</b>
                <small>
                  Reddito = compensi × coefficiente (78% per le professioni sanitarie), meno i contributi della cassa;
                  sul resto l'imposta sostitutiva. L'integrativo della cassa non conta come guadagno.
                  {settings.fiscalRegime !== 'forfettario' && ' Disponibile solo con il regime forfettario.'}
                </small>
              </span>
            </label>
          </div>

          {exact ? (
            <>
              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="field">
                  <label className="field-label">Imposta sostitutiva (%)</label>
                  <NumberInput value={settings.forfTaxRatePercent} onChange={(v) => patch({ forfTaxRatePercent: v })} min={0} max={100} />
                </div>
                <div className="field">
                  <label className="field-label">Contributi (% del reddito)</label>
                  <NumberInput value={settings.forfContributionsPercent} onChange={(v) => patch({ forfContributionsPercent: v })} min={0} max={100} />
                </div>
                <div className="field">
                  <label className="field-label">Coefficiente (%)</label>
                  <NumberInput value={settings.coefficientPercent} onChange={(v) => patch({ coefficientPercent: v })} min={0} max={100} />
                </div>
              </div>
              <p className="panel-desc" style={{ marginBottom: 14 }}>
                Imposta: 5% per i primi 5 anni di attività se hai i requisiti, poi 15%. Coefficiente: 78% per le attività sanitarie.
              </p>
            </>
          ) : (
            <>
              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="field">
                  <label className="field-label">Aliquota imposta (% del fatturato)</label>
                  <NumberInput value={settings.taxRatePercent} onChange={(v) => patch({ taxRatePercent: v })} min={0} max={100} />
                </div>
                <div className="field">
                  <label className="field-label">Contributi (% del fatturato)</label>
                  <NumberInput value={settings.contributionsPercent} onChange={(v) => patch({ contributionsPercent: v })} min={0} max={100} />
                </div>
              </div>
              <div className="hint hint-info" style={{ marginBottom: 14 }}>
                Totale accantonato sul fatturato: <b>{pct((Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0))}%</b>.
              </div>
            </>
          )}

          <div className="editor-label">Maggiorazione in fattura</div>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 140 }}>
              <label className="field-label">Percentuale (%)</label>
              <NumberInput value={settings.rivalsaPercent} onChange={(v) => patch({ rivalsaPercent: v })} min={0} max={100} />
            </div>
            <div className="field">
              <label className="field-label">Che cos'è</label>
              <select value={settings.rivalsaType || 'rivalsa'} onChange={(e) => patch({ rivalsaType: e.target.value })}>
                <option value="integrativo">Contributo integrativo della cassa (es. ENPAPI)</option>
                <option value="rivalsa">Rivalsa INPS (fa parte del compenso)</option>
              </select>
            </div>
          </div>
          <p className="panel-desc" style={{ marginBottom: 0 }}>
            {settings.rivalsaType === 'integrativo'
              ? 'Lo paga la struttura e lo versi alla cassa: non è un tuo guadagno.'
              : 'Fa parte del compenso e si tassa.'}
            {!exact && ' Nel calcolo semplice resta compreso nel fatturato tassato, come finora.'}
            {' '}Ogni sede può avere una percentuale diversa (Altro → Sedi e paghe).
          </p>

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
