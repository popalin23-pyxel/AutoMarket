import React, { useState } from 'react';
import { addStaff, removeStaff, updateStaff } from '../lib/store.js';
import { useT } from '../lib/i18n.js';

export default function StaffTab({ state, setState }) {
  const t = useT();
  const roleKeys = Object.keys(state.roles);
  const floors = state.floors ?? [];
  const [name, setName] = useState('');
  const [role, setRole] = useState(roleKeys[0] ?? '');
  const [hours, setHours] = useState('');
  const [pref, setPref] = useState('');
  const [start, setStart] = useState('');
  const [floorSel, setFloorSel] = useState([]); // [] = tutti
  const seqFor = (r) => (state.rules.sequences?.[r] ?? state.roles[r] ?? []);

  const PREF = [
    { v: '', l: t('staff.pref.none') },
    { v: 'M', l: t('staff.pref.M') },
    { v: 'P', l: t('staff.pref.P') },
    { v: 'N', l: t('staff.pref.N') },
  ];

  const add = () => {
    const n = name.trim();
    if (!n || !role) return;
    setState((s) => addStaff(s, n, role, { contractHours: hours, preferredShift: pref, floors: floorSel, startShift: start }));
    setName(''); setHours(''); setPref(''); setStart(''); setFloorSel([]);
  };

  const del = (id) => setState((s) => removeStaff(s, id));
  const patch = (id, p) => setState((s) => updateStaff(s, id, p));

  const toggleAddFloor = (fid) =>
    setFloorSel((cur) => (cur.includes(fid) ? cur.filter((x) => x !== fid) : [...cur, fid]));

  const toggleStaffFloor = (s, fid) => {
    const cur = Array.isArray(s.floors) ? s.floors : [];
    const next = cur.includes(fid) ? cur.filter((x) => x !== fid) : [...cur, fid];
    patch(s.id, { floors: next });
  };

  const FloorPicker = ({ selected, onToggle }) => (
    <div className="floor-picker">
      {floors.map((f) => (
        <label key={f.id}>
          <input type="checkbox" checked={selected.includes(f.id)} onChange={() => onToggle(f.id)} />
          {f.name}
        </label>
      ))}
      {selected.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-mut)' }}>{t('staff.floorsAll')}</span>}
    </div>
  );

  return (
    <div className="panel">
      <h2 className="panel-title">{t('tab.staff')}</h2>
      <p className="panel-desc">{t('staff.desc')}</p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">{t('c.name')}</label>
          <input type="text" value={name} placeholder={t('staff.namePh')}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div className="field">
          <label className="field-label">{t('c.role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleKeys.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
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
        <div className="field">
          <label className="field-label">{t('staff.startShift')}</label>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="">{t('staff.auto')}</option>
            {seqFor(role).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={add}>{t('c.add')}</button>
      </div>

      {floors.length > 0 && (
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="field-label">{t('staff.floors')}</label>
          <FloorPicker selected={floorSel} onToggle={toggleAddFloor} />
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>ID</th><th>{t('c.name')}</th><th>{t('c.role')}</th>
              <th style={{ width: 100 }}>{t('staff.hoursMonth')}</th><th style={{ width: 130 }}>{t('staff.preferredShort')}</th>
              <th style={{ width: 100 }}>{t('staff.startShift')}</th>
              {floors.length > 0 && <th style={{ minWidth: 150 }}>{t('staff.floors')}</th>}
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {state.staff.length === 0 ? (
              <tr className="empty-row"><td colSpan={floors.length > 0 ? 8 : 7}>{t('staff.empty')}</td></tr>
            ) : state.staff.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.id}</td>
                <td>{s.name}</td>
                <td><span className="badge badge-role">{s.role}</span></td>
                <td>
                  <input type="number" min={0} max={400} value={s.contractHours || 0}
                    onChange={(e) => patch(s.id, { contractHours: Number(e.target.value) })}
                    style={{ minWidth: 0, width: 70 }} />
                </td>
                <td>
                  <select value={s.preferredShift || ''} onChange={(e) => patch(s.id, { preferredShift: e.target.value })}>
                    {PREF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </td>
                <td>
                  <select value={s.startShift || ''} onChange={(e) => patch(s.id, { startShift: e.target.value })}>
                    <option value="">{t('staff.auto')}</option>
                    {seqFor(s.role).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                {floors.length > 0 && (
                  <td><FloorPicker selected={Array.isArray(s.floors) ? s.floors : []} onToggle={(fid) => toggleStaffFloor(s, fid)} /></td>
                )}
                <td><button className="btn btn-sm btn-danger" onClick={() => del(s.id)}>{t('c.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
