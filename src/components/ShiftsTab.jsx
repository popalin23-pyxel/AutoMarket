import React, { useState } from 'react';
import { useT } from '../lib/i18n.js';

export default function ShiftsTab({ state, setState }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [hours, setHours] = useState(7);
  const [working, setWorking] = useState(true);
  const [isNight, setIsNight] = useState(false);

  const addShift = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setState((s) => ({
      ...s,
      shifts: {
        ...s.shifts,
        [c]: { description: desc.trim(), hours: Number(hours) || 0, working, is_night: isNight },
      },
    }));
    setCode(''); setDesc(''); setHours(7); setWorking(true); setIsNight(false);
  };

  const delShift = (c) => {
    setState((s) => {
      const next = { ...s.shifts };
      delete next[c];
      const roles = Object.fromEntries(
        Object.entries(s.roles).map(([r, codes]) => [r, codes.filter((x) => x !== c)])
      );
      return { ...s, shifts: next, roles };
    });
  };

  return (
    <div className="panel">
      <h2 className="panel-title">{t('tab.shifts')}</h2>
      <p className="panel-desc">{t('shifts.desc')}</p>

      <div className="form-row">
        <div className="field" style={{ maxWidth: 90 }}>
          <label className="field-label">{t('shifts.code')}</label>
          <input type="text" value={code} placeholder={t('shifts.codePh')} maxLength={3}
            onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">{t('shifts.description')}</label>
          <input type="text" value={desc} placeholder={t('shifts.descPh')}
            onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 90 }}>
          <label className="field-label">{t('c.hours')}</label>
          <input type="number" min={0} max={24} value={hours}
            onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('shifts.working')}</label>
          <div className="inline-check" style={{ height: 38 }}>
            <input type="checkbox" checked={working} onChange={(e) => setWorking(e.target.checked)} />
          </div>
        </div>
        <div className="field">
          <label className="field-label">{t('shifts.night')}</label>
          <div className="inline-check" style={{ height: 38 }}>
            <input type="checkbox" checked={isNight} onChange={(e) => setIsNight(e.target.checked)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={addShift}>{t('shifts.addUpdate')}</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>{t('shifts.code')}</th><th>{t('shifts.description')}</th>
              <th style={{ width: 70 }}>{t('c.hours')}</th><th style={{ width: 100 }}>{t('shifts.working')}</th>
              <th style={{ width: 80 }}>{t('shifts.night')}</th><th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(state.shifts).map(([c, m]) => (
              <tr key={c}>
                <td><span className="badge badge-kind mono">{c}</span></td>
                <td>{m.description}</td>
                <td className="mono">{m.hours}</td>
                <td>{m.working ? t('c.yes') : t('c.no')}</td>
                <td>{m.is_night ? t('c.yes') : t('c.no')}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => delShift(c)}>{t('c.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
