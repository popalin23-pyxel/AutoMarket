import React, { useState, useMemo } from 'react';
import {
  generateSchedule, monthDays, weekdayOf, staffStats,
  coverageDeficits, holidaysOfYear, isHoliday,
} from '../lib/scheduler.js';
import { exportExcel } from '../lib/excel.js';
import { MONTHS_IT, WEEKDAYS_IT } from '../lib/defaults.js';
import { saveSchedule, removeSchedule } from '../lib/store.js';

export default function GenerateTab({ state, setState }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [showDeficits, setShowDeficits] = useState(false);

  const generate = () => {
    const result = generateSchedule(Number(year), Number(month), {
      shifts: state.shifts, roles: state.roles, rules: state.rules,
      staff: state.staff, unavailability: state.unavailability,
    });
    setData(result);
  };

  const doExport = () => { if (data) exportExcel(data, state.shifts); };

  const save = () => {
    if (!data) return;
    const def = `${MONTHS_IT[data.month - 1]} ${data.year}`;
    const name = prompt('Nome del planning da salvare:', def);
    if (name === null) return;
    setState((s) => saveSchedule(s, data, name.trim() || def));
  };

  const reopen = (entry) => { setData(entry.data); setYear(entry.year); setMonth(entry.month); };
  const delHist = (id) => setState((s) => removeSchedule(s, id));

  const days = data ? data.days : monthDays(year, month);
  const holidaySet = useMemo(() => holidaysOfYear(Number(year)), [year]);

  // avvisi di copertura ricalcolati in tempo reale (anche dopo modifiche manuali)
  const deficits = useMemo(
    () => (data ? coverageDeficits(data, state.shifts, state.rules) : []),
    [data, state.shifts, state.rules],
  );

  const totals = data ? computeTotals(data, state.shifts) : null;
  const targetById = useMemo(() => {
    const m = new Map();
    for (const s of state.staff) m.set(String(s.id), Number(s.contractHours) || 0);
    return m;
  }, [state.staff]);

  // modifica manuale: tap sulla cella → prossimo turno ammesso per quel ruolo
  const cycleCell = (staffId, dayIdx) => {
    setData((prev) => {
      if (!prev) return prev;
      const s = prev.schedule[staffId];
      const allowed = state.roles[s.role] ?? Object.keys(state.shifts);
      if (allowed.length === 0) return prev;
      const cur = s.days[dayIdx];
      const pos = allowed.indexOf(cur);
      const next = allowed[(pos + 1) % allowed.length];
      const newDays = s.days.slice(); newDays[dayIdx] = next;
      return {
        ...prev,
        schedule: { ...prev.schedule, [staffId]: { ...s, days: newDays } },
      };
    });
  };

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Genera & Export</h2>
        <p className="panel-desc">
          Genera il planning mensile rispettando la copertura richiesta e le regole.
          Poi puoi <b>modificare a mano</b> ogni cella (tap/clic per cambiare turno) ed esportare in Excel.
        </p>

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
          <button className="btn" onClick={doExport} disabled={!data}>Esporta Excel</button>
          <button className="btn" onClick={save} disabled={!data}>Salva nello storico</button>
        </div>

        {state.staff.length === 0 && (
          <div className="hint hint-warn">Aggiungi del personale prima di generare il planning.</div>
        )}

        {data && deficits.length > 0 && (
          <div className="hint hint-warn" style={{ cursor: 'pointer' }} onClick={() => setShowDeficits((v) => !v)}>
            ⚠️ {deficits.length} turni sotto-copertura in {new Set(deficits.map((d) => d.day)).size} giorni.
            {' '}<u>{showDeficits ? 'Nascondi' : 'Dettagli'}</u>
            {showDeficits && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {deficits.map((d, i) => (
                  <span key={i} style={{ marginRight: 12 }}>
                    {d.day} {MONTHS_IT[(data.month - 1)].slice(0, 3)}: {d.code} {d.got}/{d.needed}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {data && deficits.length === 0 && (
          <div className="hint hint-info">✓ Copertura completa per tutti i giorni.</div>
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
                    const holiday = isHoliday(data.year, data.month, d, holidaySet);
                    const weekend = wd >= 5 || holiday;
                    return (
                      <th key={d} className={`day-h ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`} title={holiday ? 'Festivo' : ''}>
                        <div>{d}</div>
                        <div style={{ fontSize: 9, color: holiday ? 'var(--red)' : 'var(--text-mut)' }}>
                          {holiday ? '★' : WEEKDAYS_IT[wd]}
                        </div>
                      </th>
                    );
                  })}
                  <th className="day-h">Ore</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.schedule).map(([id, s]) => {
                  const stt = staffStats(s.days, state.shifts);
                  const target = targetById.get(id) || 0;
                  const totClass = target > 0
                    ? (stt.hours > target ? 'red' : stt.hours < target * 0.85 ? 'under' : 'ok')
                    : '';
                  return (
                    <tr key={id}>
                      <td className="sticky">
                        {s.name} <span style={{ color: 'var(--text-mut)', fontSize: 11 }}>({s.role})</span>
                      </td>
                      {range(1, days).map((d) => {
                        const code = s.days[d - 1] ?? '';
                        const wd = weekdayOf(data.year, data.month, d);
                        const holiday = isHoliday(data.year, data.month, d, holidaySet);
                        return (
                          <td key={d} className={(wd >= 5 || holiday) ? 'weekend' : ''}
                            onClick={() => cycleCell(id, d - 1)}
                            style={{ cursor: 'pointer' }} title="Clic per cambiare turno">
                            <span className={`cell cell-${code}`}>{code}</span>
                          </td>
                        );
                      })}
                      <td className={`tot tot-${totClass}`} title={target ? `Contratto: ${target}h` : ''}>
                        {stt.hours}{target ? <span style={{ fontSize: 9, color: 'var(--text-mut)' }}>/{target}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(state.history?.length > 0) && (
        <div className="panel">
          <h2 className="panel-title">Storico planning</h2>
          <p className="panel-desc">Planning salvati su questo dispositivo. “Riapri” lo carica nella griglia per rivederlo, modificarlo o riesportarlo.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>Periodo</th><th>Salvato il</th><th style={{ width: 260 }}></th></tr>
              </thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>{MONTHS_IT[h.month - 1]} {h.year}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {new Date(h.savedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => reopen(h)}>Riapri</button>
                        <button className="btn btn-sm" onClick={() => exportExcel(h.data, state.shifts)}>Excel</button>
                        <button className="btn btn-sm btn-danger" onClick={() => delHist(h.id)}>Elimina</button>
                      </div>
                    </td>
                  </tr>
                ))}
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
