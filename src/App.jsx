import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './lib/store.js';
import { getCloudConfig, isCloudConfigured, pullState } from './lib/cloud.js';
import StaffTab from './components/StaffTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import RulesTab from './components/RulesTab.jsx';
import UnavailabilityTab from './components/UnavailabilityTab.jsx';
import GenerateTab from './components/GenerateTab.jsx';
import DataTab from './components/DataTab.jsx';

const TABS = [
  { id: 'staff',    label: 'Personale' },
  { id: 'shifts',   label: 'Turni' },
  { id: 'rules',    label: 'Regole' },
  { id: 'unav',     label: 'Indisponibilità' },
  { id: 'generate', label: 'Genera & Export' },
  { id: 'data',     label: 'Dati' },
];

export default function App() {
  const [state, setState] = useState(loadState);
  const [active, setActive] = useState('staff');

  // salva su localStorage a ogni modifica
  useEffect(() => { saveState(state); }, [state]);

  // caricamento automatico dal cloud all'avvio (se configurato e attivato)
  useEffect(() => {
    const cfg = getCloudConfig();
    if (cfg.autoLoad && isCloudConfigured(cfg)) {
      pullState(cfg)
        .then((r) => { if (r?.state) setState(r.state); })
        .catch(() => { /* offline o non configurato: resta il dato locale */ });
    }
  }, []); // solo al mount

  const badge = {
    staff: state.staff.length || null,
    unav: state.unavailability.length || null,
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">ify</span></span>
          <span className="brand-ver">v3.3 web</span>
        </div>
        <span className="brand-sub">Generatore automatico di turni per il personale</span>
      </header>

      <div className="app-body">
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${active === t.id ? 'active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
              {badge[t.id] != null && <span className="tab-badge">{badge[t.id]}</span>}
            </button>
          ))}
        </nav>

        {active === 'staff'    && <StaffTab state={state} setState={setState} />}
        {active === 'shifts'   && <ShiftsTab state={state} setState={setState} />}
        {active === 'rules'    && <RulesTab state={state} setState={setState} />}
        {active === 'unav'     && <UnavailabilityTab state={state} setState={setState} />}
        {active === 'generate' && <GenerateTab state={state} setState={setState} />}
        {active === 'data'     && <DataTab state={state} setState={setState} />}
      </div>

      <footer className="app-footer">
        Turnify Web — i dati sono salvati solo in questo browser. Nessun server.
      </footer>
    </div>
  );
}
