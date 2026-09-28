import React, { useState } from 'react';
import SummaryTab from './SummaryTab.jsx';
import SitesTab from './SitesTab.jsx';
import EarningsSimulator from './EarningsSimulator.jsx';
import GoalTimeCalculator from './GoalTimeCalculator.jsx';

const SUB_TABS = [
  { id: 'summary', label: 'Riepilogo' },
  { id: 'sim', label: 'Simulatore' },
  { id: 'goal', label: 'Obiettivo' },
  { id: 'sites', label: 'Sedi' },
];

export default function GuadagniTab({ state, setState, year, month, setYear, setMonth }) {
  const [sub, setSub] = useState('summary');

  return (
    <>
      <div className="tabs">
        {SUB_TABS.map((t) => (
          <button key={t.id} className={`tab ${sub === t.id ? 'active' : ''}`} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'summary' && (
        <SummaryTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />
      )}
      {sub === 'sim' && <EarningsSimulator state={state} />}
      {sub === 'goal' && <GoalTimeCalculator state={state} />}
      {sub === 'sites' && <SitesTab state={state} setState={setState} />}
    </>
  );
}
