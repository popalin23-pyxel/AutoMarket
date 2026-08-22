// Export Excel — porting di export_excel() del desktop (openpyxl → SheetJS).
// Genera 3 fogli: planning principale, Legenda turni, Riepilogo ore.

import * as XLSX from 'xlsx';
import { staffStats } from './scheduler.js';
import { MONTHS_IT } from './defaults.js';

export function exportExcel(data, shifts) {
  const { year, month, days, schedule } = data;
  const wb = XLSX.utils.book_new();

  // Etichette piano (numero) per i turni lavorativi, quando ci sono più piani
  const floors = data.floors ?? [];
  const multiFloor = floors.length > 1;
  const floorLabel = {};
  floors.forEach((f, i) => { floorLabel[f.id] = (String(f.name).match(/\d+/) || [])[0] || String(i + 1); });
  const cellText = (code, floorId) =>
    (multiFloor && shifts[code]?.working && floorId && floorLabel[floorId])
      ? `${code}${floorLabel[floorId]}` : code;

  // ── Foglio principale ──────────────────────────────────────────────
  const header = ['ID', 'Nome', 'Ruolo', ...range(1, days).map(String), 'Totale ore'];
  const rows = [header];

  for (const [id, s] of Object.entries(schedule)) {
    const stats = staffStats(s.days, shifts);
    const dayCells = s.days.map((code, i) => cellText(code, s.floors?.[i]));
    rows.push([id, s.name, s.role, ...dayCells, stats.hours]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // larghezza colonne: nome più largo, giorni stretti
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 14 },
    ...range(1, days).map(() => ({ wch: 4 })),
    { wch: 11 },
  ];
  // congela intestazione + prime 3 colonne (equiv. freeze_panes D2)
  ws['!freeze'] = { xSplit: 3, ySplit: 1 };
  const title = `${MONTHS_IT[month - 1]} ${year}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, title);

  // ── Legenda ────────────────────────────────────────────────────────
  const legend = [['Turno', 'Descrizione', 'Ore', 'Lavorativo', 'Notte']];
  for (const [code, meta] of Object.entries(shifts)) {
    legend.push([
      code,
      meta.description || '',
      Number(meta.hours || 0),
      meta.working ? 'Sì' : 'No',
      meta.is_night ? 'Sì' : 'No',
    ]);
  }
  const wsL = XLSX.utils.aoa_to_sheet(legend);
  wsL['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 6 }, { wch: 11 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsL, 'Legenda');

  // ── Riepilogo ──────────────────────────────────────────────────────
  const summary = [['Nome', 'Ruolo', 'Ore totali', 'Notti', 'Mattine', 'Pomeriggi', 'Riposi']];
  for (const s of Object.values(schedule)) {
    const st = staffStats(s.days, shifts);
    summary.push([s.name, s.role, st.hours, st.nights, st.mornings, st.afternoons, st.rests]);
  }
  const wsS = XLSX.utils.aoa_to_sheet(summary);
  wsS['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 7 }, { wch: 8 }, { wch: 9 }, { wch: 7 }];
  XLSX.utils.book_append_sheet(wb, wsS, 'Riepilogo');

  const filename = `turnify_${year}_${String(month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}
