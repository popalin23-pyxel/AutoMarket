import React, { useState } from 'react';
import { addUnav, removeUnav } from '../lib/store.js';
import { UNAV_KINDS } from '../lib/defaults.js';
import { useT } from '../lib/i18n.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UnavailabilityTab({ state, setState }) {
  const t = useT();
  const [staffId, setStaffId] = useState(state.staff[0]?.id ?? '');
  const [day, setDay] = useState(todayISO());
  const [kind, setKind] = useState(UNAV_KINDS[0]);

  const kindLabel = (k) => t(`unav.${k}`);
  const staffName = (id) => state.staff.find((s) => s.id === id)?.name ?? `#${id}`;

  const add = () => {
    if (!staffId || !day) return;
    setState((s) => addUnav(s, Number(staffId), day, kind));
  };
  const del = (id) => setState((s) => removeUnav(s, id));

  const sorted = [...state.unavailability].sort((a, b) => a.day.localeCompare(b.day));

  return (
    <div className="panel">
      <h2 className="panel-title">{t('tab.unav')}</h2>
      <p className="panel-desc">{t('unav.desc')}</p>

      {state.staff.length === 0 ? (
        <div className="hint hint-warn">{t('unav.needStaff')}</div>
      ) : (
        <div className="form-row">
          <div className="field" style={{ flex: 2 }}>
            <label className="field-label">{t('c.person')}</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {state.staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t('c.day')}</label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('c.type')}</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {UNAV_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={add}>{t('c.add')}</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th style={{ width: 60 }}>ID</th><th>{t('c.person')}</th><th>{t('c.day')}</th><th>{t('c.type')}</th><th style={{ width: 90 }}></th></tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>{t('unav.empty')}</td></tr>
            ) : sorted.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.id}</td>
                <td>{staffName(u.staffId)}</td>
                <td className="mono">{u.day}</td>
                <td><span className="badge badge-kind">{kindLabel(u.kind)}</span></td>
                <td><button className="btn btn-sm btn-danger" onClick={() => del(u.id)}>{t('c.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
