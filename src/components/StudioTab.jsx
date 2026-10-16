import React, { useMemo, useState } from 'react';
import { computeMonthSummary, todayISO } from '../lib/calc.js';
import { updateSettings } from '../lib/store.js';
import AnagraficaTab from './AnagraficaTab.jsx';
import SitesTab from './SitesTab.jsx';
import FiscalSettingsTab from './FiscalSettingsTab.jsx';
import GoalTimeCalculator from './GoalTimeCalculator.jsx';
import NumberInput from './NumberInput.jsx';

const SUB_TABS = [
  { id: 'anagrafica', label: 'Anagrafica' },
  { id: 'sites', label: 'Sedi' },
  { id: 'fiscal', label: 'Fiscali' },
  { id: 'goal', label: 'Obiettivo' },
];

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Anteprima minima del mese per sede, sotto l'elenco sedi: il confronto completo è in Analisi.
function SitesMonthPreview({ state, onNavigate }) {
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
      <button className="link-btn" onClick={() => onNavigate('analisi', 'compare')}>Vedi il confronto completo in Analisi →</button>
    </div>
  );
}

function GoalPanel({ state, setState }) {
  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Obiettivo mensile</h2>
        <p className="panel-desc">
          Quanto vuoi guadagnare (netto) ogni mese. Lo vedi come barra di avanzamento nella Home. Lascia 0 per nasconderlo.
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

export default function StudioTab({ state, setState, initialSub = 'anagrafica', onNavigate }) {
  const [sub, setSub] = useState(initialSub);

  return (
    <>
      <div className="tabs">
        {SUB_TABS.map((t) => (
          <button key={t.id} className={`tab ${sub === t.id ? 'active' : ''}`} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'anagrafica' && <AnagraficaTab state={state} setState={setState} />}
      {sub === 'sites' && (
        <>
          <SitesTab state={state} setState={setState} />
          <SitesMonthPreview state={state} onNavigate={onNavigate} />
        </>
      )}
      {sub === 'fiscal' && <FiscalSettingsTab state={state} setState={setState} />}
      {sub === 'goal' && <GoalPanel state={state} setState={setState} />}
    </>
  );
}
