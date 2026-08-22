import React, { useState } from 'react';
import { addStaff, removeStaff, updateStaff } from '../lib/store.js';
import { useT } from '../lib/i18n.js';

export default function StaffTab({ state, setState }) {
  const t = useT();
  const roleKeys = Object.keys(state.roles);
  const [name, setName] = useState('');
  const [role, setRole] = useState(roleKeys[0] ?? '');
  const [hours, setHours] = useState('');
  const [pref, setPref] = useState('');

  const PREF = [
    { v: '', l: t('staff.pref.none') },
    { v: 'M', l: t('staff.pref.M') },
    { v: 'P', l: t('staff.pref.P') },
    { v: 'N', l: t('staff.pref.N') },
  ];

  const add = () => {
    const n = name.trim();
    if (!n || !role) return;
    setState((s) => addStaff(s, n, role, { contractHours: hours, preferredShift: pref }));
    setName(''); setHours(''); setPref('');
  };

  const del = (id) => setState((s) => removeStaff(s, id));
  const patch = (id, p) => setState((s) => updateStaff(s, id, p));

  return (
    <div className="panel">
      <h2 className="panel-title">{t('tab.staff')}</h2>
      <p className="panel-desc">{t('staff.desc')}</p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">{t('c.name')}</label>
          <input type="text" value={name} placeholder={t('staff.namePh')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div className="field">
          <label className="field-label">{t('c.role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleKeys.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label className="field-label">{t('staff.hoursMonth')}</label>
          <input type="number" min={0} max={400} value={hours} placeholder={t('staff.hoursPh')}
            onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('staff.preferred')}</label>
          <select value={pref} onChange={(e) => setPref(e.target.value)}>
            {PREF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={add}>{t('c.add')}</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>ID</th><th>{t('c.name')}</th><th>{t('c.role')}</th>
              <th style={{ width: 110 }}>{t('staff.hoursMonth')}</th><th style={{ width: 140 }}>{t('staff.preferredShort')}</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {state.staff.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>{t('staff.empty')}</td></tr>
            ) : state.staff.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.id}</td>
                <td>{s.name}</td>
                <td><span className="badge badge-role">{s.role}</span></td>
                <td>
                  <input type="number" min={0} max={400} value={s.contractHours || 0}
                    onChange={(e) => patch(s.id, { contractHours: Number(e.target.value) })}
                    style={{ minWidth: 0, width: 80 }} />
                </td>
                <td>
                  <select value={s.preferredShift || ''} onChange={(e) => patch(s.id, { preferredShift: e.target.value })}>
                    {PREF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => del(s.id)}>{t('c.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
