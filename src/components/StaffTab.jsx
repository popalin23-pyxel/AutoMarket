import React, { useState } from 'react';
import { addStaff, removeStaff } from '../lib/store.js';

export default function StaffTab({ state, setState }) {
  const roleKeys = Object.keys(state.roles);
  const [name, setName] = useState('');
  const [role, setRole] = useState(roleKeys[0] ?? '');

  const add = () => {
    const n = name.trim();
    if (!n || !role) return;
    setState((s) => addStaff(s, n, role));
    setName('');
  };

  const del = (id) => setState((s) => removeStaff(s, id));

  return (
    <div className="panel">
      <h2 className="panel-title">Personale</h2>
      <p className="panel-desc">Aggiungi il personale e assegna un ruolo. Il ruolo determina quali turni possono essere assegnati.</p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">Nome</label>
          <input
            type="text" value={name} placeholder="Es. Maria Rossi"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <div className="field">
          <label className="field-label">Ruolo</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roleKeys.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={add}>Aggiungi</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th style={{ width: 60 }}>ID</th><th>Nome</th><th>Ruolo</th><th style={{ width: 90 }}></th></tr>
          </thead>
          <tbody>
            {state.staff.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>Nessun membro del personale. Aggiungine uno sopra.</td></tr>
            ) : state.staff.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.id}</td>
                <td>{s.name}</td>
                <td><span className="badge badge-role">{s.role}</span></td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => del(s.id)}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
