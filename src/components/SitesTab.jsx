import React, { useState } from 'react';
import { addSite, updateSite, removeSite } from '../lib/store.js';
import { SITE_COLORS } from '../lib/defaults.js';
import NumberInput from './NumberInput.jsx';

export default function SitesTab({ state, setState }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [color, setColor] = useState(SITE_COLORS[state.sites.length % SITE_COLORS.length]);

  const add = () => {
    const n = name.trim();
    if (!n || !rate) return;
    setState((s) => addSite(s, n, rate, { color }));
    setName(''); setRate(''); setColor(SITE_COLORS[(state.sites.length + 1) % SITE_COLORS.length]);
  };

  const patch = (id, p) => setState((s) => updateSite(s, id, p));

  const del = (site) => {
    const nShifts = state.shifts.filter((sh) => sh.siteId === site.id).length;
    const msg = nShifts > 0
      ? `"${site.name}" ha ${nShifts} turni registrati. Eliminandola, quei turni resteranno nel calendario ma senza sede (0€ nel calcolo). Continuare?`
      : `Eliminare "${site.name}"?`;
    if (!confirm(msg)) return;
    setState((s) => removeSite(s, site.id));
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Sedi di lavoro</h2>
      <p className="panel-desc">
        Aggiungi ogni posto dove lavori con la sua paga oraria. La rivalsa lasciala vuota per usare
        quella di default (impostazioni); impostala solo se questa sede fa eccezione.
      </p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">Nome</label>
          <input type="text" value={name} placeholder="Es. CDS"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label className="field-label">Paga oraria (€)</label>
          <NumberInput value={rate} onChange={setRate} min={0} max={999} allowEmpty style={{ minWidth: 0 }} />
        </div>
        <div className="field">
          <label className="field-label">Colore</label>
          <div className="site-picker">
            {SITE_COLORS.map((c) => (
              <button key={c} type="button" className={`site-pick-btn ${color === c ? 'sel' : ''}`}
                style={{ padding: 6 }} onClick={() => setColor(c)}>
                <span className="site-dot" style={{ background: c }} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={add}>Aggiungi</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th><th>Nome</th><th style={{ width: 110 }}>€ / ora</th>
              <th style={{ width: 130 }}>Rivalsa %</th><th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {state.sites.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>Nessuna sede. Aggiungine una sopra.</td></tr>
            ) : state.sites.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="site-picker">
                    {SITE_COLORS.map((c) => (
                      <button key={c} type="button" className={`site-pick-btn ${s.color === c ? 'sel' : ''}`}
                        style={{ padding: 4 }} onClick={() => patch(s.id, { color: c })}>
                        <span className="site-dot" style={{ background: c }} />
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <input type="text" value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })}
                    style={{ minWidth: 100, width: '100%' }} />
                </td>
                <td>
                  <NumberInput value={s.rate} onChange={(v) => patch(s.id, { rate: v })}
                    min={0} max={999} style={{ minWidth: 0, width: 80 }} />
                </td>
                <td>
                  <NumberInput value={s.rivalsaPercent} onChange={(v) => patch(s.id, { rivalsaPercent: v })}
                    min={0} max={100} allowEmpty style={{ minWidth: 0, width: 70 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-mut)', marginLeft: 4 }}>
                    {s.rivalsaPercent == null ? '(default)' : ''}
                  </span>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => del(s)}>Elimina</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
