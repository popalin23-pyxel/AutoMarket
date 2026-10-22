import React, { useMemo } from 'react';
import { computeMonthSummary, computeTaxes, todayISO } from '../lib/calc.js';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function GoalTimeCalculator({ state }) {
  const { sites, settings } = state;
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));

  const sum = useMemo(
    () => computeMonthSummary(state.shifts, state.sites, state.settings, y, m, state.occasionalWork),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork],
  );
  // l'obiettivo si misura sul netto totale (sedi + prestazioni occasionali), come in Home;
  // la stima delle ore resta sulla resa oraria delle sedi (le prestazioni non sono a ore)
  const net = sum.netTotal;

  const goal = Number(settings.monthlyGoal) || 0;

  const netHourlyRate = useMemo(() => {
    if (sum.totalHours > 0) return sum.net / sum.totalHours;
    if (sites.length === 0) return 0;
    const avgRate = sites.reduce((a, s) => a + (Number(s.rate) || 0), 0) / sites.length;
    const avgRivalsa = sites.reduce((a, s) => a + (s.rivalsaPercent != null ? s.rivalsaPercent : (Number(settings.rivalsaPercent) || 0)), 0) / sites.length;
    // netto di un'ora "media", con lo stesso calcolo delle tasse usato nel resto dell'app
    return computeTaxes(avgRate, avgRate * (avgRivalsa / 100), settings).net;
  }, [sum, sites, settings]);

  if (goal <= 0) {
    return (
      <div className="panel">
        <h2 className="panel-title">Quanto devo ancora lavorare?</h2>
        <EmptyState icon="checkCircle" title="Imposta prima un obiettivo"
          hint="Scrivi qui sopra quanto vuoi guadagnare (netto) questo mese: il calcolo comparirà qui." />
      </div>
    );
  }

  const remaining = Math.max(0, round2(goal - net));
  const reached = net >= goal;
  const hoursNeeded = !reached && netHourlyRate > 0 ? remaining / netHourlyRate : 0;
  const fullShifts = Math.floor(hoursNeeded / 8);
  const restHours = round2(hoursNeeded - fullShifts * 8);

  let suggestion = '';
  if (fullShifts > 0 && restHours > 0.05) suggestion = `${fullShifts} turni da 8h + ${fmt1(restHours)}h`;
  else if (fullShifts > 0) suggestion = `${fullShifts} turni da 8h`;
  else if (hoursNeeded > 0.05) suggestion = `${fmt1(hoursNeeded)}h`;

  return (
    <div className="panel">
      <h2 className="panel-title">Quanto devo ancora lavorare?</h2>
      <p className="panel-desc">Raggiungi il tuo obiettivo mensile — {new Date(y, m - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}.</p>

      <div className="stats-row">
        <div className="stat"><div className="stat-label">Obiettivo netto</div><div className="stat-value">€{fmt(goal)}</div></div>
        <div className="stat"><div className="stat-label">Netto attuale</div><div className="stat-value gold">€{fmt(net)}</div></div>
      </div>

      <div className="goal-bar-track" style={{ marginBottom: 14 }}>
        <div className={`goal-bar-fill ${reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.round((net / goal) * 100))}%` }} />
      </div>

      {reached ? (
        <div className="hint hint-info" style={{ marginBottom: 0 }}>
          🎯 Obiettivo raggiunto! Sei a €{fmt(net - goal)} oltre il tuo obiettivo.
        </div>
      ) : (
        <>
          <div className="summary-flow">
            <div className="flow-row taxes"><span className="flow-label">Mancano</span><span className="flow-value red">€{fmt(remaining)}</span></div>
            {netHourlyRate > 0 && (
              <div className="flow-row"><span className="flow-label">Ore necessarie (a €{fmt1(netHourlyRate)}/h netti)</span><span className="flow-value">≈ {fmt1(hoursNeeded)} h</span></div>
            )}
          </div>
          {suggestion && (
            <div className="sim-goal-note" style={{ marginTop: 12 }}>👉 circa {suggestion}</div>
          )}
        </>
      )}
    </div>
  );
}
