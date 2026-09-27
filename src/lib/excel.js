// Export Excel del riepilogo mensile (SheetJS).

import * as XLSX from 'xlsx';
import { MONTHS_IT } from './defaults.js';

export function exportMonthExcel(sum) {
  const wb = XLSX.utils.book_new();
  const title = `${MONTHS_IT[sum.month - 1]} ${sum.year}`;

  const rows = [
    ['Sede', 'Ore', '€/h', 'Fatturato', 'Rivalsa %', 'Rivalsa €', 'Totale'],
    ...sum.perSite.map((p) => [p.name, p.hours, p.rate, p.revenue, p.rivalsaPercent, p.rivalsa, p.total]),
    [],
    ['Ore totali', sum.totalHours],
    ['Fatturato totale', '', '', '', '', '', sum.totalInvoice],
    [`Tasse da accantonare (${sum.taxPercent}%)`, '', '', '', '', '', -sum.taxes],
    ['Netto', '', '', '', '', '', sum.net],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  XLSX.writeFile(wb, `turnio_${sum.year}_${String(sum.month).padStart(2, '0')}.xlsx`);
}
