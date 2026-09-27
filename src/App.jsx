import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './lib/store.js';
import ShiftsTab from './components/ShiftsTab.jsx';
import SitesTab from './components/SitesTab.jsx';
import SummaryTab from './components/SummaryTab.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const TABS = [
  { id: 'shifts',   label: 'Turni' },
  { id: 'summary',  label: 'Riepilogo' },
  { id: 'sites',    label: 'Sedi' },
  { id: 'history',  label: 'Storico' },
  { id: 'settings', label: 'Impostazioni' },
];

const now = new Date();

export default function App() {
  const [state, setState] = useState(loadState);
  const [active, setActive] = useState('shifts');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => { saveState(state); }, [state]);

  const goToMonth = (y, m) => { setYear(y); setMonth(m); setActive('shifts'); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">io</span></span>
        </div>
        <span className="brand-sub">Turni e compensi — Partita IVA</span>
      </header>

      <div className="app-body">
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        {active === 'shifts' && (
          <ShiftsTab state={state} setState={setState} year={year} month={month} setYear={setYear} setMonth={setMonth} />
        )}
        {active === 'summary' && (
          <SummaryTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />
        )}
        {active === 'sites' && <SitesTab state={state} setState={setState} />}
        {active === 'history' && <HistoryTab state={state} onOpenMonth={goToMonth} />}
        {active === 'settings' && <SettingsTab state={state} setState={setState} />}
      </div>

      <footer className="app-footer">
        Turnio — i dati sono salvati solo in questo dispositivo. Nessun server.
      </footer>
    </div>
  );
}
