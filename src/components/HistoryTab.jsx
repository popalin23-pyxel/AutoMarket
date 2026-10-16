import React, { useMemo } from 'react';
import { computeYearSummary } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import AreaChart from './charts/AreaChart.jsx';
import YearHeatmap from './charts/YearHeatmap.jsx';
import EmptyState from './EmptyState.jsx';
import CountUpText from './CountUpText.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Riepilogo di un anno (selezionato dal genitore, Analisi → Anno).
export default function HistoryTab({ state, year, yearSelect, onOpenMonth }) {
  const y = useMemo(
    () => computeYearSummary(state.shifts, state.sites, state.settings, year, state.occasionalWork),
    [state.shifts, state.sites, state.settings, year, state.occasionalWork],
  );
  // media sui soli mesi con almeno un turno registrato: corretta anche ad
  // anno in corso, senza dividere per 12 se non hai ancora lavorato tutto l'anno
  // (solo mesi con turni: fatturato e netto qui sono quelli delle sedi; le prestazioni hanno la loro voce)
  const workedMonths = y.months.filter((mm) => mm.shiftCount > 0).length;
  const avgGrossPerMonth = workedMonths > 0 ? y.totalInvoice / workedMonths : 0;
  const avgNetPerMonth = workedMonths > 0 ? y.totalNet / workedMonths : 0;

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Riepilogo {year}</h2>
        {yearSelect}

        {y.months.length === 0 ? (
          <EmptyState icon="history" title="Nessun dato in questo anno" hint="Cambia anno oppure registra il tuo primo turno." />
        ) : (
          <div className="stats-row">
            <div className="stat"><div className="stat-label">Ore anno</div><div className="stat-value"><CountUpText value={y.totalHours} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Fatturato anno</div><div className="stat-value">€<CountUpText value={y.totalInvoice} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Media lordo/mese</div><div className="stat-value">€<CountUpText value={avgGrossPerMonth} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Tasse accantonate</div><div className="stat-value">€<CountUpText value={y.totalTaxes} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Netto anno</div><div className="stat-value gold">€<CountUpText value={y.totalNet} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Media netto/mese</div><div className="stat-value gold">€<CountUpText value={avgNetPerMonth} format={fmt} /></div></div>
            {y.occasionalGross > 0 && (
              <div className="stat"><div className="stat-label">Prestazioni occasionali</div><div className="stat-value">€<CountUpText value={y.occasionalNet} format={fmt} /></div></div>
            )}
          </div>
        )}
        {y.occasionalGross > 0 && (
          <div className="fiscal-footnote" style={{ marginTop: 12 }}>
            Netto totale dell'anno, sedi + prestazioni occasionali: <b>€{fmt(y.totalNetAll)}</b>.
          </div>
        )}
        {workedMonths > 0 && (
          <div className="fiscal-footnote" style={{ marginTop: 12 }}>
            Le medie sono calcolate sui {workedMonths} {workedMonths === 1 ? 'mese lavorato' : 'mesi lavorati'} di
            quest'anno, non su 12 — così sono corrette anche ad anno non ancora finito.
          </div>
        )}
      </div>

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Mappa dell'anno</h2>
          <p className="panel-desc">Ogni quadratino è un giorno: più scuro = più ore lavorate</p>
          <YearHeatmap year={year} shifts={state.shifts} />
        </div>
      )}

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Andamento {year}</h2>
          <p className="panel-desc">Netto per mese{y.occasionalGross > 0 ? ' (sedi + prestazioni occasionali)' : ''}</p>
          <AreaChart
            data={y.months.map((m) => ({ label: MONTHS_IT[m.month - 1].slice(0, 3), net: m.netTotal }))}
            valueKey="net" labelKey="label" color="var(--gold)" height={130} />
        </div>
      )}

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Dettaglio mensile</h2>
          <p className="panel-desc">Tocca un mese per aprirne il riepilogo completo.</p>
          {[...y.months].reverse().map((m) => (
            <div key={m.month} className="hist-month-row" onClick={() => onOpenMonth(m.year, m.month)}>
              <span className="hist-month-name">{MONTHS_IT[m.month - 1]}</span>
              <div className="hist-month-stats">
                <span>{fmt(m.totalHours)}h</span>
                <span>€{fmt(m.totalInvoice)}</span>
                <span className="gold">€{fmt(m.net)} netto</span>
                {m.occasionalGross > 0 && <span>+€{fmt(m.occasionalNet)} prestazioni</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
