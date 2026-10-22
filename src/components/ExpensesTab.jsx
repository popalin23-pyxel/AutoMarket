import React, { useMemo, useState } from 'react';
import { computeMonthSummary, computeYearSummary, todayISO } from '../lib/calc.js';
import { EXPENSE_CATEGORIES } from '../lib/defaults.js';
import { addExpense, removeExpense } from '../lib/store.js';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import Icon from './icons/Icon.jsx';
import NumberInput from './NumberInput.jsx';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const catFor = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export default function ExpensesTab({ state, setState }) {
  const [period, setPeriod] = useState('month'); // 'month' | 'year'
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const confirmAction = useConfirm();

  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));

  const periodExpenses = useMemo(() => {
    return state.expenses.filter((e) => {
      const ey = Number((e.date || '').slice(0, 4));
      const em = Number((e.date || '').slice(5, 7));
      return period === 'year' ? ey === y : (ey === y && em === m);
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [state.expenses, period, y, m]);

  const totalExpenses = useMemo(
    () => periodExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0),
    [periodExpenses],
  );
  // i versamenti alla cassa sono già nelle tasse e contributi stimati: non si tolgono due volte
  const fundPayments = useMemo(
    () => periodExpenses.filter((e) => catFor(e.category).inTaxes).reduce((a, e) => a + (Number(e.amount) || 0), 0),
    [periodExpenses],
  );
  const otherExpenses = totalExpenses - fundPayments;

  const earnings = useMemo(() => {
    return period === 'year'
      ? computeYearSummary(state.shifts, state.sites, state.settings, y, state.occasionalWork)
      : computeMonthSummary(state.shifts, state.sites, state.settings, y, m, state.occasionalWork);
  }, [state.shifts, state.sites, state.settings, state.occasionalWork, period, y, m]);

  // entrate di sedi e prestazioni occasionali, ciascuna con la sua tassazione
  const occasionalGross = earnings.occasionalGross || 0;
  const invoice = earnings.totalInvoice + occasionalGross;
  const taxes = (period === 'year' ? earnings.totalTaxes : earnings.taxes) + (earnings.occasionalTaxes || 0);
  const available = invoice - taxes - otherExpenses;

  const addNewExpense = () => {
    const n = Number(amount);
    if (!n || n <= 0 || !date) return; // senza data la spesa non comparirebbe in nessun elenco
    setState((s) => addExpense(s, { date, category, amount: n, note: note.trim() }));
    setAmount(''); setNote(''); setFormOpen(false);
  };

  const delExpense = async (exp) => {
    const cat = catFor(exp.category);
    const ok = await confirmAction(`Eliminare la spesa "${cat.label}" di €${fmt(exp.amount)}?`, { title: 'Eliminare spesa', danger: true, confirmLabel: 'Elimina' });
    if (!ok) return;
    setState((s) => removeExpense(s, exp.id));
  };

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Spese professionali</h2>
        <p className="panel-desc">
          Tieni traccia delle spese del tuo lavoro per sapere quanto ti resta davvero. Nel regime forfettario
          non si scalano dalle tasse (lo fa già il coefficiente), tranne i contributi versati alla cassa.
        </p>

        <div className="theme-switch" style={{ marginBottom: 14 }}>
          <button className={`theme-opt ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Mese corrente</button>
          <button className={`theme-opt ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>Anno</button>
        </div>

        <button className="btn btn-primary btn-block" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? '✕ Annulla' : '+ Aggiungi spesa'}
        </button>

        {formOpen && (
          <div style={{ marginTop: 14 }}>
            <div className="editor-label">Categoria</div>
            <div className="site-picker">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`site-pick-btn ${category === c.id ? 'sel' : ''}`} onClick={() => setCategory(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label className="field-label">Importo (€)</label>
                <NumberInput value={amount} onChange={setAmount} min={0} max={99999} allowEmpty />
              </div>
              <div className="field">
                <label className="field-label">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="editor-label">Nota (opzionale)</div>
            <input type="text" value={note} placeholder="es. pieno diesel"
              onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minWidth: 0, marginBottom: 12 }} />
            <button className="btn btn-primary btn-block" onClick={addNewExpense} disabled={!amount || Number(amount) <= 0 || !date}>Salva spesa</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">{period === 'year' ? `Spese ${y}` : 'Spese di questo mese'}</h2>
        {periodExpenses.length === 0 ? (
          <EmptyState icon="euro" title="Nessuna spesa registrata" hint="Aggiungine una qui sopra per iniziare a tenerne traccia." />
        ) : (
          <>
            <div className="expense-list">
              {periodExpenses.map((e) => {
                const cat = catFor(e.category);
                return (
                  <div key={e.id} className="expense-row">
                    <span className={`nav-icon-tile tile-${cat.tile}`}><Icon name="euro" size={16} /></span>
                    <div className="expense-info">
                      <div className="expense-cat">{cat.label}</div>
                      <div className="expense-date">{e.date}{e.note ? ` · ${e.note}` : ''}</div>
                    </div>
                    <span className="expense-amount">€{fmt(e.amount)}</span>
                    <button className="fav-chip-x" onClick={() => delExpense(e)}>✕</button>
                  </div>
                );
              })}
            </div>

            <div className="summary-flow" style={{ marginTop: 14 }}>
              <div className="flow-row"><span className="flow-label">Fatturato {period === 'year' ? 'anno' : 'mese'}{occasionalGross > 0 ? ' + prestazioni' : ''}</span><span className="flow-value">€{fmt(invoice)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Tasse e contributi stimati</span><span className="flow-value red">−€{fmt(taxes)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Spese{fundPayments > 0 ? ' (esclusi i contributi cassa)' : ' totali'}</span><span className="flow-value red">−€{fmt(otherExpenses)}</span></div>
              <div className="flow-row net"><span className="flow-label">Disponibile stimato</span><span className="flow-value green">€{fmt(available)}</span></div>
            </div>
            {fundPayments > 0 && (
              <p className="fiscal-footnote">
                I €{fmt(fundPayments)} versati alla cassa non vengono tolti di nuovo: sono già compresi nelle tasse e contributi stimati.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
