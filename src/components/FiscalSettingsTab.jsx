import React, { useMemo, useState } from 'react';
import {
  computeMonthSummary, computeYearSummary, todayISO, isShiftDone,
  computeOrdinarioYear, computeForfettarioYear, annualRevenueOf, isInpsArtCom, DEFAULT_ANNUAL_REVENUE,
} from '../lib/calc.js';
import { updateFiscalSettings, updateSettings } from '../lib/store.js';
import { PENSION_FUNDS, PROFESSIONAL_ROLES, suggestedFund, suggestedCoefficient, rivalsaLabel, roleLabel } from '../lib/defaults.js';
import {
  TAX_YEAR, TAX_RATES_CHECKED, FORFETTARIO, REGIONS, MUNICIPALITIES, IRPEF_BRACKETS,
  INPS_GESTIONE_SEPARATA, INPS_ARTIGIANI_COMMERCIANTI,
} from '../lib/taxRates.js';
import NumberInput from './NumberInput.jsx';
import Icon from './icons/Icon.jsx';

const fmt0 = (n) => Math.round(n || 0).toLocaleString('it-IT', { useGrouping: 'always' });
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

// Riga di un riepilogo "Come si calcola".
function Row({ label, value, sub, total, minus }) {
  return (
    <div className={`fiscal-flow-row${sub ? ' sub' : ''}${total ? ' total' : ''}`}>
      <span>{label}</span><span className="mono">{minus ? '−' : ''}€{fmt(value)}</span>
    </div>
  );
}

const bracketsText = (brackets) => (brackets.length === 1 && brackets[0].upTo == null ? `aliquota unica ${pct(brackets[0].rate)}%` : brackets.map((b, i) => {
  const from = i === 0 ? 0 : brackets[i - 1].upTo;
  if (b.upTo == null) return `${pct(b.rate)}% oltre €${fmt0(from)}`;
  return `${pct(b.rate)}% ${i === 0 ? 'fino a' : `da €${fmt0(from)} a`} €${fmt0(b.upTo)}`;
}).join(' · '));

export default function FiscalSettingsTab({ state, setState }) {
  const [sub, setSub] = useState('params');
  const [more, setMore] = useState(false);
  const { settings } = state;
  const mode = settings.taxMode === 'forfettario' || settings.taxMode === 'ordinario' ? settings.taxMode : 'semplice';
  const exact = mode === 'forfettario';
  const ordinary = mode === 'ordinario';
  const fundId = settings.pensionFund || '';
  const fund = PENSION_FUNDS.find((f) => f.id === fundId) ?? null;
  const forRole = suggestedFund(settings); // la cassa di solito giusta per il lavoro scelto
  const coeffForRole = suggestedCoefficient(settings);
  const artCom = isInpsArtCom(fundId);
  const needsAnnual = ordinary || (exact && artCom); // scaglioni e quote fisse vanno calcolati sull'anno

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

  // compensi annui al ritmo di quest'anno (compensi finora ÷ parte d'anno trascorsa)
  const projection = useMemo(() => {
    const soFar = yearSum.totalInvoice - yearSum.totalIntegrativo;
    const start = new Date(y, 0, 1);
    const days = Math.max(1, Math.round((new Date() - start) / 86400000) + 1);
    if (soFar <= 0 || days < 20) return 0;
    return Math.round((soFar * (365 / days)) / 500) * 500;
  }, [yearSum, y]);

  const annual = annualRevenueOf(settings);
  const annualIsDefault = !(Number(settings.annualRevenueEstimate) > 0);
  const ordYear = useMemo(() => computeOrdinarioYear(annual, settings), [annual, settings]);
  const forfYear = useMemo(() => computeForfettarioYear(annual, settings), [annual, settings]);

  const patch = (p) => setState((s) => updateFiscalSettings(s, p));
  const patchSettings = (p) => setState((s) => updateSettings(s, p));
  const chooseFund = (id) => {
    const f = PENSION_FUNDS.find((x) => x.id === id);
    patch({ pensionFund: id, ...fundPatch(f) });
  };
  // scegliendo il lavoro si propongono cassa (se non è ancora scelta) e coefficiente del forfettario
  const chooseRole = (id) => {
    const f = !fundId ? PENSION_FUNDS.find((x) => x.id === suggestedFund({ professionalRole: id })) : null;
    const coeff = suggestedCoefficient({ professionalRole: id });
    setState((s) => updateFiscalSettings(s, {
      professionalRole: id,
      ...(f ? { pensionFund: f.id, ...fundPatch(f) } : {}),
      ...(coeff ? { coefficientPercent: coeff } : {}),
    }));
  };
  const seedAnnual = () => (Number(settings.annualRevenueEstimate) > 0 ? {} : { annualRevenueEstimate: projection || DEFAULT_ANNUAL_REVENUE });
  const chooseExact = () => patch({ fiscalRegime: 'forfettario', taxMode: 'forfettario', ...(artCom ? seedAnnual() : {}) });
  const chooseOrdinary = () => patch({ fiscalRegime: 'ordinario', taxMode: 'ordinario', ...seedAnnual() });
  const chooseRegion = (id) => {
    const p = { region: id };
    // cambiando regione, un comune di un'altra regione non ha più senso
    const mun = MUNICIPALITIES.find((x) => x.id === settings.municipality);
    if (mun && mun.region !== id) p.municipality = '';
    patch(p);
  };

  const occasionalYearGross = useMemo(
    () => state.occasionalWork.filter((o) => (o.date || '').slice(0, 4) === String(y))
      .reduce((a, o) => a + (Number(o.grossAmount) || 0), 0),
    [state.occasionalWork, y],
  );

  const riv = rivalsaLabel(settings);
  const region = REGIONS.find((r) => r.id === settings.region) ?? null;
  const municipality = MUNICIPALITIES.find((x) => x.id === settings.municipality) ?? null;
  const munChoices = MUNICIPALITIES.filter((x) => !settings.region || x.region === settings.region);
  const gsReduced = fundId === 'inps' && Number(settings.forfContributionsPercent) === INPS_GESTIONE_SEPARATA.rateReduced;
  const effective = (taxes, base) => (base > 0 ? (taxes / base) * 100 : 0);

  // Compensi annui previsti: servono per scaglioni IRPEF e quote fisse INPS
  const annualField = (
    <div className="fs-annual">
      <span className="field">
        <span className="field-label">Compensi annui previsti (€)</span>
        <NumberInput allowEmpty value={Number(settings.annualRevenueEstimate) > 0 ? settings.annualRevenueEstimate : null} onChange={(v) => patch({ annualRevenueEstimate: v || 0 })} min={0} max={10000000} placeholder={fmt0(DEFAULT_ANNUAL_REVENUE)} />
      </span>
      <small>
        {annualIsDefault ? <>Non impostati: uso €{fmt0(DEFAULT_ANNUAL_REVENUE)}. </> : null}
        {ordinary ? 'Serve per capire in che scaglione IRPEF sei' : 'Serve a dividere la quota fissa INPS tra i mesi'}: le tasse di ogni mese sono la sua parte di quelle dell'anno.
        {projection > 0 && Math.abs(projection - annual) >= 500 && (
          <> Al ritmo di quest'anno arrivi a circa <b>€{fmt0(projection)}</b>.{' '}
            <button type="button" className="link-btn fs-inline-btn" onClick={() => patch({ annualRevenueEstimate: projection })}>Usa questa cifra</button>
          </>
        )}
      </small>
    </div>
  );

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
            Come Horarya arriva al netto stimato ({exact ? 'formula del regime forfettario' : ordinary ? 'regime ordinario, IRPEF a scaglioni' : 'calcolo semplice'}),
            con i tuoi numeri {ordinary ? 'dell\'anno previsto e del mese in corso' : 'del mese in corso'} come esempio.
          </p>
          {ordinary ? (
            <>
              <div className="editor-label" style={{ marginTop: 6 }}>Il tuo anno, con €{fmt0(annual)} di compensi</div>
              <div className="fiscal-flow">
                <Row label="Compensi annui previsti" value={ordYear.revenue} />
                {ordYear.expenses > 0 && <Row sub minus label={`Spese deducibili (${pct(ordYear.expensesPercent)}%)`} value={ordYear.expenses} />}
                <Row label="= Reddito professionale" value={ordYear.income} />
                <Row sub minus label={`Contributi ${fund && fund.id !== 'altro' ? fund.label : 'previdenziali'} (si deducono)`} value={ordYear.contributions} />
                <Row label="= Reddito imponibile IRPEF" value={ordYear.taxable} />
                {ordYear.otherIncome > 0 && (
                  <div className="fiscal-flow-row sub"><span>Altri redditi (es. stipendio): €{fmt0(ordYear.otherIncome)}. Qui conta solo l'IRPEF in più dovuta alla partita IVA.</span><span /></div>
                )}
                <Row sub label={`IRPEF lorda (${bracketsText(IRPEF_BRACKETS)})`} value={ordYear.irpefGross} />
                {ordYear.deduction > 0 && <Row sub minus label="Detrazione per lavoro autonomo" value={ordYear.deduction} />}
                <Row sub label="= IRPEF" value={ordYear.irpef} />
                <Row sub label={`Addizionale regionale${region ? ` ${region.label}` : ` (${pct(settings.regionalManualPercent)}%)`}`} value={ordYear.regional} />
                <Row sub label={`Addizionale comunale${municipality ? ` ${municipality.label}` : ` (${pct(settings.municipalManualPercent)}%)`}`} value={ordYear.municipal} />
                <Row label={`Tasse e contributi nell'anno (${pct(Math.round(effective(ordYear.taxes, ordYear.revenue) * 10) / 10)}% dei compensi)`} value={ordYear.taxes} />
                <Row total label="= Netto annuo stimato" value={ordYear.net} />
              </div>
              <div className="editor-label" style={{ marginTop: 18 }}>Questo mese</div>
              <div className="fiscal-flow">
                <Row label="Fatturato" value={example.totalInvoice} />
                {example.integrativo > 0 && <Row sub minus label="Integrativo da versare alla cassa" value={example.integrativo} />}
                <Row sub minus label="Contributi (la parte del mese)" value={example.contributions} />
                <Row sub minus label="IRPEF e addizionali (la parte del mese)" value={example.incomeTax} />
                <Row total label="= Netto stimato" value={example.net} />
              </div>
            </>
          ) : exact ? (
            <div className="fiscal-flow">
              <div className="fiscal-flow-row"><span>{example.perSite.some((p) => p.inclusive || p.mixedPay) ? 'Compensi (le paghe omnicomprensive senza il ' + pct(settings.rivalsaPercent) + '%)' : 'Compensi (ore × paga)'}</span><span className="mono">€{fmt(example.totalRevenue)}</span></div>
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
                <span>− Contributi {fund && fund.id !== 'altro' ? fund.label : 'previdenziali'} ({artCom
                  ? `quota fissa + ${pct(fund?.forfContributionsPercent)}%, la parte del mese su €${fmt0(forfYear.contributions)} l'anno${settings.inpsForfReduction ? ', con riduzione del 35%' : ''}`
                  : `${pct(settings.forfContributionsPercent)}% del reddito`})</span>
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

          {(exact || ordinary) && yearSum.months.length > 0 && (
            <>
              <h2 className="panel-title" style={{ marginTop: 20 }}>Nell'anno {y}, finora</h2>
              <div className="fiscal-flow">
                <div className="fiscal-flow-row"><span>Reddito imponibile</span><span className="mono">€{fmt(yearSum.totalTaxable)}</span></div>
                <div className="fiscal-flow-row sub"><span>Contributi stimati</span><span className="mono">€{fmt(yearSum.totalContributions)}</span></div>
                {ordinary ? (
                  <>
                    <div className="fiscal-flow-row sub"><span>IRPEF stimata</span><span className="mono">€{fmt(yearSum.totalIrpef)}</span></div>
                    <div className="fiscal-flow-row sub"><span>Addizionali regionale e comunale</span><span className="mono">€{fmt(yearSum.totalRegional + yearSum.totalMunicipal)}</span></div>
                  </>
                ) : (
                  <div className="fiscal-flow-row sub"><span>Imposta sostitutiva stimata</span><span className="mono">€{fmt(yearSum.totalIncomeTax)}</span></div>
                )}
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
              {exact && ' Nel forfettario si tassano i compensi incassati e si deducono i contributi versati nell\'anno; qui, per stimare mese per mese, si usano i turni e i contributi dello stesso periodo.'}
              {exact && !artCom && ' I minimi annuali della cassa non sono compresi.'}
              {ordinary && ' Nell\'ordinario le tasse si calcolano sull\'anno intero: qui si stimano sui compensi annui previsti e si dividono tra i mesi. Non sono comprese altre detrazioni (familiari, spese mediche, mutuo…), gli acconti, l\'IVA né i minimi annuali della cassa.'}
              {mode === 'semplice' && ' Usa la percentuale che imposti qui e non tiene conto di deduzioni o casi particolari del tuo regime.'}
            </span>
          </div>
          {(exact || ordinary) && (
            <p className="fs-sources">
              Aliquote {TAX_YEAR}, controllate il {TAX_RATES_CHECKED}: IRPEF dalla legge di bilancio {TAX_YEAR}; INPS dalle circolari 8/2026 (Gestione separata) e 14/2026 (artigiani e commercianti)
              {ordinary && region ? `; addizionale ${region.label}: ${region.source}` : ''}
              {ordinary && municipality ? `; addizionale ${municipality.label}: ${municipality.source}` : ''}.
            </p>
          )}
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
              <React.Fragment key={f.id}>
                <label className={`pay-opt ${fundId === f.id ? 'sel' : ''}`}>
                  <input type="radio" name="fund" checked={fundId === f.id} onChange={() => chooseFund(f.id)} />
                  <span className="pay-opt-tx">
                    <b>{f.label}{f.who ? <span className="fs-who"> · {f.who}</span> : null}
                      {forRole === f.id && <span className="fs-tag">Per il tuo lavoro</span>}
                    </b>
                    <small>{f.short}</small>
                  </span>
                </label>
                {fundId === 'inps' && f.id === 'inps' && (
                  <div className="fs-panel">
                    <span className="fs-sub-t">Aliquota Gestione separata</span>
                    <span className="seg fs-seg">
                      <button type="button" className={!gsReduced ? 'on' : ''} onClick={() => patch({ forfContributionsPercent: INPS_GESTIONE_SEPARATA.rate })}>{pct(INPS_GESTIONE_SEPARATA.rate)}% · solo P.IVA</button>
                      <button type="button" className={gsReduced ? 'on' : ''} onClick={() => patch({ forfContributionsPercent: INPS_GESTIONE_SEPARATA.rateReduced })}>{pct(INPS_GESTIONE_SEPARATA.rateReduced)}% · pensionato o con altra cassa</button>
                    </span>
                  </div>
                )}
                {artCom && fundId === f.id && exact && (
                  <label className="fs-panel fs-check">
                    <input type="checkbox" checked={!!settings.inpsForfReduction} onChange={(e) => patch({ inpsForfReduction: e.target.checked })} />
                    <span>Ho chiesto la riduzione del {INPS_ARTIGIANI_COMMERCIANTI.forfettarioReductionPercent}% per i forfettari <small>(contributi più bassi, ma anche pensione più bassa)</small></span>
                  </label>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="fs-step"><span className="sheet-sn">3</span>Il tuo regime e come calcolare le tasse</div>
          <div className="pay-opts">
            <label className={`pay-opt ${exact ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={exact} onChange={chooseExact} />
              <span className="pay-opt-tx">
                <b>Forfettario <span className="fs-tag">Il più diffuso</span></b>
                <small>Fino a €{fmt0(FORFETTARIO.revenueLimit)} di compensi l'anno. Reddito = compensi × coefficiente ({pct(settings.coefficientPercent ?? 78)}%), meno i contributi; sul resto un'imposta unica del 5% o 15%.</small>
              </span>
            </label>
            {exact && (
              <div className="fs-panel">
                <span className="fs-sub-t">Imposta sostitutiva</span>
                <span className="seg fs-seg">
                  <button type="button" className={Number(settings.forfTaxRatePercent) === 5 ? 'on' : ''} onClick={() => patch({ forfTaxRatePercent: 5 })}>5% · primi 5 anni</button>
                  <button type="button" className={Number(settings.forfTaxRatePercent) === 15 ? 'on' : ''} onClick={() => patch({ forfTaxRatePercent: 15 })}>15%</button>
                </span>
                {![5, 15].includes(Number(settings.forfTaxRatePercent)) && (
                  <small>Ora è al {pct(settings.forfTaxRatePercent)}% (cambiala nei valori qui sotto).</small>
                )}
                <span className="fs-sub-t" style={{ marginTop: 6 }}>Tipo di attività (coefficiente)</span>
                <select value={String(settings.coefficientPercent)} onChange={(e) => patch({ coefficientPercent: Number(e.target.value) })} aria-label="Coefficiente di redditività">
                  {FORFETTARIO.coefficients.map((c) => (
                    <option key={c.id} value={String(c.percent)}>{c.percent}% · {c.label}</option>
                  ))}
                  {!FORFETTARIO.coefficients.some((c) => c.percent === Number(settings.coefficientPercent)) && (
                    <option value={String(settings.coefficientPercent)}>{pct(settings.coefficientPercent)}% · valore personalizzato</option>
                  )}
                </select>
                <small>
                  {FORFETTARIO.coefficients.find((c) => c.percent === Number(settings.coefficientPercent))?.examples
                    ? `Es. ${FORFETTARIO.coefficients.find((c) => c.percent === Number(settings.coefficientPercent)).examples}. `
                    : ''}
                  Dipende dal codice ATECO della tua partita IVA: controllalo sul certificato di attribuzione o col commercialista.
                  {coeffForRole && coeffForRole !== Number(settings.coefficientPercent) && <> Per {roleLabel(settings).toLowerCase()} di solito è il {coeffForRole}%.</>}
                </small>
                {artCom && annualField}
                {artCom && annual > FORFETTARIO.revenueLimit && (
                  <small className="fs-warn">Oltre €{fmt0(FORFETTARIO.revenueLimit)} di compensi si esce dal forfettario (dall'anno dopo; subito oltre €{fmt0(FORFETTARIO.exitLimit)}).</small>
                )}
              </div>
            )}

            <label className={`pay-opt ${ordinary ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={ordinary} onChange={chooseOrdinary} />
              <span className="pay-opt-tx">
                <b>Ordinario</b>
                <small>IRPEF a scaglioni ({bracketsText(IRPEF_BRACKETS)}), con la detrazione per lavoro autonomo, più addizionale regionale e comunale. Si deducono spese e contributi.</small>
              </span>
            </label>
            {ordinary && (
              <div className="fs-panel">
                {annualField}
                {annual > FORFETTARIO.revenueLimit ? null : (
                  <small className="fs-note">Con meno di €{fmt0(FORFETTARIO.revenueLimit)} l'anno, se hai i requisiti, il forfettario di solito costa meno: chiedi al commercialista.</small>
                )}
                <div className="fs-grid">
                  <span className="field">
                    <span className="field-label">Spese deducibili (% compensi)</span>
                    <NumberInput value={settings.ordExpensesPercent} onChange={(v) => patch({ ordExpensesPercent: v })} min={0} max={100} />
                  </span>
                  <span className="field">
                    <span className="field-label">Altri redditi annui (€)</span>
                    <NumberInput value={settings.ordOtherIncome} onChange={(v) => patch({ ordOtherIncome: v })} min={0} max={10000000} />
                  </span>
                </div>
                <small>Spese: attrezzatura, software, auto, telefono… in percentuale dei compensi. Altri redditi: per esempio lo stipendio da dipendente, che fa salire lo scaglione.</small>

                <div className="fs-grid">
                  <span className="field">
                    <span className="field-label">Regione</span>
                    <select value={settings.region || ''} onChange={(e) => chooseRegion(e.target.value)}>
                      {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      <option value="">Altra regione (scrivi l'aliquota)</option>
                    </select>
                  </span>
                  <span className="field">
                    <span className="field-label">Comune</span>
                    <select value={settings.municipality || ''} onChange={(e) => patch({ municipality: e.target.value })}>
                      {munChoices.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      <option value="">Altro comune (scrivi l'aliquota)</option>
                    </select>
                  </span>
                </div>
                {region ? (
                  <small>Addizionale {region.label} {region.year}: {bracketsText(region.brackets)}.</small>
                ) : (
                  <span className="field">
                    <span className="field-label">Addizionale regionale (%)</span>
                    <NumberInput value={settings.regionalManualPercent} onChange={(v) => patch({ regionalManualPercent: v })} min={0} max={10} />
                    <small>Se non la conosci lascia 1,23%, l'aliquota base nazionale (molte regioni la aumentano fino al 3,33%).</small>
                  </span>
                )}
                {municipality ? (
                  <small>Addizionale {municipality.label} {municipality.year}: {bracketsText(municipality.brackets)}, niente da pagare fino a €{fmt0(municipality.exemptUpTo)} di imponibile. {municipality.note}</small>
                ) : (
                  <div className="fs-grid">
                    <span className="field">
                      <span className="field-label">Addizionale comunale (%)</span>
                      <NumberInput value={settings.municipalManualPercent} onChange={(v) => patch({ municipalManualPercent: v })} min={0} max={10} />
                    </span>
                    <span className="field">
                      <span className="field-label">Esente fino a (€)</span>
                      <NumberInput value={settings.municipalExemptUpTo} onChange={(v) => patch({ municipalExemptUpTo: v })} min={0} max={1000000} />
                    </span>
                  </div>
                )}
                {!municipality && <small>La trovi sul sito del tuo Comune o del Ministero delle Finanze (di solito tra 0% e 0,9%).</small>}

                <div className="fs-result">
                  Su €{fmt0(annual)} l'anno: contributi €{fmt0(ordYear.contributions)}, IRPEF €{fmt0(ordYear.irpef)}, addizionali €{fmt0(ordYear.regional + ordYear.municipal)}.
                  <b> Ti restano circa €{fmt0(ordYear.net)} ({pct(Math.round(effective(ordYear.taxes, ordYear.revenue) * 10) / 10)}% in tasse e contributi).</b>
                </div>
              </div>
            )}

            <label className={`pay-opt ${mode === 'semplice' ? 'sel' : ''}`}>
              <input type="radio" name="tax-mode" checked={mode === 'semplice'} onChange={() => patch({ taxMode: 'semplice' })} />
              <span className="pay-opt-tx">
                <b>Semplice: una percentuale fissa</b>
                <small>Metti da parte la stessa percentuale di tutto il fatturato, che decidi tu.</small>
              </span>
            </label>
            {mode === 'semplice' && (
              <div className="fs-panel fs-simple">
                <span className="field">
                  <span className="field-label">Imposta (%)</span>
                  <NumberInput value={settings.taxRatePercent} onChange={(v) => patch({ taxRatePercent: v })} min={0} max={100} />
                </span>
                <span className="field">
                  <span className="field-label">Contributi (%)</span>
                  <NumberInput value={settings.contributionsPercent} onChange={(v) => patch({ contributionsPercent: v })} min={0} max={100} />
                </span>
                <small>Totale da mettere da parte: <b>{pct((Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0))}%</b> del fatturato.</small>
              </div>
            )}
          </div>

          <p className="fs-summary">
            {[
              roleLabel(settings),
              fund && fund.id !== 'altro' ? fund.label : '',
              exact ? `forfettario, imposta ${pct(settings.forfTaxRatePercent)}%, coefficiente ${pct(settings.coefficientPercent)}%`
                : ordinary ? `ordinario, circa ${pct(Math.round(effective(ordYear.taxes, ordYear.revenue) * 10) / 10)}% tra tasse e contributi`
                  : `${pct((Number(settings.taxRatePercent) || 0) + (Number(settings.contributionsPercent) || 0))}% da mettere da parte`,
            ].filter(Boolean).join(' · ')}
            {Number(settings.rivalsaPercent) > 0 && <> · in fattura +{pct(settings.rivalsaPercent)}% di {settings.rivalsaType === 'integrativo' ? 'integrativo' : 'rivalsa'}</>}
          </p>
          <p className="fs-disclaimer">
            <Icon name="hourglass" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Tutti i calcoli sono <b>stime</b> con le aliquote {TAX_YEAR} e non sostituiscono il commercialista.</span>
          </p>

          <button type="button" className="fs-more" onClick={() => setMore(!more)} aria-expanded={more}>
            <span>Valori nel dettaglio</span>
            <Icon name="chevronDown" size={18} style={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {more && (
            <div className="fs-detail">
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="field-label">Regime fiscale</label>
                <select value={settings.fiscalRegime} onChange={(e) => {
                  const v = e.target.value;
                  // la formula giusta segue il regime: forfettario e ordinario hanno la loro
                  if (v === 'ordinario') patch({ fiscalRegime: v, taxMode: 'ordinario', ...seedAnnual() });
                  else if (v === 'forfettario') patch({ fiscalRegime: v, ...(ordinary ? { taxMode: 'forfettario' } : {}) });
                  else patch({ fiscalRegime: v, ...(mode !== 'semplice' ? { taxMode: 'semplice' } : {}) });
                }}>
                  {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              {(exact || ordinary) && (
                <>
                  <div className="form-row">
                    {exact && (
                      <div className="field">
                        <label className="field-label">Imposta sostitutiva (%)</label>
                        <NumberInput value={settings.forfTaxRatePercent} onChange={(v) => patch({ forfTaxRatePercent: v })} min={0} max={100} />
                      </div>
                    )}
                    {!artCom && (
                      <div className="field">
                        <label className="field-label">Contributi (% del reddito)</label>
                        <NumberInput value={settings.forfContributionsPercent} onChange={(v) => patch({ forfContributionsPercent: v })} min={0} max={100} />
                      </div>
                    )}
                    {exact && (
                      <div className="field">
                        <label className="field-label">Coefficiente (%)</label>
                        <NumberInput value={settings.coefficientPercent} onChange={(v) => patch({ coefficientPercent: v })} min={0} max={100} />
                      </div>
                    )}
                  </div>
                  <p className="panel-desc" style={{ marginBottom: 14 }}>
                    {exact && 'Imposta: 5% per i primi 5 anni di attività se hai i requisiti, poi 15%. Coefficiente: dipende dal codice ATECO (78% professioni e sanità, 67% altre attività). '}
                    {artCom && 'INPS artigiani e commercianti: quota fissa annua più la percentuale sopra il minimale, già impostate con i valori ' + TAX_YEAR + '.'}
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
                {mode === 'semplice' && ' Nel calcolo semplice resta compreso nel fatturato tassato.'}
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
