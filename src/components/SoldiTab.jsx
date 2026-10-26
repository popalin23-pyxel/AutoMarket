import React, { useMemo } from 'react';
import { computeMonthProgress, compareMonths } from '../lib/calc.js';
import { MONTHS_IT } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import { ListRow } from './AltroTab.jsx';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 });
const fmt1 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 1 });

// Euro grandi con i centesimi più piccoli: €3.051,31
function BigEuro({ value }) {
  const [int, dec] = fmt(value).split(',');
  return <>€{int}<small>,{dec}</small></>;
}

// Soldi: quanto ti resta, spiegato come un conto in colonna, e sotto il dettaglio.
export default function SoldiTab({ state, year, month, setYear, setMonth, onOpen, now = new Date() }) {
  // `now` arriva da App (si aggiorna ogni minuto): quando un turno finisce, "finora" cresce da solo
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const when = year * 12 + month - (curY * 12 + curM); // <0 passato, 0 questo mese, >0 futuro

  const progress = useMemo(
    () => computeMonthProgress(state.shifts, state.sites, state.settings, year, month, state.occasionalWork, now),
    [state.shifts, state.sites, state.settings, year, month, state.occasionalWork, now],
  );
  const cmp = useMemo(
    () => compareMonths(state.shifts, state.sites, state.settings, year, month, state.occasionalWork),
    [state.shifts, state.sites, state.settings, year, month, state.occasionalWork],
  );
  const { done, planned, total } = progress;
  // questo mese: ciò che è già stato lavorato; mesi passati: tutto; mesi futuri: ciò che è in programma
  const shown = when === 0 ? done : total;
  const hasPlanned = when === 0 && (planned.shiftCount > 0 || planned.occasionalCount > 0);
  const hasData = total.shiftCount > 0 || total.occasionalCount > 0;
  const before = shown.totalInvoice + (shown.occasionalGross || 0);
  const aside = shown.taxes + (shown.occasionalTaxes || 0);
  const perHour = shown.totalHours > 0 ? shown.net / shown.totalHours : 0;
  const goal = Number(state.settings.monthlyGoal) || 0;
  // per difetto: 99,6% non deve diventare "100%" se l'obiettivo non è raggiunto
  const pct = (v) => (goal > 0 ? Math.floor((v / goal) * 100) : 0);

  const lead = when < 0 ? 'Tolte le tasse, ti sono rimasti'
    : when > 0 ? 'Con i turni in programma, tolte le tasse, ti resteranno'
      : 'Tolte le tasse, finora ti restano';

  const monthExpenses = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return (state.expenses ?? []).filter((e) => (e.date || '').startsWith(prefix)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }, [state.expenses, year, month]);
  // come il resto della pagina: questo mese solo i turni già fatti
  const perSiteSub = shown.perSite.filter((p) => p.total > 0).slice(0, 3).map((p) => `${p.name} €${fmt0(p.total)}`).join(' · ');

  const prev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const next = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const delta = cmp.deltaNetPct;
  const prevName = MONTHS_IT[(month + 10) % 12].toLowerCase();

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Soldi</h1>
        <div className="month-switch">
          <button type="button" className="round-btn" onClick={prev} aria-label="Mese precedente"><Icon name="chevronLeft" size={20} /></button>
          <span className="month-switch-label">{MONTHS_IT[month - 1]} {year}</span>
          <button type="button" className="round-btn" onClick={next} aria-label="Mese successivo"><Icon name="chevronRight" size={20} /></button>
        </div>
      </div>

      <div className="ncard money-hero">
        <div className="money-lead">{lead}</div>
        <div className="money-big-row">
          <span className="money-big"><BigEuro value={shown.netTotal} /></span>
          {/* confronto solo per i mesi finiti: a metà mese (o per un mese futuro) le cifre sono parziali */}
          {hasData && when < 0 && (delta == null
            ? <span className="pill-up new">nuovo</span>
            : <span className={`pill-up ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '↑' : '↓'} {fmt1(Math.abs(delta))}% su {prevName}</span>)}
        </div>
        <div className="money-sub">
          <Icon name="clock" size={16} />
          <span>
            {when > 0 ? 'Ore in programma' : 'Hai lavorato'} <b><span className="mono">{fmt1(shown.totalHours)}</span> ore</b>
            {perHour > 0 && <> · €{fmt(perHour)} per ogni ora</>}
          </span>
        </div>

        <div className="conto">
          <div className="conto-row">
            <span className="conto-sign ic-blue">+</span>
            <span className="conto-tx">
              <span className="conto-t" style={{ display: 'block' }}>Prima delle tasse</span>
              {hasPlanned && <span className="conto-s" style={{ display: 'block' }}>su €{fmt0(total.totalInvoice + (total.occasionalGross || 0))} previsti</span>}
            </span>
            <span className="conto-v">€{fmt(before)}</span>
          </div>
          <div className="conto-row">
            <span className="conto-sign ic-rose">−</span>
            <span className="conto-tx">
              <span className="conto-t" style={{ display: 'block' }}>Metti da parte</span>
              <span className="conto-s" style={{ display: 'block' }}>per tasse e cassa</span>
            </span>
            <span className="conto-v red">€{fmt(aside)}</span>
          </div>
          <div className="conto-row">
            <span className="conto-sign ic-grn">=</span>
            <span className="conto-tx">
              <span className="conto-t" style={{ display: 'block' }}>{when > 0 ? 'Ti resteranno' : 'Ti restano'}</span>
            </span>
            <span className="conto-v green">€{fmt(shown.netTotal)}</span>
          </div>
        </div>
      </div>

      {when === 0 && (hasPlanned || goal > 0) && (
        <div className="forecast-box">
          <div className="forecast-row">
            <span>
              <span className="forecast-t" style={{ display: 'block' }}>{hasPlanned ? 'A fine mese avrai circa' : 'Obiettivo del mese'}</span>
              {hasPlanned && <span className="forecast-s" style={{ display: 'block' }}>con le {fmt1(planned.totalHours)} ore in programma</span>}
            </span>
            <span className="forecast-v">€{fmt0(hasPlanned ? total.netTotal : goal)}</span>
          </div>
          {goal > 0 && (
            <>
              <div className="goal-bar-track" style={{ marginTop: 10 }}>
                {hasPlanned && done.netTotal < goal && <div className="goal-bar-fill planned" style={{ width: `${Math.min(100, pct(total.netTotal))}%` }} />}
                <div className={`goal-bar-fill ${done.netTotal >= goal ? 'reached' : ''}`} style={{ width: `${Math.min(100, pct(done.netTotal))}%` }} />
              </div>
              <div className="forecast-foot">
                <span>Obiettivo €{fmt0(goal)}: ora sei al {pct(done.netTotal)}%</span>
                {hasPlanned && <b>{pct(total.netTotal) >= 100 ? 'ci arrivi' : 'arrivi al'} {pct(total.netTotal)}%</b>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grp-title">Nel dettaglio</div>
      <div className="lcard">
        <ListRow color="teal" icon="mapPin" title="Per sede" sub={perSiteSub || 'Quanto da ogni struttura'} onClick={() => onOpen('dettaglio')} />
        <ListRow color="gold" icon="receipt" title="Spese" sub={monthExpenses > 0 ? `€${fmt(monthExpenses)} a ${MONTHS_IT[month - 1].toLowerCase()}` : 'Benzina, divisa, corsi…'} onClick={() => onOpen('spese')} />
        <ListRow color="vio" icon="chart" title="Grafici" sub="Andamento, confronti, anno e ferie" onClick={() => onOpen('grafici')} />
        <ListRow color="blue" icon="download" title="Esporta e foglio ore" sub="PDF, Excel, foglio ore per la struttura" onClick={() => onOpen('documenti')} />
        <ListRow color="grn" icon="calc" title="Simulatore" sub="E se faccio un turno in più?" onClick={() => onOpen('simulatore')} />
      </div>
      <p className="fiscal-footnote" style={{ margin: '0 6px 12px' }}>Stima, non sostituisce il calcolo del commercialista.</p>
    </>
  );
}
