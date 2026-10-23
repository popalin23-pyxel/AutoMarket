import React, { useMemo } from 'react';
import { computeMonthProgress, computeTaxes, siteRateOn, todayISO } from '../lib/calc.js';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function GoalTimeCalculator({ state }) {
  const { settings } = state;
  const sites = state.sites.filter((s) => !s.archived);
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));

  // come in Home: già guadagnato (turni finiti) e previsione con i turni in programma;
  // le ore da aggiungere si contano oltre ai turni già in calendario
  const progress = useMemo(
    () => computeMonthProgress(state.shifts, state.sites, state.settings, y, m, state.occasionalWork),
    [state.shifts, state.sites, state.settings, y, m, state.occasionalWork],
  );
  const sum = progress.total;
  const done = progress.done.netTotal;
  const net = sum.netTotal; // con i turni in programma
  const hasPlanned = progress.planned.shiftCount > 0 || progress.planned.occasionalCount > 0;

  const goal = Number(settings.monthlyGoal) || 0;

  const netHourlyRate = useMemo(() => {
    if (sum.totalHours > 0) return sum.net / sum.totalHours;
    if (sites.length === 0) return 0;
    const avgRate = sites.reduce((a, s) => a + siteRateOn(s, today), 0) / sites.length;
    const avgRivalsa = sites.reduce((a, s) => a + (s.rivalsaPercent != null ? s.rivalsaPercent : (Number(settings.rivalsaPercent) || 0)), 0) / sites.length;
    // netto di un'ora "media", con lo stesso calcolo delle tasse usato nel resto dell'app
    return computeTaxes(avgRate, avgRate * (avgRivalsa / 100), settings).net;
  }, [sum, sites, settings, today]);

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
  const reached = done >= goal;          // raggiunto davvero
  const covered = !reached && net >= goal; // raggiunto con i turni in programma
  const hoursNeeded = !reached && !covered && netHourlyRate > 0 ? remaining / netHourlyRate : 0;
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
        <div className="stat"><div className="stat-label">Già guadagnato</div><div className="stat-value gold">€{fmt(done)}</div></div>
        {hasPlanned && (
          <div className="stat"><div className="stat-label">Con i turni in programma</div><div className="stat-value">€{fmt(net)}</div></div>
        )}
      </div>

      <div className="goal-bar-track" style={{ marginBottom: 14 }}>
        {hasPlanned && !reached && (
          <div className="goal-bar-fill planned" style={{ width: `${Math.min(100, Math.round((net / goal) * 100))}%` }} />
        )}
        <div className={`goal-bar-fill ${reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.round((done / goal) * 100))}%` }} />
      </div>

      {reached ? (
        <div className="hint hint-info" style={{ marginBottom: 0 }}>
          🎯 Obiettivo raggiunto! Sei a €{fmt(done - goal)} oltre il tuo obiettivo.
        </div>
      ) : covered ? (
        <div className="hint hint-info" style={{ marginBottom: 0 }}>
          🎯 Con i turni già in programma arrivi a €{fmt(net)}: l'obiettivo è coperto, non servono altri turni.
        </div>
      ) : (
        <>
          <div className="summary-flow">
            <div className="flow-row taxes"><span className="flow-label">{hasPlanned ? 'Mancano, oltre ai turni in programma' : 'Mancano'}</span><span className="flow-value red">€{fmt(remaining)}</span></div>
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
