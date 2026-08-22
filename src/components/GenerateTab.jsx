import React, { useState } from 'react';
import { generateSchedule, monthDays, weekdayOf, staffStats } from '../lib/scheduler.js';
import { exportExcel } from '../lib/excel.js';
import { MONTHS_IT, WEEKDAYS_IT } from '../lib/defaults.js';

export default function GenerateTab({ state }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);

  const generate = () => {
    const result = generateSchedule(Number(year), Number(month), {
      shifts: state.shifts,
      roles: state.roles,
      rules: state.rules,
      staff: state.staff,
      unavailability: state.unavailability,
    });
    setData(result);
  };

  const doExport = () => {
    if (!data) return;
    exportExcel(data, state.shifts);
  };

  const hoursFor = (c) => Number(state.shifts[c]?.hours || 0);
  const days = data ? data.days : monthDays(year, month);

  // statistiche globali
  const totals = data ? computeTotals(data, state.shifts) : null;

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Genera & Export</h2>
        <p className="panel-desc">Genera il planning mensile e scaricalo in Excel (3 fogli: planning, legenda, riepilogo).</p>

        <div className="form-row">
          <div className="field">
            <label className="field-label">Mese</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS_IT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label className="field-label">Anno</label>
            <input type="number" min={2000} max={2100} value={year}
              onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={state.staff.length === 0}>
            Genera turni
          </button>
          <button className="btn" onClick={doExport} disabled={!data}>
            Esporta Excel
          </button>
        </div>

        {state.staff.length === 0 && (
          <div className="hint hint-warn">Aggiungi del personale prima di generare il planning.</div>
        )}

        <div className="legend">
          {Object.entries(state.shifts).map(([c, m]) => (
            <span key={c} className="legend-chip">
              <b className={`cell cell-${c}`}>{c}</b>
              {m.description} {m.hours ? `· ${m.hours}h` : ''}
            </span>
          ))}
        </div>
      </div>

      {totals && (
        <div className="stats-row">
          <div className="stat"><div className="stat-label">Persone</div><div className="stat-value">{Object.keys(data.schedule).length}</div></div>
          <div className="stat"><div className="stat-label">Ore totali</div><div className="stat-value">{totals.hours}</div></div>
          <div className="stat"><div className="stat-label">Notti</div><div className="stat-value">{totals.nights}</div></div>
          <div className="stat"><div className="stat-label">Riposi</div><div className="stat-value">{totals.rests}</div></div>
        </div>
      )}

      {data && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="sticky">Nome</th>
                  {range(1, days).map((d) => {
                    const wd = weekdayOf(data.year, data.month, d);
                    const weekend = wd >= 5;
                    return (
                      <th key={d} className={`day-h ${weekend ? 'weekend' : ''}`}>
                        <div>{d}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-mut)' }}>{WEEKDAYS_IT[wd]}</div>
                      </th>
                    );
                  })}
                  <th className="day-h">Ore</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.schedule).map(([id, s]) => {
                  const st = staffStats(s.days, state.shifts);
                  return (
                    <tr key={id}>
                      <td className="sticky">
                        {s.name} <span style={{ color: 'var(--text-mut)', fontSize: 11 }}>({s.role})</span>
                      </td>
                      {range(1, days).map((d) => {
                        const code = s.days[d - 1] ?? '';
                        const wd = weekdayOf(data.year, data.month, d);
                        return (
                          <td key={d} className={wd >= 5 ? 'weekend' : ''}>
                            <span className={`cell cell-${code}`}>{code}</span>
                          </td>
                        );
                      })}
                      <td className="tot">{st.hours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function computeTotals(data, shifts) {
  let hours = 0, nights = 0, rests = 0;
  for (const s of Object.values(data.schedule)) {
    const st = staffStats(s.days, shifts);
    hours += st.hours; nights += st.nights; rests += st.rests;
  }
  return { hours, nights, rests };
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}
