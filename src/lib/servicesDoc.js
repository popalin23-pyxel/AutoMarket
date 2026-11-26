// Elenco prestazioni (PDF ed Excel): ogni prestazione con descrizione e importo, raggruppata
// per sede, e in fondo le cifre che ne risultano. Due versioni (vedi computeServiceList):
// per sé / il commercialista (con tasse e netto) o da mandare al cliente (una sede, con le diciture).

import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { pdfSafe } from './pdfText.js';
import { saveFile } from './saveFile.js';
import { invoiceNotes, taxLines } from './services.js';
import { MONTHS_IT } from './defaults.js';
import { monthDays } from './calc.js';

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const itDate = (iso) => { const [y, m, d] = (iso || '').split('-'); return `${d}/${m}/${y}`; };

// stessa protezione degli altri export Excel: un testo che inizia con = + - @ non diventa una formula
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const safeText = (v) => (typeof v === 'string' && FORMULA_TRIGGER.test(v) ? `'${v}` : v);

/** "Novembre 2026" se il periodo è un mese intero, altrimenti "dal 03/11/2026 al 20/11/2026". */
export function periodLabel(fromISO, toISO) {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  if (fy === ty && fm === tm && fd === 1 && td === monthDays(ty, tm)) return `${MONTHS_IT[fm - 1]} ${fy}`;
  return `dal ${itDate(fromISO)} al ${itDate(toISO)}`;
}

const anyInclusive = (list) => list.groups.some((g) => g.inclusive || g.mixedPay);
const compensiLabel = (list) => (anyInclusive(list) ? 'Compensi (scorporati dalla tariffa omnicomprensiva)' : 'Compensi (ore x tariffa)');
const rivalsaRowLabel = (list, rivalsaLabel) => (list.rivalsaPercent != null ? `${rivalsaLabel} ${list.rivalsaPercent}%` : rivalsaLabel);
const groupSubLabel = (g, rivalsaLabel) => (g.rivalsa > 0
  ? `compenso € ${fmt(g.revenue)} + ${rivalsaLabel.toLowerCase()} ${g.rivalsaPercent}% € ${fmt(g.rivalsa)}`
  : `compenso € ${fmt(g.revenue)}`);

const fileName = (list, ext) => {
  const slug = (s) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
  const who = list.forClient && list.client ? `_${slug(list.client.name) || 'cliente'}` : '';
  return `prestazioni${who}_${list.fromISO}_${list.toISO}.${ext}`;
};

// ───────────────────────────── PDF ─────────────────────────────
export function exportServicesPdf(list, { headerLines = [], rivalsaLabel = 'Rivalsa', settings = {} } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const mx = 16;
  const right = 210 - mx;
  const bottom = 272; // sotto: piè di pagina
  const ink = [30, 40, 50], navy = [15, 42, 61], grey = [90, 100, 110], soft = [130, 140, 150];
  const red = [190, 30, 60], green = [5, 130, 95];
  let y = 18;

  // intestazione: chi (sinistra), cosa e per chi (destra)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...navy);
  doc.text('Elenco prestazioni', mx, y);
  doc.setFontSize(10);
  headerLines.slice(0, 3).forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setTextColor(...(i === 0 ? ink : grey));
    doc.text(pdfSafe(line), mx, y + 7 + i * 5);
  });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
  doc.text(pdfSafe(`Periodo: ${periodLabel(list.fromISO, list.toISO)}`), right, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...grey);
  if (list.forClient && list.client) doc.text(pdfSafe(`Cliente: ${list.client.name}`), right, y + 6, { align: 'right' });
  else doc.text('Riepilogo per uso personale / commercialista', right, y + 6, { align: 'right' });
  doc.text(`Prestazioni: ${list.count}`, right, y + 11, { align: 'right' });
  y += 7 + Math.max(2, Math.min(3, headerLines.length)) * 5 + 4;
  doc.setDrawColor(220, 226, 232); doc.line(mx, y, right, y);
  y += 8;

  // colonne
  const C = { date: mx, desc: mx + 23, descW: 92, hours: mx + 130, rate: mx + 151, amount: right };
  const head = () => {
    doc.setFillColor(240, 244, 248); doc.rect(mx, y - 5, right - mx, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...grey);
    doc.text('Data', C.date + 1, y); doc.text('Descrizione', C.desc, y);
    doc.text('Ore', C.hours, y, { align: 'right' }); doc.text('€/h', C.rate, y, { align: 'right' });
    doc.text('Importo €', C.amount - 1, y, { align: 'right' });
    y += 8;
  };
  const ensure = (h, withHead = true) => {
    if (y + h <= bottom) return;
    doc.addPage(); y = 20;
    if (withHead) head();
  };
  head();

  // last = ultima riga del gruppo: resta sulla stessa pagina del suo totale
  const line = (r, last = false) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const desc = doc.splitTextToSize(pdfSafe(r.description), C.descW).slice(0, 2);
    const h = 5 + desc.length * 4.2;
    ensure(last ? h + 13 : h);
    doc.setTextColor(...ink);
    doc.text(itDate(r.date), C.date + 1, y);
    doc.text(desc, C.desc, y);
    if (r.hours != null) doc.text(fmt(r.hours), C.hours, y, { align: 'right' });
    if (r.rate != null) doc.text(fmt(r.rate), C.rate, y, { align: 'right' });
    doc.text(fmt(r.amount), C.amount - 1, y, { align: 'right' });
    y += h - 4.2 + (desc.length > 1 ? 0 : 1.7);
  };
  const groupTitle = (title, sub) => {
    ensure(18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy);
    doc.text(pdfSafe(title), mx + 1, y);
    if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...soft); doc.text(pdfSafe(sub), right - 1, y, { align: 'right' }); }
    y += 2; doc.setDrawColor(230, 234, 238); doc.line(mx, y, right, y); y += 5;
  };
  const subtotal = (label, detail, hours, amount) => {
    ensure(detail ? 12 : 8);
    doc.setDrawColor(230, 234, 238); doc.line(C.desc, y - 3.5, right, y - 3.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...navy);
    doc.text(pdfSafe(label), C.desc, y);
    if (hours != null) doc.text(fmt(hours), C.hours, y, { align: 'right' });
    doc.text(fmt(amount), C.amount - 1, y, { align: 'right' });
    if (detail) { y += 4.2; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...soft); doc.text(pdfSafe(detail), C.desc, y); }
    y += 9;
  };

  const showGroupTitles = !list.forClient;
  for (const g of list.groups) {
    if (showGroupTitles) groupTitle(g.site.name, `${g.rows.length} ${g.rows.length === 1 ? 'turno' : 'turni'}`);
    g.rows.forEach((r, i) => line(r, i === g.rows.length - 1));
    subtotal(list.forClient ? 'Totale prestazioni' : `Totale ${g.site.name}`, groupSubLabel(g, rivalsaLabel), g.totalHours, g.total);
  }
  if (list.occasional.length > 0) {
    groupTitle('Prestazioni occasionali', 'fuori partita IVA, senza rivalsa');
    list.occasional.forEach((o, i) => line({ ...o, hours: null, rate: null }, i === list.occasional.length - 1));
    subtotal('Totale prestazioni occasionali', null, null, list.occasionalGross);
  }
  if (list.count === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...soft);
    doc.text('Nessuna prestazione in questo periodo.', mx + 1, y); y += 10;
  }

  // ── le cifre che ne risultano ──
  const rows = [];
  rows.push({ label: 'Ore totali', value: `${fmt(list.totalHours)} h` });
  rows.push({ label: compensiLabel(list), value: `€ ${fmt(list.revenue)}` });
  if (list.rivalsa > 0) rows.push({ label: rivalsaRowLabel(list, rivalsaLabel), value: `€ ${fmt(list.rivalsa)}` });
  if (list.forClient) {
    rows.push({ label: 'Totale da pagare', value: `€ ${fmt(list.invoice)}`, bold: true, rule: true });
  } else {
    rows.push({ label: 'Totale fatturato', value: `€ ${fmt(list.invoice)}`, bold: true, rule: true });
    for (const [label, v] of taxLines(list)) rows.push({ label, value: `- € ${fmt(v)}`, color: red });
    rows.push({ label: list.occasional.length ? 'Netto partita IVA' : 'Netto stimato', value: `€ ${fmt(list.net)}`, bold: list.occasional.length === 0, color: green, rule: true });
    if (list.occasional.length > 0) {
      rows.push({ gap: true });
      rows.push({ label: 'Prestazioni occasionali (lordo)', value: `€ ${fmt(list.occasionalGross)}` });
      rows.push({ label: `Tasse stimate (${list.occasionalTaxPercent}%)`, value: `- € ${fmt(list.occasionalTaxes)}`, color: red });
      rows.push({ label: 'Netto totale', value: `€ ${fmt(list.netTotal)}`, bold: true, color: green, rule: true });
    }
  }
  const boxH = rows.reduce((a, r) => a + (r.gap ? 3 : r.bold ? 8 : 6.5), 0) + 12;
  ensure(boxH, false);
  y += 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy);
  doc.text('Riepilogo', mx + 1, y);
  y += 8;
  const lx = mx + 70;
  for (const r of rows) {
    if (r.gap) { y += 3; continue; }
    if (r.rule) { doc.setDrawColor(200, 208, 216); doc.line(lx, y - 4.8, right, y - 4.8); }
    doc.setFont('helvetica', r.bold ? 'bold' : 'normal'); doc.setFontSize(r.bold ? 11.5 : 10);
    doc.setTextColor(...(r.color || (r.bold ? navy : [60, 70, 80])));
    doc.text(pdfSafe(r.label), lx, y); doc.text(pdfSafe(r.value), right - 1, y, { align: 'right' });
    y += r.bold ? 8 : 6.5;
  }

  // diciture per la fattura (versione cliente) o nota sulla stima (versione personale)
  y += 6;
  if (list.forClient) {
    const notes = invoiceNotes(settings, list.invoice);
    if (notes.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      const wrapped = notes.map((n) => doc.splitTextToSize(pdfSafe(n), right - mx - 6));
      ensure(8 + wrapped.reduce((a, w) => a + w.length * 3.9 + 1.5, 0), false);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...grey);
      doc.text('Diciture per la fattura', mx + 1, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...grey);
      for (const w of wrapped) { doc.text('-', mx + 1, y); doc.text(w, mx + 5, y); y += w.length * 3.9 + 1.5; }
    }
    // firma
    y = Math.max(y + 18, 252);
    if (y > bottom) { doc.addPage(); y = 40; }
    doc.setDrawColor(150, 158, 166); doc.line(right - 70, y, right, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 120, 130);
    doc.text('Firma del professionista', right, y + 5, { align: 'right' });
  } else {
    ensure(10, false);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...soft);
    const d = 'Tasse, contributi e netto sono stime calcolate con le impostazioni di Tasse e cassa: non sostituiscono il calcolo del commercialista.';
    doc.text(doc.splitTextToSize(d, right - mx), mx + 1, y);
  }

  // piè di pagina su ogni pagina
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 158, 166);
    doc.text(`Generato con Horarya il ${new Date().toLocaleDateString('it-IT')}`, mx, 290);
    if (pages > 1) doc.text(`Pagina ${p} di ${pages}`, right, 290, { align: 'right' });
  }

  return saveFile(doc.output('blob'), fileName(list, 'pdf'));
}

// ───────────────────────────── Excel ─────────────────────────────
export function exportServicesExcel(list, opts = {}) {
  const ws = XLSX.utils.aoa_to_sheet(servicesExcelRows(list, opts));
  ws['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prestazioni');
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFile(blob, fileName(list, 'xlsx'));
}

// Le righe del foglio Excel (separate per poterle provare nei test). Importi sempre in colonna E.
export function servicesExcelRows(list, { headerLines = [], rivalsaLabel = 'Rivalsa', settings = {} } = {}) {
  const tot = (label, value, hours = '') => [safeText(label), '', hours, '', value];
  const rows = [
    ['Elenco prestazioni'],
    ...headerLines.map((l) => [safeText(String(l))]),
    [`Periodo: ${periodLabel(list.fromISO, list.toISO)}`],
    ...(list.forClient && list.client ? [[safeText(`Cliente: ${list.client.name}`)]] : []),
    [],
    ['Data', 'Descrizione', 'Ore', '€/h', 'Importo €'],
  ];
  for (const g of list.groups) {
    if (!list.forClient) rows.push([safeText(g.site.name)]);
    for (const r of g.rows) rows.push([itDate(r.date), safeText(r.description), r.hours, r.rate, r.amount]);
    rows.push(tot(list.forClient ? 'Totale prestazioni' : `Totale ${g.site.name}`, g.total, g.totalHours));
    rows.push([]);
  }
  if (list.occasional.length > 0) {
    rows.push(['Prestazioni occasionali']);
    for (const o of list.occasional) rows.push([itDate(o.date), safeText(o.description), '', '', o.amount]);
    rows.push(tot('Totale prestazioni occasionali', list.occasionalGross));
    rows.push([]);
  }

  rows.push(['Riepilogo']);
  rows.push(tot('Ore totali', '', list.totalHours));
  rows.push(tot(compensiLabel(list), list.revenue));
  if (list.rivalsa > 0) rows.push(tot(rivalsaRowLabel(list, rivalsaLabel), list.rivalsa));
  if (list.forClient) {
    rows.push(tot('Totale da pagare', list.invoice));
    const notes = invoiceNotes(settings, list.invoice);
    if (notes.length) rows.push([], ['Diciture per la fattura'], ...notes.map((n) => [n]));
  } else {
    rows.push(tot('Totale fatturato', list.invoice));
    for (const [label, v] of taxLines(list)) rows.push(tot(label, -v));
    rows.push(tot(list.occasional.length ? 'Netto partita IVA' : 'Netto stimato', list.net));
    if (list.occasional.length > 0) {
      rows.push(tot('Prestazioni occasionali (lordo)', list.occasionalGross));
      rows.push(tot(`Tasse stimate (${list.occasionalTaxPercent}%)`, -list.occasionalTaxes));
      rows.push(tot('Netto totale', list.netTotal));
    }
    rows.push([], ['Tasse, contributi e netto sono stime: non sostituiscono il calcolo del commercialista.']);
  }
  return rows;
}
