import React, { useEffect, useMemo, useState } from 'react';
import { computeMonthSummary } from '../lib/calc.js';
import { MONTHS_IT, hexToRgba, professionalHeaderLines, rivalsaLabel } from '../lib/defaults.js';

// Excel e PDF (~675 KB) si caricano solo quando si apre il riepilogo, non a ogni avvio dell'app.
const loadExcel = () => import('../lib/excel.js');
const loadPdf = () => import('../lib/pdf.js');
import RingChart from './charts/RingChart.jsx';
import EmptyState from './EmptyState.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import TimesheetDialog from './TimesheetDialog.jsx';
import CountUpText from './CountUpText.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import { useSwipe } from '../lib/useSwipe.js';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SummaryTab({ state, year, month, setYear, setMonth }) {
  const sum = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, year, month, state.occasionalWork),
    [state.shifts, state.sites, state.settings, year, month, state.occasionalWork],
  );
  const hasData = sum.shiftCount > 0 || sum.occasionalCount > 0;

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const monthAccent = sum.perSite[0]?.color;
  const swipe = useSwipe(nextMonth, prevMonth);
  const animatedNet = useCountUp(sum.net);
  const [timesheetSite, setTimesheetSite] = useState(undefined); // undefined = chiuso
  const rivLabel = rivalsaLabel(state.settings);
  const exact = sum.taxMode === 'forfettario';

  // precarica in background: al tocco su "Esporta" il modulo è già pronto e la condivisione
  // su iPhone parte ancora "dentro" il tocco (altrimenti Safari può bloccarla)
  useEffect(() => { loadExcel().catch(() => {}); loadPdf().catch(() => {}); }, []);
  const exportOpts = { headerLines: professionalHeaderLines(state.settings), rivalsaLabel: rivalsaLabel(state.settings) };
  const exportExcel = async () => (await loadExcel()).exportMonthExcel(sum, exportOpts);
  const exportPdf = async () => (await loadPdf()).exportMonthPdf(sum, exportOpts);

  return (
    <>
      <div className="panel" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd} style={monthAccent ? {
        borderTopColor: monthAccent, borderTopWidth: 3,
        background: `linear-gradient(160deg, ${hexToRgba(monthAccent, 0.10)}, var(--glass))`,
      } : undefined}>
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <span key={`${year}-${month}`} className="month-label month-slide">{MONTHS_IT[month - 1]} {year}</span>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>

        {!hasData ? (
          <EmptyState icon="euro" title="Nessun turno questo mese" hint="Il riepilogo comparirà qui appena registri un turno." />
        ) : (
          <div className="form-row" style={{ marginBottom: 0 }}>
            <button className="btn" onClick={exportExcel}>⬇ Esporta Excel</button>
            <button className="btn" onClick={exportPdf}>⬇ Esporta PDF</button>
            {state.sites.length > 0 && (
              <button className="btn" onClick={() => setTimesheetSite(sum.perSite[0]?.siteId ?? null)}>📄 Foglio ore struttura</button>
            )}
          </div>
        )}
      </div>

      {sum.perSite.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Per sede</h2>
          <div className="site-summary-list">
            {sum.perSite.map((p) => (
              <div key={p.siteId ?? 'unknown'} className="site-summary-card" style={{ borderColor: p.color + '33' }}>
                <div className="ssc-head">
                  <span className="site-badge" style={{ background: p.color + '22', color: p.color }}>
                    <SiteAvatar site={{ name: p.name, color: p.color }} size={18} />{p.name}
                  </span>
                  <span className="ssc-total mono">€{fmt(p.total)}</span>
                </div>
                <div className="ssc-grid">
                  <div><span className="ssc-lbl">Ore</span><span className="mono">{fmt(p.hours)}</span></div>
                  <div><span className="ssc-lbl">{p.mixedRate ? '€/h (media)' : '€/h'}</span><span className="mono">{fmt(p.rate)}</span></div>
                  <div><span className="ssc-lbl">Fatturato</span><span className="mono">€{fmt(p.revenue)}</span></div>
                  <div><span className="ssc-lbl">{rivLabel} {p.rivalsaPercent}%</span><span className="mono">€{fmt(p.rivalsa)}</span></div>
                </div>
                {p.siteId != null && (
                  <button className="link-btn ssc-timesheet" onClick={() => setTimesheetSite(p.siteId)}>📄 Foglio ore da mandare alla struttura</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sum.occasionalCount > 0 && (
        <div className="panel">
          <h2 className="panel-title">Prestazioni occasionali</h2>
          <p className="panel-desc">Reddito diverso dal lavoro nelle sedi, tassato a parte (niente rivalsa).</p>
          <div className="summary-flow">
            <div className="flow-row total"><span className="flow-label">Lordo ({sum.occasionalCount} {sum.occasionalCount === 1 ? 'prestazione' : 'prestazioni'})</span><span className="flow-value">€{fmt(sum.occasionalGross)}</span></div>
            <div className="flow-row taxes"><span className="flow-label">Accantonamento stimato ({sum.occasionalTaxPercent}%)</span><span className="flow-value red">−€{fmt(sum.occasionalTaxes)}</span></div>
            <div className="flow-row net"><span className="flow-label">Netto prestazioni</span><span className="flow-value green">€{fmt(sum.occasionalNet)}</span></div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2 className="panel-title">Riepilogo</h2>
        {sum.totalInvoice > 0 && (
          <div className="ring-row">
            <RingChart
              segments={[{ value: sum.net, color: 'var(--green)' }, { value: sum.taxes, color: 'var(--red)' }]}
              centerValue={`€${Math.round(animatedNet)}`} centerLabel={sum.occasionalCount > 0 ? 'netto sedi' : 'netto'} />
            <div className="ring-legend">
              <div className="ring-legend-item"><span className="dot" style={{ background: 'var(--green)' }} /> Netto {sum.totalInvoice ? Math.round((sum.net / sum.totalInvoice) * 100) : 0}%</div>
              <div className="ring-legend-item"><span className="dot" style={{ background: 'var(--red)' }} /> {exact ? 'Tasse e contributi' : 'Tasse'} {sum.totalInvoice ? Math.round((sum.taxes / sum.totalInvoice) * 100) : 0}%</div>
            </div>
          </div>
        )}
        <div className="stats-row">
          <div className="stat"><div className="stat-label">Ore totali</div><div className="stat-value"><CountUpText value={sum.totalHours} format={fmt} /></div></div>
          <div className="stat"><div className="stat-label">Fatturato</div><div className="stat-value">€<CountUpText value={sum.totalInvoice} format={fmt} /></div></div>
          <div className="stat"><div className="stat-label">{sum.occasionalCount > 0 ? 'Netto totale' : 'Netto stimato'}</div><div className="stat-value gold">€<CountUpText value={sum.netTotal} format={fmt} /></div></div>
        </div>

        <div className="summary-flow">
          <div className="flow-row"><span className="flow-label">Compensi (ore × paga)</span><span className="flow-value">€{fmt(sum.totalRevenue)}</span></div>
          <div className="flow-row"><span className="flow-label">{rivLabel}</span><span className="flow-value">€{fmt(sum.totalRivalsa)}</span></div>
          <div className="flow-row total"><span className="flow-label">Totale fatturato</span><span className="flow-value">€{fmt(sum.totalInvoice)}</span></div>
          {exact ? (
            <>
              {sum.integrativo > 0 && (
                <div className="flow-row taxes"><span className="flow-label">Integrativo da versare alla cassa</span><span className="flow-value red">−€{fmt(sum.integrativo)}</span></div>
              )}
              <div className="flow-row taxes"><span className="flow-label">Contributi previdenziali</span><span className="flow-value red">−€{fmt(sum.contributions)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Imposta sostitutiva</span><span className="flow-value red">−€{fmt(sum.incomeTax)}</span></div>
            </>
          ) : (
            <div className="flow-row taxes"><span className="flow-label">Tasse da accantonare ({sum.taxPercent}%)</span><span className="flow-value red">−€{fmt(sum.taxes)}</span></div>
          )}
          <div className="flow-row net"><span className="flow-label">{sum.occasionalCount > 0 ? 'Netto sedi di lavoro' : 'Ti resta (netto)'}</span><span className="flow-value green">€{fmt(sum.net)}</span></div>
          {sum.occasionalCount > 0 && (
            <div className="flow-row net"><span className="flow-label"><b>Netto totale (sedi + prestazioni)</b></span><span className="flow-value green"><b>€{fmt(sum.netTotal)}</b></span></div>
          )}
        </div>
        <p className="fiscal-footnote">
          Stima, non sostituisce il calcolo del commercialista.{exact ? ' Calcolo del regime forfettario: vedi Studio → Fiscali → Come si calcola.' : ''}
        </p>
      </div>

      {timesheetSite !== undefined && (
        <TimesheetDialog state={state} siteId={timesheetSite} year={year} month={month} onClose={() => setTimesheetSite(undefined)} />
      )}
    </>
  );
}
