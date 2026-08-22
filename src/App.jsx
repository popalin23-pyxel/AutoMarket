import React, { useState, useEffect } from 'react';
import { loadState, saveState, setLang } from './lib/store.js';
import { getCloudConfig, isCloudConfigured, pullState } from './lib/cloud.js';
import { I18nProvider, useT } from './lib/i18n.js';
import StaffTab from './components/StaffTab.jsx';
import ShiftsTab from './components/ShiftsTab.jsx';
import RulesTab from './components/RulesTab.jsx';
import UnavailabilityTab from './components/UnavailabilityTab.jsx';
import GenerateTab from './components/GenerateTab.jsx';
import DataTab from './components/DataTab.jsx';

const TAB_IDS = ['staff', 'shifts', 'rules', 'unav', 'generate', 'data'];

function Shell({ state, setState }) {
  const t = useT();
  const [active, setActive] = useState('staff');

  const badge = {
    staff: state.staff.length || null,
    unav: state.unavailability.length || null,
  };

  const TABS = TAB_IDS.map((id) => ({ id, label: t(`tab.${id}`) }));

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Turn<span className="accent">ify</span></span>
          <span className="brand-ver">v3.3 web</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="brand-sub">{t('app.subtitle')}</span>
          <div className="lang-switch">
            <button className={state.lang !== 'en' ? 'active' : ''} onClick={() => setState((s) => setLang(s, 'it'))}>IT</button>
            <button className={state.lang === 'en' ? 'active' : ''} onClick={() => setState((s) => setLang(s, 'en'))}>EN</button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav className="tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`tab ${active === tab.id ? 'active' : ''}`} onClick={() => setActive(tab.id)}>
              {tab.label}
              {badge[tab.id] != null && <span className="tab-badge">{badge[tab.id]}</span>}
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

      <footer className="app-footer">{t('app.footer')}</footer>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);

  useEffect(() => { saveState(state); }, [state]);

  // caricamento automatico dal cloud all'avvio (se configurato e attivato)
  useEffect(() => {
    const cfg = getCloudConfig();
    if (cfg.autoLoad && isCloudConfigured(cfg)) {
      pullState(cfg)
        .then((r) => { if (r?.state) setState(r.state); })
        .catch(() => { /* offline o non configurato: resta il dato locale */ });
    }
  }, []);

  return (
    <I18nProvider lang={state.lang}>
      <Shell state={state} setState={setState} />
    </I18nProvider>
  );
}
