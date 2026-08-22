import React, { useState } from 'react';
import { useT } from '../lib/i18n.js';
import { addFloor, renameFloor, removeFloor, setCoverage, setCoverageHours, setSequence } from '../lib/store.js';
import NumberInput from './NumberInput.jsx';

export default function RulesTab({ state, setState }) {
  const t = useT();
  const setRule = (key, value) => setState((s) => ({ ...s, rules: { ...s.rules, [key]: value } }));

  const [newRole, setNewRole] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [seqText, setSeqText] = useState({}); // testo grezzo digitato per ruolo
  const shiftCodes = Object.keys(state.shifts);
  const workingCodes = shiftCodes.filter((c) => state.shifts[c]?.working);
  const roleKeys = Object.keys(state.roles);
  const floors = state.floors ?? [];

  const covVal = (fid, role, code, kind) =>
    state.rules.coverage?.[fid]?.[role]?.[code]?.[kind] ?? 0;
  const hoursVal = (fid, role, kind) =>
    state.rules.coverageHours?.[fid]?.[role]?.[kind] ?? 0;
  const seqStr = (role) => (state.rules.sequences?.[role] ?? []).join(' ');
  // valore mostrato: il testo grezzo se lo stai digitando, altrimenti dallo stato
  const seqValue = (role) => (seqText[role] !== undefined ? seqText[role] : seqStr(role));
  const setSeq = (role, str) => {
    setSeqText((m) => ({ ...m, [role]: str })); // preserva spazi mentre digiti
    setState((s) => setSequence(s, role, str.split(/[\s,]+/).filter(Boolean)));
  };

  const toggleRoleShift = (role, code) => {
    setState((s) => {
      const current = s.roles[role] ?? [];
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      return { ...s, roles: { ...s.roles, [role]: next } };
    });
  };

  const addRole = () => {
    const r = newRole.trim();
    if (!r || state.roles[r]) return;
    setState((s) => ({ ...s, roles: { ...s.roles, [r]: [] } }));
    setNewRole('');
  };
  const delRole = (role) => setState((s) => {
    const roles = { ...s.roles }; delete roles[role];
    return { ...s, roles };
  });

  const doAddFloor = () => { if (newFloor.trim()) { setState((s) => addFloor(s, newFloor)); setNewFloor(''); } };

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">{t('rules.title')}</h2>
        <p className="panel-desc">{t('rules.desc')}</p>
        <div className="form-row">
          <div className="field">
            <label className="field-label">{t('rules.maxNights')}</label>
            <NumberInput min={0} max={31} value={state.rules.max_nights}
              onChange={(v) => setRule('max_nights', v)} />
          </div>
          <div className="field">
            <label className="field-label">{t('rules.maxStreak')}</label>
            <NumberInput min={0} max={31} value={state.rules.max_work_streak}
              onChange={(v) => setRule('max_work_streak', v)} />
          </div>
          <div className="field">
            <label className="field-label">{t('rules.maxWeekly')}</label>
            <NumberInput min={0} max={200} value={state.rules.max_weekly_hours ?? 48}
              onChange={(v) => setRule('max_weekly_hours', v)} />
          </div>
        </div>
        <div className="hint hint-info">{t('rules.autosave')}</div>
      </div>

      {/* Piani / reparti */}
      <div className="panel">
        <h2 className="panel-title">{t('rules.floors')}</h2>
        <p className="panel-desc">{t('rules.floorsDesc')}</p>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">{t('rules.floor')}</label>
            <input type="text" value={newFloor} placeholder={t('rules.newFloorPh')}
              onChange={(e) => setNewFloor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doAddFloor()} />
          </div>
          <button className="btn btn-primary" onClick={doAddFloor}>{t('rules.addFloor')}</button>
        </div>
        <div className="floor-chips">
          {floors.map((f) => (
            <div key={f.id} className="floor-chip">
              <input value={f.name} onChange={(e) => setState((s) => renameFloor(s, f.id, e.target.value))} />
              <button className="btn btn-sm btn-danger" onClick={() => setState((s) => removeFloor(s, f.id))}
                disabled={floors.length <= 1}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Copertura per piano → ruolo → turno */}
      <div className="panel">
        <h2 className="panel-title">{t('rules.coverage')}</h2>
        <p className="panel-desc">{t('rules.coverageDesc')}</p>

        {floors.map((f) => (
          <div key={f.id} style={{ marginBottom: 22 }}>
            <div className="cov-floor-title">{f.name}</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('c.role')}</th>
                    {workingCodes.map((c) => (
                      <th key={c} colSpan={2} style={{ textAlign: 'center' }}>
                        <span className={`cell cell-${c}`}>{c}</span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th></th>
                    {workingCodes.map((c) => (
                      <React.Fragment key={c}>
                        <th style={{ textAlign: 'center', fontSize: 9 }}>{t('rules.weekdayShort')}</th>
                        <th style={{ textAlign: 'center', fontSize: 9 }}>{t('rules.weekendShort')}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleKeys.map((role) => (
                    <tr key={role}>
                      <td><span className="badge badge-role">{role}</span></td>
                      {workingCodes.map((c) => {
                        const allowed = (state.roles[role] ?? []).includes(c);
                        return (
                          <React.Fragment key={c}>
                            {['weekday', 'weekend'].map((kind) => (
                              <td key={kind} style={{ textAlign: 'center', padding: 4 }}>
                                <NumberInput min={0} max={99} disabled={!allowed}
                                  value={covVal(f.id, role, c, kind)}
                                  onChange={(v) => setState((s) => setCoverage(s, f.id, role, c, kind, v))}
                                  style={{ minWidth: 0, width: 46, opacity: allowed ? 1 : 0.35 }} />
                              </td>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Copertura in ore per ruolo */}
      <div className="panel">
        <h2 className="panel-title">{t('rules.coverageHours')}</h2>
        <p className="panel-desc">{t('rules.coverageHoursDesc')}</p>
        {floors.map((f) => (
          <div key={f.id} style={{ marginBottom: 18 }}>
            <div className="cov-floor-title">{f.name}</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('c.role')}</th>
                    <th style={{ textAlign: 'center' }}>{t('rules.hWeekday')}</th>
                    <th style={{ textAlign: 'center' }}>{t('rules.hWeekend')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roleKeys.map((role) => (
                    <tr key={role}>
                      <td><span className="badge badge-role">{role}</span></td>
                      {['weekday', 'weekend'].map((kind) => (
                        <td key={kind} style={{ textAlign: 'center' }}>
                          <NumberInput min={0} max={999} value={hoursVal(f.id, role, kind)}
                            onChange={(v) => setState((s) => setCoverageHours(s, f.id, role, kind, v))}
                            style={{ minWidth: 0, width: 70 }} /> h
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Sequenze turni per ruolo */}
      <div className="panel">
        <h2 className="panel-title">{t('rules.sequences')}</h2>
        <p className="panel-desc">{t('rules.sequencesDesc')}</p>
        {roleKeys.map((role) => (
          <div className="form-row" key={role} style={{ alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-role" style={{ minWidth: 90 }}>{role}</span>
            <input type="text" value={seqValue(role)} placeholder="P M N S R"
              onChange={(e) => setSeq(role, e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          </div>
        ))}
      </div>

      {/* Ruoli e turni ammessi */}
      <div className="panel">
        <h2 className="panel-title">{t('rules.rolesTitle')}</h2>
        <p className="panel-desc">{t('rules.rolesDesc')}</p>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">{t('rules.newRole')}</label>
            <input type="text" value={newRole} placeholder={t('rules.newRolePh')}
              onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRole()} />
          </div>
          <button className="btn btn-primary" onClick={addRole}>{t('rules.addRole')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('c.role')}</th>
                {shiftCodes.map((c) => <th key={c} style={{ textAlign: 'center' }}>{c}</th>)}
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {roleKeys.map((role) => (
                <tr key={role}>
                  <td><span className="badge badge-role">{role}</span></td>
                  {shiftCodes.map((c) => (
                    <td key={c} style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={(state.roles[role] ?? []).includes(c)} onChange={() => toggleRoleShift(role, c)} />
                    </td>
                  ))}
                  <td><button className="btn btn-sm btn-danger" onClick={() => delRole(role)}>{t('c.delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
