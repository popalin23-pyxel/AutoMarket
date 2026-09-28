import React, { useMemo, useState } from 'react';
import SiteAvatar from './SiteAvatar.jsx';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function EarningsSimulator({ state }) {
  const { sites, settings } = state;
  const [hoursPerShift, setHoursPerShift] = useState(8);
  const [counts, setCounts] = useState({}); // { [siteId]: number }

  const bump = (siteId, delta) => {
    setCounts((c) => ({ ...c, [siteId]: Math.max(0, (c[siteId] || 0) + delta) }));
  };

  const result = useMemo(() => {
    const perSite = sites.map((s) => {
      const n = counts[s.id] || 0;
      const hours = round2(n * hoursPerShift);
      const revenue = round2(hours * s.rate);
      const rivPct = s.rivalsaPercent != null ? s.rivalsaPercent : (Number(settings.rivalsaPercent) || 0);
      const rivalsa = round2(revenue * (rivPct / 100));
      return { site: s, count: n, hours, revenue, rivalsa, total: round2(revenue + rivalsa) };
    });
    const totalHours = round2(perSite.reduce((a, p) => a + p.hours, 0));
    const totalRevenue = round2(perSite.reduce((a, p) => a + p.revenue, 0));
    const totalRivalsa = round2(perSite.reduce((a, p) => a + p.rivalsa, 0));
    const totalInvoice = round2(totalRevenue + totalRivalsa);
    const taxes = round2(totalInvoice * ((Number(settings.taxPercent) || 0) / 100));
    const net = round2(totalInvoice - taxes);
    return { perSite, totalHours, totalRevenue, totalRivalsa, totalInvoice, taxes, net };
  }, [sites, counts, hoursPerShift, settings]);

  const goal = Number(settings.monthlyGoal) || 0;
  const hasAnyShift = result.totalHours > 0;

  if (sites.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-title">Simulatore guadagni</h2>
        <EmptyState icon="euro" title="Aggiungi prima una sede" hint="Il simulatore usa la paga oraria delle tue sedi per stimare i guadagni." />
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2 className="panel-title">Simulatore guadagni</h2>
        <p className="panel-desc">Quanto guadagnerei se facessi questi turni? Numeri ipotetici, non registra nulla.</p>

        <div className="field" style={{ marginBottom: 14, maxWidth: 160 }}>
          <label className="field-label">Ore medie per turno</label>
          <input type="number" min={1} max={24} step="0.5" value={hoursPerShift}
            onChange={(e) => setHoursPerShift(Math.max(1, Number(e.target.value) || 8))} />
        </div>

        <div className="sim-site-list">
          {sites.map((s) => (
            <div key={s.id} className="sim-site-row">
              <SiteAvatar site={s} size={26} />
              <div className="sim-site-info">
                <div className="sim-site-name">{s.name}</div>
                <div className="sim-site-rate">€{s.rate}/h</div>
              </div>
              <div className="sim-stepper">
                <button type="button" onClick={() => bump(s.id, -1)} disabled={!counts[s.id]}>−</button>
                <span>{counts[s.id] || 0}</span>
                <button type="button" onClick={() => bump(s.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Risultato stimato</h2>
        {!hasAnyShift ? (
          <EmptyState icon="euro" title="Aggiungi qualche turno sopra" hint="Tocca i + accanto a una sede per iniziare a vedere la stima." />
        ) : (
          <>
            <div className="stats-row">
              <div className="stat"><div className="stat-label">Ore totali</div><div className="stat-value">{fmt(result.totalHours)}</div></div>
              <div className="stat"><div className="stat-label">Compenso</div><div className="stat-value">€{fmt(result.totalRevenue)}</div></div>
              <div className="stat"><div className="stat-label">Rivalsa</div><div className="stat-value">€{fmt(result.totalRivalsa)}</div></div>
            </div>
            <div className="summary-flow">
              <div className="flow-row total"><span className="flow-label">Fatturato</span><span className="flow-value">€{fmt(result.totalInvoice)}</span></div>
              <div className="flow-row taxes"><span className="flow-label">Tasse stimate ({settings.taxPercent}%)</span><span className="flow-value red">−€{fmt(result.taxes)}</span></div>
              <div className="flow-row net"><span className="flow-label">Netto stimato</span><span className="flow-value green">€{fmt(result.net)}</span></div>
            </div>
            {goal > 0 && (
              <div className="sim-goal-note">
                {result.net >= goal
                  ? `🎯 Raggiungeresti il tuo obiettivo di €${fmt(goal)}, con €${fmt(result.net - goal)} in più.`
                  : `🎯 Mancherebbero €${fmt(goal - result.net)} al tuo obiettivo di €${fmt(goal)}.`}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
