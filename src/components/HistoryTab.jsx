import React, { useMemo, useState } from 'react';
import { computeYearSummary, computeRangeSummary, monthsWithData } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import AreaChart from './charts/AreaChart.jsx';
import YearHeatmap from './charts/YearHeatmap.jsx';
import EmptyState from './EmptyState.jsx';
import CountUpText from './CountUpText.jsx';
import SiteAvatar from './SiteAvatar.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HistoryTab({ state, onOpenMonth }) {
  const years = useMemo(() => {
    const set = new Set(monthsWithData(state.shifts).map((m) => m.year));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [state.shifts]);

  const [year, setYear] = useState(years[0]);
  const y = useMemo(
    () => computeYearSummary(state.shifts, state.sites, state.settings, year),
    [state.shifts, state.sites, state.settings, year],
  );
  const yearRange = useMemo(
    () => computeRangeSummary(state.shifts, state.sites, state.settings, `${year}-01-01`, `${year}-12-31`),
    [state.shifts, state.sites, state.settings, year],
  );
  const avgHourly = yearRange.totalHours > 0 ? yearRange.totalInvoice / yearRange.totalHours : 0;
  // media sui soli mesi con almeno un turno registrato: corretta anche ad
  // anno in corso, senza dividere per 12 se non hai ancora lavorato tutto l'anno
  const avgGrossPerMonth = y.months.length > 0 ? y.totalInvoice / y.months.length : 0;

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Storico</h2>
        <div className="hist-year-nav">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>

        {y.months.length === 0 ? (
          <EmptyState icon="history" title="Nessun turno in questo anno" hint="Cambia anno oppure registra il tuo primo turno." />
        ) : (
          <div className="stats-row">
            <div className="stat"><div className="stat-label">Ore anno</div><div className="stat-value"><CountUpText value={y.totalHours} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Fatturato anno</div><div className="stat-value">€<CountUpText value={y.totalInvoice} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Media lordo/mese</div><div className="stat-value">€<CountUpText value={avgGrossPerMonth} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Tasse accantonate</div><div className="stat-value">€<CountUpText value={y.totalTaxes} format={fmt} /></div></div>
            <div className="stat"><div className="stat-label">Netto anno</div><div className="stat-value gold">€<CountUpText value={y.totalNet} format={fmt} /></div></div>
          </div>
        )}
        {y.months.length > 0 && (
          <div className="fiscal-footnote" style={{ marginTop: 12 }}>
            Media lordo/mese calcolata sui {y.months.length} {y.months.length === 1 ? 'mese lavorato' : 'mesi lavorati'} di
            quest'anno, non su 12 — così è corretta anche ad anno non ancora finito.
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
          <p className="panel-desc">Netto per mese</p>
          <AreaChart
            data={y.months.map((m) => ({ label: MONTHS_IT[m.month - 1].slice(0, 3), net: m.net }))}
            valueKey="net" labelKey="label" color="var(--gold)" height={130} />
        </div>
      )}

      {yearRange.perSite.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Confronto sedi — {year}</h2>
          <p className="panel-desc">Dove guadagni di più, in un colpo d'occhio.</p>
          <div className="site-compare-list">
            {yearRange.perSite.map((p) => (
              <div key={p.siteId ?? 'unknown'} className="site-compare-row">
                <SiteAvatar site={{ name: p.name, color: p.color }} size={26} />
                <div className="site-compare-info">
                  <div className="site-compare-name">{p.name}</div>
                  <div className="site-compare-sub">{fmt(p.hours)}h · €{p.rate}/h</div>
                </div>
                <span className="site-compare-total">€{fmt(p.total)}</span>
              </div>
            ))}
          </div>
          <div className="fiscal-footnote" style={{ marginTop: 12 }}>
            Guadagno medio per ora (tutte le sedi): <b>€{fmt(avgHourly)}</b>
          </div>
        </div>
      )}

      {y.months.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Dettaglio mensile</h2>
          {[...y.months].reverse().map((m) => (
            <div key={m.month} className="hist-month-row" onClick={() => onOpenMonth(m.year, m.month)}>
              <span className="hist-month-name">{MONTHS_IT[m.month - 1]}</span>
              <div className="hist-month-stats">
                <span>{fmt(m.totalHours)}h</span>
                <span>€{fmt(m.totalInvoice)}</span>
                <span className="gold">€{fmt(m.net)} netto</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
