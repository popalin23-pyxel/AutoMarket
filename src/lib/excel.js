// Export Excel del riepilogo mensile (SheetJS).

import * as XLSX from 'xlsx';
import { MONTHS_IT } from './defaults.js';
import { saveFile } from './saveFile.js';

// Protezione da "formula injection": un nome sede come "=cmd|'/c calc'!A0"
// o "=HYPERLINK(...)" diventerebbe una formula eseguibile se aperto in Excel.
// Prefissando con un apice si forza la cella a essere trattata come testo.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
function safeText(v) {
  return typeof v === 'string' && FORMULA_TRIGGER.test(v) ? `'${v}` : v;
}

export function exportMonthExcel(sum, opts = {}) {
  const wb = XLSX.utils.book_new();
  const title = `${MONTHS_IT[sum.month - 1]} ${sum.year}`;

  const header = (opts.headerLines || []).map((line) => [safeText(String(line))]);
  const rows = [
    ...header,
    [`Riepilogo ${title}`],
    [],
    ['Sede', 'Ore', '€/h', 'Fatturato', 'Rivalsa %', 'Rivalsa €', 'Totale'],
    ...sum.perSite.map((p) => [safeText(p.name), p.hours, p.rate, p.revenue, p.rivalsaPercent, p.rivalsa, p.total]),
    [],
    ['Ore totali', sum.totalHours],
    ['Fatturato totale', '', '', '', '', '', sum.totalInvoice],
    [`Tasse da accantonare (${sum.taxPercent}%)`, '', '', '', '', '', -sum.taxes],
    ['Netto sedi di lavoro', '', '', '', '', '', sum.net],
  ];

  if (sum.occasionalCount > 0) {
    rows.push(
      [],
      ['Prestazioni occasionali (lordo)', '', '', '', '', '', sum.occasionalGross],
      [`Tasse stimate (${sum.occasionalTaxPercent}%)`, '', '', '', '', '', -sum.occasionalTaxes],
      ['Netto prestazioni occasionali', '', '', '', '', '', sum.occasionalNet],
      [],
      ['Netto totale (sedi + prestazioni)', '', '', '', '', '', sum.netTotal],
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFile(blob, `turnio_${sum.year}_${String(sum.month).padStart(2, '0')}.xlsx`);
}
