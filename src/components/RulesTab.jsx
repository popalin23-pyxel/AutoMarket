import React, { useState } from 'react';

export default function RulesTab({ state, setState }) {
  const setRule = (key, value) =>
    setState((s) => ({ ...s, rules: { ...s.rules, [key]: value } }));

  const [newRole, setNewRole] = useState('');
  const shiftCodes = Object.keys(state.shifts);
  const workingCodes = shiftCodes.filter((c) => state.shifts[c]?.working);

  const setCoverage = (code, kind, value) =>
    setState((s) => ({
      ...s,
      rules: {
        ...s.rules,
        coverage: {
          ...s.rules.coverage,
          [code]: { ...(s.rules.coverage?.[code] ?? { weekday: 0, weekend: 0 }), [kind]: Math.max(0, value) },
        },
      },
    }));

  const toggleRoleShift = (role, code) => {
    setState((s) => {
      const current = s.roles[role] ?? [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      return { ...s, roles: { ...s.roles, [role]: next } };
    });
  };

  const addRole = () => {
    const r = newRole.trim();
    if (!r || state.roles[r]) return;
    setState((s) => ({ ...s, roles: { ...s.roles, [r]: [] } }));
    setNewRole('');
  };

  const delRole = (role) => {
    setState((s) => {
      const roles = { ...s.roles };
      delete roles[role];
      return { ...s, roles };
    });
  };

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Regole di generazione</h2>
        <p className="panel-desc">Questi vincoli vengono applicati durante la generazione automatica del planning.</p>

        <div className="form-row">
          <div className="field">
            <label className="field-label">Max notti / mese</label>
            <input type="number" min={0} max={31} value={state.rules.max_nights}
              onChange={(e) => setRule('max_nights', Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="field-label">Max giorni consecutivi</label>
            <input type="number" min={0} max={31} value={state.rules.max_work_streak}
              onChange={(e) => setRule('max_work_streak', Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="field-label">Alterna Mattina / Pomeriggio</label>
            <div className="inline-check" style={{ height: 38 }}>
              <input type="checkbox" checked={state.rules.prefer_alt_mp}
                onChange={(e) => setRule('prefer_alt_mp', e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {state.rules.prefer_alt_mp ? 'Attiva' : 'Disattiva'}
              </span>
            </div>
          </div>
        </div>
        <div className="hint hint-info">
          Le modifiche sono salvate automaticamente e usate al prossimo "Genera turni".
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Copertura richiesta</h2>
        <p className="panel-desc">
          Quante persone servono per ogni turno, distinguendo giorni feriali da weekend/festivi.
          La generazione prova a coprire questi numeri e segnala i giorni scoperti.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Turno</th>
                <th style={{ textAlign: 'center' }}>Feriale</th>
                <th style={{ textAlign: 'center' }}>Weekend / Festivi</th>
              </tr>
            </thead>
            <tbody>
              {workingCodes.map((c) => {
                const cov = state.rules.coverage?.[c] ?? { weekday: 0, weekend: 0 };
                return (
                  <tr key={c}>
                    <td>
                      <span className={`cell cell-${c}`}>{c}</span>{' '}
                      {state.shifts[c]?.description}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" min={0} max={99} value={cov.weekday ?? 0}
                        onChange={(e) => setCoverage(c, 'weekday', Number(e.target.value))}
                        style={{ minWidth: 0, width: 70 }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" min={0} max={99} value={cov.weekend ?? 0}
                        onChange={(e) => setCoverage(c, 'weekend', Number(e.target.value))}
                        style={{ minWidth: 0, width: 70 }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Ruoli e turni ammessi</h2>
        <p className="panel-desc">Spunta i turni che ogni ruolo può ricevere. Un ruolo senza turni diurni lavorativi verrà messo a riposo.</p>

        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Nuovo ruolo</label>
            <input type="text" value={newRole} placeholder="Es. Caposala"
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRole()} />
          </div>
          <button className="btn btn-primary" onClick={addRole}>Aggiungi ruolo</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ruolo</th>
                {shiftCodes.map((c) => <th key={c} style={{ textAlign: 'center' }}>{c}</th>)}
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.roles).map(([role, codes]) => (
                <tr key={role}>
                  <td><span className="badge badge-role">{role}</span></td>
                  {shiftCodes.map((c) => (
                    <td key={c} style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={codes.includes(c)}
                        onChange={() => toggleRoleShift(role, c)} />
                    </td>
                  ))}
                  <td><button className="btn btn-sm btn-danger" onClick={() => delRole(role)}>Elimina</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
