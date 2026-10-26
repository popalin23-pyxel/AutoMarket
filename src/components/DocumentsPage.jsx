import React, { useEffect, useMemo, useState } from 'react';
import { computeMonthSummary } from '../lib/calc.js';
import { MONTHS_IT, professionalHeaderLines, rivalsaLabel } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import TimesheetDialog from './TimesheetDialog.jsx';
import { ListRow } from './AltroTab.jsx';

// PDF ed Excel si caricano solo quando servono (pesano ~675 KB)
const loadExcel = () => import('../lib/excel.js');
const loadPdf = () => import('../lib/pdf.js');

// Documenti: riepilogo del mese in PDF o Excel, foglio ore per una struttura, copia di sicurezza.
export default function DocumentsPage({ state, year, month, setYear, setMonth, onOpenBackup }) {
  const [timesheet, setTimesheet] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadExcel().catch(() => {}); loadPdf().catch(() => {}); }, []);
  const sum = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, year, month, state.occasionalWork),
    [state.shifts, state.sites, state.settings, year, month, state.occasionalWork],
  );
  const hasData = sum.shiftCount > 0 || sum.occasionalCount > 0;
  const opts = { headerLines: professionalHeaderLines(state.settings), rivalsaLabel: rivalsaLabel(state.settings) };
  const prev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const next = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const run = async (kind) => {
    setBusy(true);
    try {
      if (kind === 'pdf') await (await loadPdf()).exportMonthPdf(sum, opts);
      else await (await loadExcel()).exportMonthExcel(sum, opts);
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="ncard" style={{ padding: 12 }}>
        <div className="month-switch" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="round-btn" onClick={prev} aria-label="Mese precedente"><Icon name="chevronLeft" size={20} /></button>
          <span className="month-switch-label">{MONTHS_IT[month - 1]} {year}</span>
          <button type="button" className="round-btn" onClick={next} aria-label="Mese successivo"><Icon name="chevronRight" size={20} /></button>
        </div>
      </div>

      <div className="grp-title">Riepilogo del mese (per te o il commercialista)</div>
      {hasData ? (
        <div className="lcard">
          <ListRow color="rose" icon="download" title="Scarica il PDF" sub="Ore, compensi, tasse e netto del mese" onClick={() => !busy && run('pdf')} />
          <ListRow color="grn" icon="download" title="Scarica l'Excel" sub="Lo stesso riepilogo, in tabella" onClick={() => !busy && run('xlsx')} />
        </div>
      ) : (
        <p className="panel-desc" style={{ margin: '0 6px 12px' }}>Nessun turno in questo mese.</p>
      )}

      <div className="grp-title">Per le strutture</div>
      <div className="lcard">
        <ListRow color="vio" icon="doc" title="Foglio ore di una struttura" sub="Turno per turno, con lo spazio per la firma"
          onClick={() => setTimesheet(true)} />
      </div>

      <div className="grp-title">I tuoi dati</div>
      <div className="lcard">
        <ListRow color="blue" icon="cloud" title="Copia di sicurezza" sub="Salva tutti i tuoi dati in un file" onClick={onOpenBackup} />
      </div>

      {timesheet && (
        <TimesheetDialog state={state} siteId={sum.perSite[0]?.siteId ?? null} year={year} month={month} onClose={() => setTimesheet(false)} />
      )}
    </>
  );
}
