import React, { useMemo } from 'react';
import { computeMonthSummary, todayISO } from '../lib/calc.js';
import { updateSettings } from '../lib/store.js';
import GoalTimeCalculator from './GoalTimeCalculator.jsx';
import NumberInput from './NumberInput.jsx';

// Pannelli delle pagine "Sedi e paghe" e "Obiettivo" (in Altro).
const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Anteprima minima del mese per sede, sotto l'elenco sedi: il confronto completo è in Soldi → Grafici.
export function SitesMonthPreview({ state, onNavigate }) {
  const today = todayISO();
  const sum = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, Number(today.slice(0, 4)), Number(today.slice(5, 7))),
    [state.shifts, state.sites, state.settings, today],
  );
  const rows = sum.perSite.filter((p) => p.siteId != null && p.total > 0);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((p) => p.total));
  return (
    <div className="panel">
      <h2 className="panel-title">Questo mese per sede</h2>
      <p className="panel-desc">Fatturato del mese (compensi + rivalsa), sede per sede.</p>
      <div className="site-bars">
        {rows.map((p) => (
          <div key={p.siteId} className="site-bar-row">
            <span className="site-bar-name">{p.name}</span>
            <span className="site-bar-track">
              <span className="site-bar-fill" style={{ width: `${Math.max(4, (p.total / max) * 100)}%`, background: p.color }} />
            </span>
            <span className="site-bar-val mono">€{fmt(p.total)}</span>
          </div>
        ))}
      </div>
      <button className="link-btn" onClick={() => onNavigate('soldi', 'grafici/compare')}>Vedi il confronto completo nei grafici →</button>
    </div>
  );
}

export function GoalPanel({ state, setState }) {
  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Obiettivo mensile</h2>
        <p className="panel-desc">
          Quanto vuoi guadagnare (netto) ogni mese. Lo vedi come barra di avanzamento in Oggi e in Soldi. Lascia 0 per nasconderlo.
        </p>
        <div className="field">
          <label className="field-label">Obiettivo netto (€)</label>
          <NumberInput value={state.settings.monthlyGoal}
            onChange={(v) => setState((s) => updateSettings(s, { monthlyGoal: v === '' || v == null ? 0 : v }))}
            min={0} max={99999} allowEmpty />
        </div>
      </div>
      <GoalTimeCalculator state={state} />
    </>
  );
}
