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

  const earnings = useMemo(() => {
    return period === 'year'
      ? computeYearSummary(state.shifts, state.sites, state.settings, y)
      : computeMonthSummary(state.shifts, state.sites, state.settings, y, m);
  }, [state.shifts, state.sites, state.settings, period, y, m]);

  const invoice = period === 'year' ? earnings.totalInvoice : earnings.totalInvoice;
  const taxes = period === 'year' ? earnings.totalTaxes : earnings.taxes;
  const available = invoice - taxes - totalExpenses;

  const addNewExpense = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
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
        <p className="panel-desc">Tieni traccia delle spese deducibili legate al tuo lavoro.</p>

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
            <button className="btn btn-primary btn-block" onClick={addNewExpense} disabled={!amount || Number(amount) <= 0}>Salva spesa</button>
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
              <div className="flow-row"><span className="flow-label">Fatturato {period === 'year' ? 'anno' : 'mese'}</span><span className="flow-value">€{fmt(invoice)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Tasse stimate</span><span className="flow-value red">−€{fmt(taxes)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Spese totali</span><span className="flow-value red">−€{fmt(totalExpenses)}</span></div>
              <div className="flow-row net"><span className="flow-label">Disponibile stimato</span><span className="flow-value green">€{fmt(available)}</span></div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
