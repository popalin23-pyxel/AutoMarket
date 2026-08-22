import React, { useState } from 'react';
import { addStaff, removeStaff, updateStaff } from '../lib/store.js';

const SHIFT_PREF = [
  { v: '', l: '—' },
  { v: 'M', l: 'Mattina' },
  { v: 'P', l: 'Pomeriggio' },
  { v: 'N', l: 'Notte' },
];

export default function StaffTab({ state, setState }) {
  const roleKeys = Object.keys(state.roles);
  const [name, setName] = useState('');
  const [role, setRole] = useState(roleKeys[0] ?? '');
  const [hours, setHours] = useState('');
  const [pref, setPref] = useState('');

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
      <h2 className="panel-title">Personale</h2>
      <p className="panel-desc">
        Aggiungi il personale e assegna un ruolo. Le <b>ore contrattuali</b> (mensili) bilanciano
        il carico tra part-time e full-time; il <b>turno preferito</b> è usato come preferenza quando possibile.
      </p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">Nome</label>
          <input type="text" value={name} placeholder="Es. Maria Rossi"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div className="field">
          <label className="field-label">Ruolo</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleKeys.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label className="field-label">Ore/mese</label>
          <input type="number" min={0} max={400} value={hours} placeholder="0 = auto"
            onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Turno preferito</label>
          <select value={pref} onChange={(e) => setPref(e.target.value)}>
            {SHIFT_PREF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={add}>Aggiungi</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>ID</th><th>Nome</th><th>Ruolo</th>
              <th style={{ width: 110 }}>Ore/mese</th><th style={{ width: 140 }}>Preferito</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {state.staff.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>Nessun membro del personale. Aggiungine uno sopra.</td></tr>
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
                    {SHIFT_PREF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => del(s.id)}>Elimina</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
