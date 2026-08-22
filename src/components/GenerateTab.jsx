import React, { useState, useMemo } from 'react';
import {
  generateSchedule, monthDays, weekdayOf, staffStats,
  coverageDeficits, coverageHoursDeficits, holidaysOfYear, isHoliday,
  fillGaps, balance,
} from '../lib/scheduler.js';
import { exportExcel } from '../lib/excel.js';
import { saveSchedule, removeSchedule, setGenMode } from '../lib/store.js';
import {
  exportPersonICS, personSummaryText, shareWhatsApp, shareEmail,
} from '../lib/exports.js';
import { useT, useLang, monthsFor, weekdaysFor } from '../lib/i18n.js';
import Wallboard from './Wallboard.jsx';
import QrModal from './QrModal.jsx';

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
      staff: state.staff, unavailability: state.unavailability, floors: state.floors,
      mode: state.rules.genMode,
    }));
  };
  const changeMode = (m) => setState((s) => setGenMode(s, m));

  const workingSet = new Set(Object.keys(state.shifts).filter((c) => state.shifts[c]?.working));
  const multiFloor = (state.floors?.length ?? 0) > 1;
  const floorLabelMap = useMemo(() => {
    const m = {};
    (state.floors ?? []).forEach((f, i) => {
      const num = (String(f.name).match(/\d+/) || [])[0];
      m[f.id] = num || String(i + 1);
    });
    return m;
  }, [state.floors]);
  const floorTag = (fid) => (fid && multiFloor ? (floorLabelMap[fid] ?? '') : '');
  const firstFloorFor = (staffId) => {
    const person = state.staff.find((p) => String(p.id) === String(staffId));
    const allowed = person?.floors?.length ? person.floors : (state.floors ?? []).map((f) => f.id);
    return allowed[0] ?? '';
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
  const hasHoursTargets = useMemo(() => {
    const ch = state.rules.coverageHours ?? {};
    return Object.values(ch).some((fl) => Object.values(fl || {}).some((c) => (c?.weekday || 0) > 0 || (c?.weekend || 0) > 0));
  }, [state.rules.coverageHours]);
  const hoursMode = data ? (data.mode === 'hours' || (data.mode === 'rotation' && hasHoursTargets)) : false;
  const deficits = useMemo(
    () => (!data ? []
      : (hoursMode ? coverageHoursDeficits(data, state.shifts, state.rules)
                   : coverageDeficits(data, state.shifts, state.rules))),
    [data, state.shifts, state.rules, hoursMode],
  );
  const totals = data ? computeTotals(data, state.shifts) : null;
  const targetById = useMemo(() => {
    const m = new Map();
    for (const s of state.staff) m.set(String(s.id), Number(s.contractHours) || 0);
    return m;
  }, [state.staff]);

  const [editing, setEditing] = useState(null); // { id, idx }
  const [undo, setUndo] = useState([]);
  const [showWall, setShowWall] = useState(false);
  const [qr, setQr] = useState(null); // { text, title }

  const qrForPerson = () => {
    if (!data) return null;
    const s = data.schedule[pid()];
    if (!s) return null;
    const compact = s.days.map((c, i) => (state.shifts[c]?.working ? `${i + 1}${c}` : '')).filter(Boolean).join(' ');
    return { title: `${s.name} · ${months[data.month - 1]} ${data.year}`, text: `${s.name} ${months[data.month - 1].slice(0, 3)}${data.year}: ${compact}` };
  };
  const openEditor = (id, idx) => setEditing({ id, idx });
  const snap = () => setUndo((u) => (data ? [data, ...u].slice(0, 30) : u));
  const doUndo = () => setUndo((u) => { if (u.length) setData(u[0]); return u.slice(1); });

  const ctx = () => ({ shifts: state.shifts, roles: state.roles, rules: state.rules, staff: state.staff, floors: state.floors });
  const doFill = () => { if (!data) return; snap(); setData(fillGaps(data, ctx())); };
  const doBalance = () => { if (!data) return; snap(); setData(balance(data, ctx())); };

  const setCell = (id, idx, code) => {
    snap();
    setData((prev) => {
      if (!prev) return prev;
      const s = prev.schedule[id];
      const newDays = s.days.slice(); newDays[idx] = code;
      const newFloors = (s.floors ? s.floors.slice() : new Array(newDays.length).fill(''));
      newFloors[idx] = state.shifts[code]?.working ? (newFloors[idx] || firstFloorFor(id)) : '';
      return { ...prev, schedule: { ...prev.schedule, [id]: { ...s, days: newDays, floors: newFloors } } };
    });
  };

  const setCellFloor = (id, idx, floor) => {
    snap();
    setData((prev) => {
      if (!prev) return prev;
      const s = prev.schedule[id];
      const newFloors = (s.floors ? s.floors.slice() : new Array(s.days.length).fill(''));
      newFloors[idx] = floor;
      return { ...prev, schedule: { ...prev.schedule, [id]: { ...s, floors: newFloors } } };
    });
  };

  // Colleghi liberi (a Riposo) quel giorno, stesso ruolo, idonei al piano
  const freeColleagues = (id, idx, floor) => {
    if (!data) return [];
    const me = data.schedule[id];
    return Object.entries(data.schedule)
      .filter(([oid, s]) => {
        if (oid === id || s.role !== me.role) return false;
        if (state.shifts[s.days[idx]]?.working) return false;
        const person = state.staff.find((p) => String(p.id) === String(oid));
        return !person?.floors?.length || !floor || person.floors.includes(floor);
      })
      .map(([oid, s]) => ({ id: oid, name: s.name }));
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
          <div className="field">
            <label className="field-label">{t('gen.mode')}</label>
            <select value={state.rules.genMode ?? 'count'} onChange={(e) => changeMode(e.target.value)}>
              <option value="count">{t('gen.modeCount')}</option>
              <option value="hours">{t('gen.modeHours')}</option>
              <option value="rotation">{t('gen.modeRotation')}</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={state.staff.length === 0}>{t('gen.generate')}</button>
          <button className="btn" onClick={doExport} disabled={!data}>{t('gen.excel')}</button>
          <button className="btn" onClick={save} disabled={!data}>{t('gen.saveHist')}</button>
        </div>

        {state.staff.length === 0 && <div className="hint hint-warn">{t('gen.needStaff')}</div>}

        {data && deficits.length > 0 && (
          <div className="hint hint-warn" style={{ cursor: 'pointer' }} onClick={() => setShowDeficits((v) => !v)}>
            ⚠️ {deficits.length} {hoursMode ? t('gen.deficitHoursPre') : t('gen.deficitPre')} {new Set(deficits.map((d) => d.day)).size} {t('gen.deficitDays')}
            {' '}<u>{showDeficits ? t('gen.hide') : t('gen.details')}</u>
            {showDeficits && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {deficits.slice(0, 40).map((d, i) => (
                  <span key={i} style={{ marginRight: 12 }}>
                    {d.day}: {multiFloor && d.floorName ? `${d.floorName} · ` : ''}{d.role}{' '}
                    {hoursMode ? `${d.gotHours}/${d.neededHours}${t('gen.hoursUnit')}` : `${d.code} ${d.got}/${d.needed}`}
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
            <button className="btn btn-primary" onClick={doFill}>{t('gen.fill')}</button>
            <button className="btn" onClick={doBalance}>{t('gen.balance')}</button>
            <button className="btn" onClick={doUndo} disabled={undo.length === 0}>{t('gen.undo')}</button>
            <button className="btn" onClick={() => setShowWall(true)}>{t('gen.wallboard')}</button>
            <button className="btn" onClick={doPrint}>{t('gen.print')}</button>
            <span style={{ color: 'var(--text-mut)', fontSize: 12 }}>{t('gen.calPerson')}</span>
            <div className="field" style={{ minWidth: 160 }}>
              <select value={pid()} onChange={(e) => setPersonId(e.target.value)}>
                {Object.entries(data.schedule).map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-sm" onClick={() => exportPersonICS(data, state.shifts, pid())}>📅 .ics</button>
            <button className="btn btn-sm" onClick={() => setQr(qrForPerson())}>{t('gen.qr')}</button>
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
                            onClick={() => openEditor(id, d - 1)} style={{ cursor: 'pointer' }} title={t('gen.changeShift')}>
                            <span className={`cell cell-${code}`}>{code}</span>
                            {workingSet.has(code) && floorTag(s.floors?.[d - 1]) &&
                              <span className="floor-tag">{floorTag(s.floors?.[d - 1])}</span>}
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

      {/* Analisi & Equità (futuristico) */}
      {data && (
        <div className="panel no-print">
          <h2 className="panel-title">{t('gen.analysis')}</h2>
          <div className="coverage-strip-label">{t('gen.coverStrip')}</div>
          <div className="coverage-strip">
            {range(1, data.days).map((d) => {
              const bad = deficits.some((x) => x.day === d);
              return <div key={d} className={`cov-cell ${bad ? 'bad' : 'ok'}`} title={`${d}${bad ? ' ⚠' : ' ✓'}`}>{d}</div>;
            })}
          </div>

          <div className="coverage-strip-label" style={{ marginTop: 16 }}>{t('gen.perPerson')}</div>
          <div className="load-bars">
            {(() => {
              const rows = Object.entries(data.schedule).map(([id, s]) => ({ id, s, st: staffStats(s.days, state.shifts) }));
              const maxH = Math.max(1, ...rows.map((r) => r.st.hours));
              return rows.map(({ id, s, st }) => {
                const wkend = range(1, data.days).filter((d) => {
                  const wd = weekdayOf(data.year, data.month, d);
                  const hol = isHoliday(data.year, data.month, d, holidaySet);
                  return (wd >= 5 || hol) && state.shifts[s.days[d - 1]]?.working;
                }).length;
                return (
                  <div key={id} className="load-row">
                    <span className="load-name">{s.name}</span>
                    <div className="load-track"><div className="load-fill" style={{ width: `${(st.hours / maxH) * 100}%` }} /></div>
                    <span className="load-meta font-mono">{st.hours}h · {st.nights}N · {wkend}{t('gen.wk')}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Editor manuale di una cella */}
      {editing && data && (() => {
        const s = data.schedule[editing.id];
        const idx = editing.idx;
        const code = s.days[idx];
        const flr = s.floors?.[idx] || '';
        const dnum = idx + 1;
        const working = state.shifts[code]?.working;
        const subs = working ? freeColleagues(editing.id, idx, flr || firstFloorFor(editing.id)) : [];
        const transfer = (toId) => {
          snap();
          setData((prev) => {
            const from = prev.schedule[editing.id];
            const c = from.days[idx];
            const fl = from.floors?.[idx] || firstFloorFor(editing.id);
            const to = prev.schedule[toId];
            const fromDays = from.days.slice(); fromDays[idx] = 'R';
            const fromFloors = (from.floors ? from.floors.slice() : new Array(fromDays.length).fill('')); fromFloors[idx] = '';
            const toDays = to.days.slice(); toDays[idx] = c;
            const toFloors = (to.floors ? to.floors.slice() : new Array(toDays.length).fill('')); toFloors[idx] = state.shifts[c]?.working ? fl : '';
            return { ...prev, schedule: { ...prev.schedule, [editing.id]: { ...from, days: fromDays, floors: fromFloors }, [toId]: { ...to, days: toDays, floors: toFloors } } };
          });
          setEditing(null);
        };
        return (
          <div className="editor-overlay" onClick={() => setEditing(null)}>
            <div className="editor-card" onClick={(e) => e.stopPropagation()}>
              <div className="editor-head">
                <span><b>{s.name}</b> <span style={{ color: 'var(--text-mut)' }}>({s.role})</span> · {dnum} {weekdays[weekdayOf(data.year, data.month, dnum)]}</span>
                <button className="btn btn-sm" onClick={() => setEditing(null)}>✕</button>
              </div>
              <div className="editor-label">{t('gen.editShift')}</div>
              <div className="editor-shifts">
                {Object.keys(state.shifts).map((c) => (
                  <button key={c} className={`editor-shift cell cell-${c} ${c === code ? 'sel' : ''}`}
                    onClick={() => setCell(editing.id, idx, c)}>{c}</button>
                ))}
              </div>
              {multiFloor && working && (
                <>
                  <div className="editor-label">{t('gen.editFloor')}</div>
                  <div className="editor-shifts">
                    {(state.floors ?? []).map((f) => (
                      <button key={f.id} className={`editor-floor ${f.id === flr ? 'sel' : ''}`}
                        onClick={() => setCellFloor(editing.id, idx, f.id)}>{f.name}</button>
                    ))}
                  </div>
                </>
              )}
              {subs.length > 0 && (
                <>
                  <div className="editor-label">{t('gen.editCover')}</div>
                  <div className="editor-shifts">
                    {subs.slice(0, 10).map((c) => (
                      <button key={c.id} className="editor-floor" onClick={() => transfer(c.id)}>{c.name}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showWall && data && (
        <Wallboard data={data} shifts={state.shifts} floors={state.floors}
          months={months} weekdays={weekdays} onClose={() => setShowWall(false)} />
      )}
      {qr && <QrModal text={qr.text} title={qr.title} onClose={() => setQr(null)} />}
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
