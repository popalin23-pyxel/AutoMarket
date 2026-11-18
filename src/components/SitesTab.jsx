import React, { useState } from 'react';
import { addSite, updateSite, removeSite, changeSitePay } from '../lib/store.js';
import { PENSION_FUNDS } from '../lib/defaults.js';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import { sitePayOn, scheduledRateChange, todayISO, addDaysISO } from '../lib/calc.js';
import { payText, invoiceText, defaultPercent, extraName, pctText } from '../lib/payOptions.js';
import SiteDetailsDialog from './SiteDetailsDialog.jsx';
import SiteEditor from './SiteEditor.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import EmptyState from './EmptyState.jsx';
import Icon from './icons/Icon.jsx';

const fmtDay = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}/${y.slice(2)}`; };

// Riga sotto la paga: un cambio già fissato nel futuro, oppure l'ultimo cambio fatto.
function historyLine(site, today, settings) {
  const next = scheduledRateChange(site, today);
  if (next) return `Dal ${fmtDay(next.from)}: ${payText(next, settings)}`;
  const past = site.pastRates ?? [];
  const last = past[past.length - 1];
  if (!last) return '';
  return `Dal ${fmtDay(last.before)} · prima ${payText(sitePayOn(site, addDaysISO(last.before, -1)), settings)}`;
}

// Sedi e paghe: l'elenco delle strutture con come pagano; si tocca una sede per cambiarla.
export default function SitesTab({ state, setState, onOpenFiscal }) {
  const [editing, setEditing] = useState(null); // null | 'new' | sede
  const [detailsSite, setDetailsSite] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const confirmAction = useConfirm();
  const settings = state.settings;
  const today = todayISO();
  const activeSites = state.sites.filter((s) => !s.archived);
  const archivedSites = state.sites.filter((s) => s.archived);
  const def = defaultPercent(settings);
  const fund = PENSION_FUNDS.find((f) => f.id === settings.pensionFund && f.id !== 'altro');

  const patch = (id, p) => setState((s) => updateSite(s, id, p));
  // Archiviare: la sede sparisce dalle scelte per i nuovi turni, ma i turni passati restano
  // con i loro guadagni (eliminandola diventerebbero "Sede eliminata" a 0 €).
  const archive = (site, archived) => patch(site.id, { archived: archived || undefined });

  const submit = ({ name, color, terms, payChanged, from }) => {
    if (editing === 'new') {
      setState((s) => addSite(s, name, terms.rate, { color, payMode: terms.payMode, rivalsaPercent: terms.rivalsaPercent }));
    } else {
      const id = editing.id;
      setState((s) => {
        const next = updateSite(s, id, { name, color });
        return payChanged ? changeSitePay(next, id, terms, from) : next;
      });
    }
    setEditing(null);
  };

  const del = async (site) => {
    const nShifts = state.shifts.filter((sh) => sh.siteId === site.id).length;
    const msg = nShifts > 0
      ? `"${site.name}" ha ${nShifts} turni registrati. Eliminandola, quei turni resteranno nel calendario ma senza sede (0€ nel calcolo): per tenerli conviene lasciarla archiviata. Eliminare comunque?`
      : `Eliminare "${site.name}"?`;
    const ok = await confirmAction(msg, { title: 'Eliminare sede', danger: true, confirmLabel: 'Elimina' });
    if (ok) setState((s) => removeSite(s, site.id));
  };

  return (
    <>
      <p className="sites-intro">Le strutture dove lavori e come ti pagano. Tocca una sede per cambiare nome, colore o paga.</p>

      {activeSites.length === 0 ? (
        <div className="ncard sites-empty">
          <EmptyState icon="mapPin" title="Nessuna sede" hint="Aggiungi la prima struttura con la sua paga oraria: servirà per i turni." />
          <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Aggiungi la prima sede
          </button>
        </div>
      ) : (
        <div className="lcard sites-list">
          {activeSites.map((s) => {
            const terms = sitePayOn(s, today);
            const hist = historyLine(s, today, settings);
            return (
              <button key={s.id} type="button" className="lrow site-row" onClick={() => setEditing(s)}>
                <SiteAvatar site={s} size={40} />
                <span className="lrow-tx">
                  <span className="lrow-t site-row-name">{s.name}</span>
                  <span className="site-row-pay">{payText(terms, settings)}</span>
                  <span className="site-row-sub">{invoiceText(terms, settings)}{hist ? ` · ${hist}` : ''}</span>
                </span>
                <span className="lrow-end"><Icon name="chevronRight" size={19} /></span>
              </button>
            );
          })}
          <button type="button" className="lrow site-add" onClick={() => setEditing('new')}>
            <span className="site-add-ic"><Icon name="plus" size={20} /></span>
            <span className="lrow-t">Aggiungi una sede</span>
          </button>
        </div>
      )}

      <p className="sites-foot">
        {def > 0
          ? <>Percentuale di riferimento: <b>{pctText(def)} di {extraName(settings)}</b>{fund ? ` (${fund.label})` : ''}.</>
          : <>La tua cassa non prevede maggiorazioni in fattura{fund ? ` (${fund.label})` : ''}.</>}
        {onOpenFiscal && <> <button type="button" className="link-btn" onClick={onOpenFiscal}>Cambia in Tasse e cassa</button></>}
      </p>

      {archivedSites.length > 0 && (
        <>
          <button type="button" className="grp-title sites-arch-toggle" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived}>
            Archiviate ({archivedSites.length}) <Icon name="chevronDown" size={16} style={{ transform: showArchived ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showArchived && (
            <div className="lcard">
              {archivedSites.map((s) => (
                <div key={s.id} className="lrow site-arch-row">
                  <SiteAvatar site={s} size={32} />
                  <span className="lrow-tx"><span className="lrow-t site-arch-name">{s.name}</span></span>
                  <button type="button" className="btn btn-sm" onClick={() => archive(s, false)}>Ripristina</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => del(s)} aria-label={`Elimina ${s.name}`}><Icon name="trash" size={16} /></button>
                </div>
              ))}
              <p className="sites-arch-note">I turni passati delle sedi archiviate restano nel calendario e nei guadagni.</p>
            </div>
          )}
        </>
      )}

      {editing && (
        <SiteEditor site={editing === 'new' ? null : editing} state={state} onSubmit={submit} onClose={() => setEditing(null)}
          onDetails={() => { const s = editing; setEditing(null); setDetailsSite(s); }}
          onArchive={() => { archive(editing, true); setEditing(null); }} />
      )}
      {detailsSite && (
        <SiteDetailsDialog site={detailsSite} onClose={() => setDetailsSite(null)}
          onSave={(p) => { patch(detailsSite.id, p); setDetailsSite(null); }} />
      )}
    </>
  );
}
