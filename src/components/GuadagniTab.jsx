import React, { useState } from 'react';
import SummaryTab from './SummaryTab.jsx';
import EarningsSimulator from './EarningsSimulator.jsx';
import ExpensesTab from './ExpensesTab.jsx';

// Il denaro del lavoro svolto. Sedi, tasse e obiettivo si configurano in Studio;
// grafici e confronti stanno in Analisi.
const SUB_TABS = [
  { id: 'summary', label: 'Riepilogo' },
  { id: 'sim', label: 'Simulatore' },
  { id: 'expenses', label: 'Spese' },
];

export default function GuadagniTab({ state, setState, year, month, setYear, setMonth, initialSub = 'summary', onNavigate }) {
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

      {sub === 'summary' && (
        <SummaryTab state={state} year={year} month={month} setYear={setYear} setMonth={setMonth} />
      )}
      {sub === 'sim' && <EarningsSimulator state={state} onNavigate={onNavigate} />}
      {sub === 'expenses' && <ExpensesTab state={state} setState={setState} />}
    </>
  );
}
