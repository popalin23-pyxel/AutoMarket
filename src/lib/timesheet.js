// Foglio ore di una struttura (PDF ed Excel): turno per turno, con i totali da fatturare
// e lo spazio per le firme. Niente tasse né netto: è un documento da mandare al cliente.

import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { WEEKDAYS_IT } from './defaults.js';
import { pdfSafe } from './pdfText.js';
import { saveFile } from './saveFile.js';

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const itDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const weekday = (iso) => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS_IT[(new Date(y, m - 1, d).getDay() + 6) % 7]; };
const fileBase = (ts) => `foglio-ore_${ts.site.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'sede'}_${ts.fromISO}_${ts.toISO}`;

// stessa protezione degli altri export Excel: un testo che inizia con = + - @ non diventa una formula
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const safeText = (v) => (typeof v === 'string' && FORMULA_TRIGGER.test(v) ? `'${v}` : v);

export function exportTimesheetPdf(ts, { headerLines = [], rivalsaLabel = 'Rivalsa' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const mx = 16;
  const right = 210 - mx;
  let y = 18;

  // intestazione: chi fa il prospetto (sinistra) e per chi (destra)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(15, 42, 61);
  doc.text('Prospetto ore', mx, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 100, 110);
  headerLines.slice(0, 3).forEach((line, i) => doc.text(pdfSafe(line), mx, y + 6 + i * 5));
  doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 42, 61);
  doc.text(pdfSafe(`Struttura: ${ts.site.name}`), right, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 100, 110);
  doc.text(`Periodo: dal ${itDate(ts.fromISO)} al ${itDate(ts.toISO)}`, right, y + 6, { align: 'right' });
  y += 8 + Math.max(2, Math.min(3, headerLines.length)) * 5 + 4;
  doc.setDrawColor(220, 226, 232); doc.line(mx, y, right, y);
  y += 8;

  const cols = [
    { label: 'Data', x: mx, w: 22 },
    { label: 'Giorno', x: mx + 22, w: 14 },
    { label: 'Orario', x: mx + 36, w: 26 },
    { label: 'Ore', x: mx + 62, w: 14, align: 'right' },
    { label: '€/h', x: mx + 76, w: 18, align: 'right' },
    { label: 'Importo', x: mx + 94, w: 26, align: 'right' },
    { label: 'Note', x: mx + 124, w: right - (mx + 124) },
  ];
  const head = () => {
    doc.setFillColor(240, 244, 248); doc.rect(mx, y - 5, right - mx, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(90, 100, 110);
    cols.forEach((c) => doc.text(c.label, c.x + (c.align === 'right' ? c.w : 0), y, { align: c.align || 'left' }));
    y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 40, 50);
  };
  head();

  for (const r of ts.rows) {
    if (y > 262) { doc.addPage(); y = 20; head(); }
    doc.text(itDate(r.date), cols[0].x, y);
    doc.text(weekday(r.date), cols[1].x, y);
    doc.text(`${r.start}-${r.end}`, cols[2].x, y);
    doc.text(fmt(r.hours), cols[3].x + cols[3].w, y, { align: 'right' });
    doc.text(fmt(r.rate), cols[4].x + cols[4].w, y, { align: 'right' });
    doc.text(fmt(r.amount), cols[5].x + cols[5].w, y, { align: 'right' });
    if (r.note) {
      const lines = doc.splitTextToSize(pdfSafe(r.note), cols[6].w - 3);
      const note = lines.length > 1 ? `${lines[0]}...` : lines[0];
      doc.setTextColor(110, 120, 130); doc.text(note, cols[6].x, y); doc.setTextColor(30, 40, 50);
    }
    y += 6.5;
  }
  if (ts.rows.length === 0) {
    doc.setTextColor(120, 130, 140); doc.text('Nessun turno in questo periodo.', mx, y); y += 6.5;
  }

  // totali
  if (y > 230) { doc.addPage(); y = 24; }
  y += 3; doc.setDrawColor(220, 226, 232); doc.line(mx, y, right, y); y += 8;
  const row = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11.5 : 10);
    doc.setTextColor(...(bold ? [15, 42, 61] : [60, 70, 80]));
    doc.text(label, mx + 80, y); doc.text(value, right, y, { align: 'right' }); y += bold ? 8 : 6.5;
  };
  row('Ore totali', `${fmt(ts.totalHours)} h`);
  row('Compenso (ore x tariffa)', `€ ${fmt(ts.revenue)}`);
  if (ts.rivalsaPercent > 0) row(`${rivalsaLabel} ${ts.rivalsaPercent}%`, `€ ${fmt(ts.rivalsa)}`);
  row('Totale', `€ ${fmt(ts.total)}`, true);

  // firme
  y = Math.max(y + 22, 250);
  if (y > 275) { doc.addPage(); y = 40; }
  doc.setDrawColor(150, 158, 166);
  doc.line(mx, y, mx + 70, y); doc.line(right - 70, y, right, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 120, 130);
  doc.text('Firma del professionista', mx, y + 5);
  doc.text('Visto della struttura (firma e timbro)', right, y + 5, { align: 'right' });

  doc.setFontSize(7.5); doc.setTextColor(150, 158, 166);
  doc.text(`Generato con Turnio il ${new Date().toLocaleDateString('it-IT')}`, mx, 290);

  return saveFile(doc.output('blob'), `${fileBase(ts)}.pdf`);
}

export function exportTimesheetExcel(ts, { headerLines = [], rivalsaLabel = 'Rivalsa' } = {}) {
  const rows = [
    ['Prospetto ore'],
    ...headerLines.map((l) => [safeText(String(l))]),
    [safeText(`Struttura: ${ts.site.name}`)],
    [`Periodo: dal ${itDate(ts.fromISO)} al ${itDate(ts.toISO)}`],
    [],
    ['Data', 'Giorno', 'Inizio', 'Fine', 'Ore', '€/h', 'Importo', 'Note'],
    ...ts.rows.map((r) => [itDate(r.date), weekday(r.date), r.start, r.end, r.hours, r.rate, r.amount, safeText(r.note)]),
    [],
    ['Ore totali', '', '', '', ts.totalHours],
    ['Compenso (ore x tariffa)', '', '', '', '', '', ts.revenue],
  ];
  if (ts.rivalsaPercent > 0) rows.push([`${rivalsaLabel} ${ts.rivalsaPercent}%`, '', '', '', '', '', ts.rivalsa]);
  rows.push(['Totale', '', '', '', '', '', ts.total]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 11 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Foglio ore');
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFile(blob, `${fileBase(ts)}.xlsx`);
}
