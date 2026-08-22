import React, { useState, useMemo } from 'react';
import {
  generateSchedule, monthDays, weekdayOf, staffStats,
  coverageDeficits, holidaysOfYear, isHoliday,
} from '../lib/scheduler.js';
import { exportExcel } from '../lib/excel.js';
import { saveSchedule, removeSchedule } from '../lib/store.js';
import {
  exportPersonICS, personSummaryText, shareWhatsApp, shareEmail,
} from '../lib/exports.js';
import { useT, useLang, monthsFor, weekdaysFor } from '../lib/i18n.js';

export default function GenerateTab({ state, setState }) {
  const t = useT();
  const lang = useLang();
  const months = monthsFor(lang);
  const weekdays = weekdaysFor(lang);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [showDeficits, setShowDeficits] = useState(false);
  const [personId, setPersonId] = useState('');

  const generate = () => {
    setData(generateSchedule(Number(year), Number(month), {
      shifts: state.shifts, roles: state.roles, rules: state.rules,
      staff: state.staff, unavailability: state.unavailability,
    }));
  };

  const doExport = () => { if (data) exportExcel(data, state.shifts); };

  const save = () => {
    if (!data) return;
    const def = `${months[data.month - 1]} ${data.year}`;
    const name = prompt(t('gen.promptName'), def);
    if (name === null) return;
    setState((s) => saveSchedule(s, data, name.trim() || def));
  };

  const reopen = (entry) => { setData(entry.data); setYear(entry.year); setMonth(entry.month); };
  const delHist = (id) => setState((s) => removeSchedule(s, id));

  const doPrint = () => window.print();
  const pid = () => personId || (data ? Object.keys(data.schedule)[0] : '');
  const shareText = () => (data ? personSummaryText(data, state.shifts, pid()) : '');
  const personName = () => (data ? data.schedule[pid()]?.name : '');

  const days = data ? data.days : monthDays(year, month);
  const holidaySet = useMemo(() => holidaysOfYear(Number(year)), [year]);
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

  const cycleCell = (staffId, dayIdx) => {
    setData((prev) => {
      if (!prev) return prev;
      const s = prev.schedule[staffId];
      const allowed = state.roles[s.role] ?? Object.keys(state.shifts);
      if (allowed.length === 0) return prev;
      const pos = allowed.indexOf(s.days[dayIdx]);
      const next = allowed[(pos + 1) % allowed.length];
      const newDays = s.days.slice(); newDays[dayIdx] = next;
      return { ...prev, schedule: { ...prev.schedule, [staffId]: { ...s, days: newDays } } };
    });
  };

  return (
    <>
      <div className="panel no-print">
        <h2 className="panel-title">{t('gen.title')}</h2>
        <p className="panel-desc">{t('gen.desc')}</p>

        <div className="form-row">
          <div className="field">
            <label className="field-label">{t('gen.month')}</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label className="field-label">{t('gen.year')}</label>
            <input type="number" min={2000} max={2100} value={year}
              onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={state.staff.length === 0}>{t('gen.generate')}</button>
          <button className="btn" onClick={doExport} disabled={!data}>{t('gen.excel')}</button>
          <button className="btn" onClick={save} disabled={!data}>{t('gen.saveHist')}</button>
        </div>

        {state.staff.length === 0 && <div className="hint hint-warn">{t('gen.needStaff')}</div>}

        {data && deficits.length > 0 && (
          <div className="hint hint-warn" style={{ cursor: 'pointer' }} onClick={() => setShowDeficits((v) => !v)}>
            ⚠️ {deficits.length} {t('gen.deficitPre')} {new Set(deficits.map((d) => d.day)).size} {t('gen.deficitDays')}
            {' '}<u>{showDeficits ? t('gen.hide') : t('gen.details')}</u>
            {showDeficits && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {deficits.map((d, i) => (
                  <span key={i} style={{ marginRight: 12 }}>
                    {d.day} {months[data.month - 1].slice(0, 3)}: {d.code} {d.got}/{d.needed}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {data && deficits.length === 0 && <div className="hint hint-info">{t('gen.covOK')}</div>}

        <div className="legend">
          {Object.entries(state.shifts).map(([c, m]) => (
            <span key={c} className="legend-chip">
              <b className={`cell cell-${c}`}>{c}</b>
              {m.description} {m.hours ? `· ${m.hours}h` : ''}
            </span>
          ))}
        </div>

        {data && (
          <div className="form-row no-print" style={{ marginTop: 16, marginBottom: 0, alignItems: 'center' }}>
            <button className="btn" onClick={doPrint}>{t('gen.print')}</button>
            <span style={{ color: 'var(--text-mut)', fontSize: 12 }}>{t('gen.calPerson')}</span>
            <div className="field" style={{ minWidth: 160 }}>
              <select value={pid()} onChange={(e) => setPersonId(e.target.value)}>
                {Object.entries(data.schedule).map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-sm" onClick={() => exportPersonICS(data, state.shifts, pid())}>📅 .ics</button>
            <button className="btn btn-sm" onClick={() => shareWhatsApp(shareText())}>WhatsApp</button>
            <button className="btn btn-sm" onClick={() => shareEmail(`${personName()} — ${months[data.month - 1]} ${data.year}`, shareText())}>Email</button>
          </div>
        )}
      </div>

      {totals && (
        <div className="stats-row no-print">
          <div className="stat"><div className="stat-label">{t('gen.people')}</div><div className="stat-value">{Object.keys(data.schedule).length}</div></div>
          <div className="stat"><div className="stat-label">{t('gen.totHours')}</div><div className="stat-value">{totals.hours}</div></div>
          <div className="stat"><div className="stat-label">{t('gen.nights')}</div><div className="stat-value">{totals.nights}</div></div>
          <div className="stat"><div className="stat-label">{t('gen.rests')}</div><div className="stat-value">{totals.rests}</div></div>
        </div>
      )}

      {data && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="print-only print-title">{months[data.month - 1]} {data.year}</div>
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="sticky">{t('gen.colName')}</th>
                  {range(1, days).map((d) => {
                    const wd = weekdayOf(data.year, data.month, d);
                    const holiday = isHoliday(data.year, data.month, d, holidaySet);
                    const weekend = wd >= 5 || holiday;
                    return (
                      <th key={d} className={`day-h ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`} title={holiday ? t('gen.holiday') : ''}>
                        <div>{d}</div>
                        <div style={{ fontSize: 9, color: holiday ? 'var(--red)' : 'var(--text-mut)' }}>
                          {holiday ? '★' : weekdays[wd]}
                        </div>
                      </th>
                    );
                  })}
                  <th className="day-h">{t('gen.colHours')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.schedule).map(([id, s]) => {
                  const stt = staffStats(s.days, state.shifts);
                  const target = targetById.get(id) || 0;
                  const totClass = target > 0
                    ? (stt.hours > target ? 'red' : stt.hours < target * 0.85 ? 'under' : 'ok') : '';
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
                            onClick={() => cycleCell(id, d - 1)} style={{ cursor: 'pointer' }} title={t('gen.changeShift')}>
                            <span className={`cell cell-${code}`}>{code}</span>
                          </td>
                        );
                      })}
                      <td className={`tot tot-${totClass}`} title={target ? `${target}h` : ''}>
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
        <div className="panel no-print">
          <h2 className="panel-title">{t('gen.histTitle')}</h2>
          <p className="panel-desc">{t('gen.histDesc')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('c.name')}</th><th>{t('c.period')}</th><th>{t('gen.savedAt')}</th><th style={{ width: 220 }}></th></tr>
              </thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>{months[h.month - 1]} {h.year}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {new Date(h.savedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => reopen(h)}>{t('gen.reopen')}</button>
                        <button className="btn btn-sm" onClick={() => exportExcel(h.data, state.shifts)}>Excel</button>
                        <button className="btn btn-sm btn-danger" onClick={() => delHist(h.id)}>{t('c.delete')}</button>
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
