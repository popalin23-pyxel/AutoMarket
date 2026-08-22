// Export aggiuntivi: calendario .ics per persona e testo condivisibile (WhatsApp/email).

import { MONTHS_IT, WEEKDAYS_IT } from './defaults.js';
import { weekdayOf } from './scheduler.js';

// Orari di default per i turni noti (inizio, fine). La notte finisce il giorno dopo.
const SHIFT_TIMES = {
  M: ['07:00', '14:00', false],
  P: ['14:00', '21:00', false],
  N: ['22:00', '08:00', true], // true = fine il giorno successivo
};

function pad(n) { return String(n).padStart(2, '0'); }

function icsDateTime(year, month, day, hhmm, nextDay) {
  let d = new Date(year, month - 1, day);
  if (nextDay) d = new Date(year, month - 1, day + 1);
  const [h, m] = hhmm.split(':');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${h}${m}00`;
}

function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Genera un file .ics con i turni lavorativi di UNA persona.
export function exportPersonICS(data, shifts, staffId) {
  const s = data.schedule[String(staffId)];
  if (!s) return;
  const { year, month } = data;
  const stamp = new Date();
  const dtstamp = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}T${pad(stamp.getHours())}${pad(stamp.getMinutes())}00`;

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Turnify//Web//IT', 'CALSCALE:GREGORIAN',
  ];

  s.days.forEach((code, i) => {
    const meta = shifts[code];
    if (!meta?.working) return;
    const day = i + 1;
    const uid = `turnify-${staffId}-${year}${pad(month)}${pad(day)}-${code}@turnify`;
    const summary = `${code} · ${meta.description || code} (${s.name})`;
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${dtstamp}`);
    const times = SHIFT_TIMES[code];
    if (times) {
      lines.push(
        `DTSTART:${icsDateTime(year, month, day, times[0], false)}`,
        `DTEND:${icsDateTime(year, month, day, times[1], times[2])}`,
      );
    } else {
      // turno senza orario noto → evento "tutto il giorno"
      const d = new Date(year, month - 1, day);
      const d2 = new Date(year, month - 1, day + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
        `DTEND;VALUE=DATE:${d2.getFullYear()}${pad(d2.getMonth() + 1)}${pad(d2.getDate())}`,
      );
    }
    lines.push(`SUMMARY:${summary}`, 'END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const safeName = s.name.replace(/[^\w]+/g, '_');
  download(`turnify_${safeName}_${year}_${pad(month)}.ics`, lines.join('\r\n'), 'text/calendar');
}

// Testo riepilogativo dei turni di una persona (per WhatsApp/email)
export function personSummaryText(data, shifts, staffId) {
  const s = data.schedule[String(staffId)];
  if (!s) return '';
  const { year, month } = data;
  const header = `Turni di ${s.name} — ${MONTHS_IT[month - 1]} ${year}`;
  const rows = s.days.map((code, i) => {
    const day = i + 1;
    const wd = WEEKDAYS_IT[weekdayOf(year, month, day)];
    const desc = shifts[code]?.description || code;
    return `${pad(day)} ${wd}: ${code} (${desc})`;
  });
  return `${header}\n${rows.join('\n')}`;
}

export function shareWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function shareEmail(subject, body) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
