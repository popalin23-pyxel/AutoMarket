// Export PDF del riepilogo mensile (jsPDF, generato interamente nel browser).

import { jsPDF } from 'jspdf';
import { MONTHS_IT } from './defaults.js';

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function exportMonthPdf(sum, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 18;
  let y = 20;

  // ── Intestazione ──────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 42, 61);
  doc.text('Turnio', marginX, y);
  doc.setFontSize(10);
  doc.setTextColor(120, 130, 140);
  doc.setFont('helvetica', 'normal');
  doc.text('Riepilogo turni e compensi', marginX, y + 6);
  if (opts.userLabel) doc.text(opts.userLabel, 210 - marginX, y, { align: 'right' });

  y += 16;
  doc.setDrawColor(220, 226, 232);
  doc.line(marginX, y, 210 - marginX, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 42, 61);
  doc.text(`${MONTHS_IT[sum.month - 1]} ${sum.year}`, marginX, y);
  y += 10;

  // ── Tabella per sede ──────────────────────────────────────
  const cols = [
    { label: 'Sede', x: marginX, w: 46 },
    { label: 'Ore', x: marginX + 46, w: 18, align: 'right' },
    { label: '€/h', x: marginX + 64, w: 18, align: 'right' },
    { label: 'Fatturato', x: marginX + 82, w: 28, align: 'right' },
    { label: 'Rivalsa', x: marginX + 110, w: 26, align: 'right' },
    { label: 'Totale', x: marginX + 136, w: 28, align: 'right' },
  ];

  doc.setFillColor(240, 244, 248);
  doc.rect(marginX, y - 5, 210 - marginX * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 110);
  cols.forEach((c) => doc.text(c.label, c.x + (c.align === 'right' ? c.w : 0), y, { align: c.align || 'left' }));
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 40, 50);
  for (const p of sum.perSite) {
    doc.text(String(p.name), cols[0].x, y);
    doc.text(fmt(p.hours), cols[1].x + cols[1].w, y, { align: 'right' });
    doc.text(p.rate ? fmt(p.rate) : '–', cols[2].x + cols[2].w, y, { align: 'right' });
    doc.text(`€${fmt(p.revenue)}`, cols[3].x + cols[3].w, y, { align: 'right' });
    doc.text(`€${fmt(p.rivalsa)}`, cols[4].x + cols[4].w, y, { align: 'right' });
    doc.text(`€${fmt(p.total)}`, cols[5].x + cols[5].w, y, { align: 'right' });
    y += 7;
  }

  y += 4;
  doc.setDrawColor(220, 226, 232);
  doc.line(marginX, y, 210 - marginX, y);
  y += 10;

  // ── Totali ────────────────────────────────────────────────
  const totalRow = (label, value, opts2 = {}) => {
    doc.setFont('helvetica', opts2.bold ? 'bold' : 'normal');
    doc.setFontSize(opts2.bold ? 12 : 10);
    doc.setTextColor(...(opts2.color || [60, 70, 80]));
    doc.text(label, marginX, y);
    doc.text(value, 210 - marginX, y, { align: 'right' });
    y += opts2.bold ? 8 : 7;
  };

  totalRow('Ore totali', `${fmt(sum.totalHours)} h`);
  totalRow('Compensi + rivalsa (fatturato)', `€${fmt(sum.totalInvoice)}`);
  totalRow(`Tasse da accantonare (${sum.taxPercent}%)`, `−€${fmt(sum.taxes)}`, { color: [225, 29, 72] });
  y += 2;
  doc.setDrawColor(200, 208, 216);
  doc.line(marginX, y - 5, 210 - marginX, y - 5);
  totalRow('Netto stimato', `€${fmt(sum.net)}`, { bold: true, color: [5, 150, 105] });

  // ── Nota fiscale + piè di pagina ──────────────────────────
  y += 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 148, 156);
  const disclaimer = 'Il netto è una stima basata sulle percentuali impostate in app: non sostituisce il calcolo del commercialista.';
  doc.text(doc.splitTextToSize(disclaimer, 210 - marginX * 2), marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generato da Turnio il ${new Date().toLocaleDateString('it-IT')}`, marginX, 287);

  doc.save(`turnio_${sum.year}_${String(sum.month).padStart(2, '0')}.pdf`);
}
