import React, { useMemo, useState } from 'react';
import { computeMonthSummary, computeYearSummary, todayISO, isShiftDone } from '../lib/calc.js';
import { updateFiscalSettings, updateSettings } from '../lib/store.js';
import { PENSION_FUNDS, PROFESSIONAL_ROLES, suggestedFund, rivalsaLabel, roleLabel } from '../lib/defaults.js';
import NumberInput from './NumberInput.jsx';
import Icon from './icons/Icon.jsx';

const fmt = (n) => (n || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 2 });

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
  const [more, setMore] = useState(false);
  const { settings } = state;
  const exact = settings.taxMode === 'forfettario';
  const fundId = settings.pensionFund || '';
  const fund = PENSION_FUNDS.find((f) => f.id === fundId) ?? null;
  const forRole = suggestedFund(settings); // la cassa di solito giusta per il lavoro scelto

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
  // scegliendo il lavoro, se la cassa non è ancora scelta si propone quella giusta (es. infermiere → ENPAPI)
  const chooseRole = (id) => {
    const f = !fundId ? PENSION_FUNDS.find((x) => x.id === suggestedFund({ professionalRole: id })) : null;
    setState((s) => updateFiscalSettings(s, { professionalRole: id, ...(f ? { pensionFund: f.id, ...fundPatch(f) } : {}) }));
  };
  // la formula esatta c'è solo per il forfettario: sceglierla vuol dire regime forfettario
  const chooseExact = () => patch({ fiscalRegime: 'forfettario', taxMode: 'forfettario' });

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
          {/* Le tre scelte che bastano: che lavoro fai, la cassa, come calcolare le tasse */}
          <div className="fs-step"><span className="sheet-sn">1</span>Che lavoro fai</div>
          <div className="fs-chips">
            {PROFESSIONAL_ROLES.map((r) => (
              <button key={r.id} type="button" className={`fs-chip ${settings.professionalRole === r.id ? 'on' : ''}`}
                aria-pressed={settings.professionalRole === r.id} onClick={() => chooseRole(r.id)}>
                {r.id === 'altro' ? 'Altro' : r.label}
              </button>
            ))}
          </div>
          {settings.professionalRole === 'altro' && (
            <input type="text" className="fs-other" value={settings.professionalRoleOther || ''} placeholder="Quale? Es. Ostetrica, Logopedista"
              onChange={(e) => patchSettings({ professionalRoleOther: e.target.value })} aria-label="Specifica il lavoro" />
          )}

          <div className="fs-step"><span className="sheet-sn">2</span>La tua cassa</div>
          <div className="pay-opts">
            {PENSION_FUNDS.map((f) => (
              <label key={f.id} className={`pay-opt ${fundId === f.id ? 'sel' : ''}`}>
                <input type="radio" name="fund" checked={fundId === f.id} onChange={() => chooseFund(f.id)} />
                <span className="pay-opt-tx">
                  <b>{f.label}{f.who ? <span className="fs-who"> · {f.who}</span> : null}
                    {forRole === f.id && <span className="fs-tag">Per il tuo lavoro</span>}
                  </b>
                  <small>{f.short}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="fs-step"><span className="sheet-sn">3</span>Come calcolare le tasse</div>
          <div className="pay-opts">
            <label className={`pay-opt ${exact ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={exact} onChange={chooseExact} />
              <span className="pay-opt-tx">
                <b>Forfettario, formula esatta <span className="fs-tag">Consigliato</span></b>
                <small>Come il commercialista: reddito = compensi × {pct(settings.coefficientPercent ?? 78)}%, meno i contributi; sul resto l’imposta sostitutiva.</small>
                {exact && (
                  <span className="fs-sub" onClick={(e) => e.preventDefault()}>
                    <span className="fs-sub-t">Imposta sostitutiva</span>
                    <span className="seg fs-seg">
                      <button type="button" className={Number(settings.forfTaxRatePercent) === 5 ? 'on' : ''} onClick={() => patch({ forfTaxRatePercent: 5 })}>5% · primi 5 anni</button>
                      <button type="button" className={Number(settings.forfTaxRatePercent) === 15 ? 'on' : ''} onClick={() => patch({ forfTaxRatePercent: 15 })}>15%</button>
                    </span>
                    {![5, 15].includes(Number(settings.forfTaxRatePercent)) && (
                      <small>Ora è al {pct(settings.forfTaxRatePercent)}% (cambiala nei valori qui sotto).</small>
                    )}
                  </span>
                )}
              </span>
            </label>
            <label className={`pay-opt ${!exact ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={!exact} onChange={() => patch({ taxMode: 'semplice' })} />
              <span className="pay-opt-tx">
                <b>Semplice: una percentuale fissa</b>
                <small>Metti da parte la stessa percentuale di tutto il fatturato, che decidi tu.</small>
                {!exact && (
                  <span className="fs-sub fs-simple" onClick={(e) => e.preventDefault()}>
                    <span className="field">
                      <span className="field-label">Imposta (%)</span>
                      <NumberInput value={settings.taxRatePercent} onChange={(v) => patch({ taxRatePercent: v })} min={0} max={100} />
                    </span>
                    <span className="field">
                      <span className="field-label">Contributi (%)</span>
                      <NumberInput value={settings.contributionsPercent} onChange={(v) => patch({ contributionsPercent: v })} min={0} max={100} />
                    </span>
                    <small>Totale da mettere da parte: <b>{pct((Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0))}%</b> del fatturato.</small>
                  </span>
                )}
              </span>
            </label>
          </div>

          <p className="fs-summary">
            {[roleLabel(settings), fund && fund.id !== 'altro' ? fund.label : '', exact ? `forfettario, imposta ${pct(settings.forfTaxRatePercent)}%` : `${pct((Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0))}% da mettere da parte`].filter(Boolean).join(' · ')}
            {Number(settings.rivalsaPercent) > 0 && <> · in fattura +{pct(settings.rivalsaPercent)}% di {settings.rivalsaType === 'integrativo' ? 'integrativo' : 'rivalsa'}</>}
          </p>

          <button type="button" className="fs-more" onClick={() => setMore(!more)} aria-expanded={more}>
            <span>Valori nel dettaglio</span>
            <Icon name="chevronDown" size={18} style={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {more && (
            <div className="fs-detail">
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

              {exact && (
                <>
                  <div className="form-row">
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
                {!exact && ' Nel calcolo semplice resta compreso nel fatturato tassato.'}
                {' '}Vale per le sedi pagate "+ %" e per quelle omnicomprensive; una sede può avere una percentuale sua (Altro → Sedi e paghe).
              </p>

              {fund?.info && (
                <>
                  <div className="editor-label" style={{ marginTop: 16 }}>Cosa prevede {fund.id === 'altro' ? 'la cassa' : fund.label}</div>
                  <ul className="fund-info">{fund.info.map((t) => <li key={t}>{t}</li>)}</ul>
                </>
              )}
            </div>
          )}

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
