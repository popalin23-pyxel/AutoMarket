import { describe, it, expect } from 'vitest';
import { timesheetExcelRows } from './timesheet.js';

const ts = {
  site: { name: 'Clinica Rossi' },
  fromISO: '2026-11-01', toISO: '2026-11-30',
  rows: [
    { date: '2026-11-03', start: '08:00', end: '14:00', hours: 6, rate: 40, amount: 240, note: '' },
    { date: '2026-11-05', start: '14:00', end: '20:00', hours: 6, rate: 40, amount: 240, note: '=nota' },
  ],
  totalHours: 12, revenue: 480, rivalsaPercent: 4, rivalsa: 19.2, total: 499.2, inclusive: false,
};
const flat = (rows) => rows.flat().map(String).join('|');

describe('foglio ore Excel', () => {
  it('di base (ore, tariffa e totale) contiene le cifre in euro', () => {
    const rows = timesheetExcelRows(ts, { rivalsaLabel: 'Rivalsa INPS' });
    expect(rows).toContainEqual(['Data', 'Giorno', 'Inizio', 'Fine', 'Ore', '€/h', 'Importo', 'Note']);
    expect(rows.at(-1)).toEqual(['Totale', '', '', '', '', '', 499.2]);
    expect(flat(rows)).toContain('Rivalsa INPS 4%');
  });

  it('"solo ore" non contiene tariffa, importi né totali in euro', () => {
    const rows = timesheetExcelRows(ts, { rivalsaLabel: 'Rivalsa INPS', withMoney: false });
    expect(rows).toContainEqual(['Data', 'Giorno', 'Inizio', 'Fine', 'Ore', 'Note']);
    expect(rows).toContainEqual(['03/11/2026', expect.any(String), '08:00', '14:00', 6, '']);
    expect(rows.at(-1)).toEqual(['Ore totali', '', '', '', 12]);
    const text = flat(rows);
    for (const bad of ['€', 'Importo', 'Totale', 'Compenso', 'Rivalsa', '240', '499']) expect(text).not.toContain(bad);
    expect(text).toContain("'=nota"); // protezione formule mantenuta
  });
});
