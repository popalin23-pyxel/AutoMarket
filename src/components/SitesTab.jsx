import React, { useState } from 'react';
import { addSite, updateSite, removeSite, changeSiteRate } from '../lib/store.js';
import { SITE_COLORS } from '../lib/defaults.js';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import NumberInput from './NumberInput.jsx';
import EmptyState from './EmptyState.jsx';
import RateChangeDialog from './RateChangeDialog.jsx';
import { siteRateOn, scheduledRateChange, todayISO } from '../lib/calc.js';
import SiteDetailsDialog from './SiteDetailsDialog.jsx';

const fmtRate = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDay = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}/${y.slice(2)}`; };

export default function SitesTab({ state, setState }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [addError, setAddError] = useState('');
  const [color, setColor] = useState(SITE_COLORS[state.sites.length % SITE_COLORS.length]);
  const confirmAction = useConfirm();
  const [rateSite, setRateSite] = useState(null); // sede di cui si cambia la paga
  const [detailsSite, setDetailsSite] = useState(null); // scheda della struttura
  const [showArchived, setShowArchived] = useState(false);
  const activeSites = state.sites.filter((s) => !s.archived);
  const today = todayISO();
  const archivedSites = state.sites.filter((s) => s.archived);

  const add = () => {
    const n = name.trim();
    // 0 è una paga oraria valida (es. una sede "Appuntamento" per promemoria,
    // non un vero turno pagato) — niente a che fare col campo vuoto.
    if (!n) { setAddError('Scrivi il nome della sede.'); return; }
    if (rate === '' || rate == null) { setAddError('Scrivi la paga oraria (anche 0, se non è pagata).'); return; }
    setState((s) => addSite(s, n, rate, { color }));
    setAddError('');
    setName(''); setRate(''); setColor(SITE_COLORS[(state.sites.length + 1) % SITE_COLORS.length]);
  };

  const patch = (id, p) => setState((s) => updateSite(s, id, p));

  // Archiviare: la sede sparisce dalle scelte per i nuovi turni, ma i turni passati restano
  // con i loro guadagni (eliminandola diventerebbero "Sede eliminata" a 0 €).
  const archive = (site, archived) => patch(site.id, { archived: archived || undefined });

  const del = async (site) => {
    const nShifts = state.shifts.filter((sh) => sh.siteId === site.id).length;
    const msg = nShifts > 0
      ? `"${site.name}" ha ${nShifts} turni registrati. Eliminandola, quei turni resteranno nel calendario ma senza sede (0€ nel calcolo): per tenerli conviene "Archivia". Eliminare comunque?`
      : `Eliminare "${site.name}"?`;
    const ok = await confirmAction(msg, { title: 'Eliminare sede', danger: true, confirmLabel: 'Elimina' });
    if (!ok) return;
    setState((s) => removeSite(s, site.id));
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Sedi di lavoro</h2>
      <p className="panel-desc">
        Aggiungi ogni posto dove lavori con la sua paga oraria. La rivalsa lasciala vuota per usare
        quella di default (in Tasse e cassa); impostala solo se questa sede fa eccezione.
      </p>

      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">Nome</label>
          <input type="text" value={name} placeholder="Es. CDS"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label className="field-label">Paga oraria (€)</label>
          <NumberInput value={rate} onChange={setRate} min={0} max={999} allowEmpty style={{ minWidth: 0 }} />
        </div>
        <div className="field">
          <label className="field-label">Colore</label>
          <div className="site-picker">
            {SITE_COLORS.map((c) => (
              <button key={c} type="button" className={`site-pick-btn ${color === c ? 'sel' : ''}`}
                style={{ padding: 6 }} onClick={() => setColor(c)}>
                <span className="site-dot" style={{ background: c }} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={add}>Aggiungi</button>
      </div>
      {addError && <div className="hint hint-warn">{addError}</div>}

      {activeSites.length === 0 && (
        <EmptyState icon="mapPin" title="Nessuna sede configurata" hint="Aggiungine una qui sopra per iniziare a registrare i turni." />
      )}

      {activeSites.length > 0 && (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th><th>Nome</th><th style={{ width: 110 }}>€ / ora</th>
              <th style={{ width: 130 }}>Rivalsa %</th><th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {activeSites.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="site-picker">
                    {SITE_COLORS.map((c) => (
                      <button key={c} type="button" className={`site-pick-btn ${s.color === c ? 'sel' : ''}`}
                        style={{ padding: 4 }} onClick={() => patch(s.id, { color: c })}>
                        <span className="site-dot" style={{ background: c }} />
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <input type="text" value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })}
                    style={{ minWidth: 100, width: '100%' }} />
                </td>
                <td>
                  <button type="button" className="rate-btn" onClick={() => setRateSite(s)} title="Cambia paga oraria">
                    €{fmtRate(siteRateOn(s, today))} ✎
                  </button>
                  {(() => {
                    const next = scheduledRateChange(s, today);
                    if (next) return <div className="rate-history">→ €{fmtRate(next.rate)} dal {fmtDay(next.from)}</div>;
                    const last = s.pastRates?.[s.pastRates.length - 1];
                    return last ? <div className="rate-history">dal {fmtDay(last.before)} · prima €{fmtRate(last.rate)}</div> : null;
                  })()}
                </td>
                <td>
                  <NumberInput value={s.rivalsaPercent} onChange={(v) => patch(s.id, { rivalsaPercent: v })}
                    min={0} max={100} allowEmpty style={{ minWidth: 0, width: 70 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-mut)', marginLeft: 4 }}>
                    {s.rivalsaPercent == null ? '(default)' : ''}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-sm" onClick={() => setDetailsSite(s)} title="Contatti, contratto, tetto ore">Scheda</button>
                    <button className="btn btn-sm" onClick={() => archive(s, true)} title="Non compare più tra le sedi, i turni passati restano">Archivia</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {archivedSites.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? '▾' : '▸'} Sedi archiviate ({archivedSites.length})
          </button>
          {showArchived && (
            <div className="archived-list">
              {archivedSites.map((s) => (
                <div key={s.id} className="archived-row">
                  <span className="site-dot" style={{ background: s.color }} />
                  <span className="archived-name">{s.name}</span>
                  <button className="btn btn-sm" onClick={() => archive(s, false)}>Ripristina</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(s)}>Elimina</button>
                </div>
              ))}
              <p className="panel-desc" style={{ marginTop: 6, marginBottom: 0 }}>
                I turni passati di queste sedi restano nel calendario e nei guadagni.
              </p>
            </div>
          )}
        </div>
      )}

      {detailsSite && (
        <SiteDetailsDialog site={detailsSite} onClose={() => setDetailsSite(null)}
          onSave={(p) => { patch(detailsSite.id, p); setDetailsSite(null); }} />
      )}

      {rateSite && (
        <RateChangeDialog site={rateSite} onClose={() => setRateSite(null)}
          onSave={(rate, from) => { setState((s) => changeSiteRate(s, rateSite.id, rate, from)); setRateSite(null); }} />
      )}
    </div>
  );
}
