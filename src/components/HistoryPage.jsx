import React, { useMemo, useState } from 'react';
import { visibleTrash, whenLabel, TRASH_DAYS, HISTORY_DAYS } from '../lib/history.js';
import { restoreFromTrash } from '../lib/store.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';

const ACT = {
  add: { icon: 'plus', cls: 'ic-grn' },
  delete: { icon: 'trash', cls: 'ic-rose' },
  cancel: { icon: 'x', cls: 'ic-gold' },
  restore: { icon: 'undo', cls: 'ic-blue' },
  edit: { icon: 'pencil', cls: 'ic-sla' },
  bulk: { icon: 'sliders', cls: 'ic-vio' },
};

const FILTERS = [
  { id: 'all', label: 'Tutte' },
  { id: 'shifts', label: 'Solo turni' },
  { id: 'lost', label: 'Eliminati e «non fatto»' },
];

function dayTitle(at) {
  const d = new Date(at);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === yest.toDateString()) return 'Ieri';
  return `${WEEKDAYS_IT_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()}`;
}
const timeOf = (at) => new Date(at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Altro → Modifiche e cestino: chi ha cambiato cosa e quando (su tutti i dispositivi),
// e ciò che è stato eliminato negli ultimi 30 giorni, da rimettere a posto con un tocco.
export default function HistoryPage({ state, setState }) {
  const [tab, setTab] = useState('history');
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(60);
  const [restoredMsg, setRestoredMsg] = useState(null);
  const trash = visibleTrash(state);

  const rows = useMemo(() => {
    const all = [...(state.history ?? [])].sort((a, b) => b.at - a.at);
    if (filter === 'shifts') return all.filter((h) => h.col === 'shifts');
    if (filter === 'lost') return all.filter((h) => h.act === 'delete' || h.act === 'cancel' || h.act === 'bulk');
    return all;
  }, [state.history, filter]);

  const groups = useMemo(() => {
    const out = [];
    for (const h of rows.slice(0, shown)) {
      const title = dayTitle(h.at);
      if (!out.length || out[out.length - 1].title !== title) out.push({ title, items: [] });
      out[out.length - 1].items.push(h);
    }
    return out;
  }, [rows, shown]);

  const restore = (entry) => {
    setState((s) => restoreFromTrash(s, entry));
    setRestoredMsg(`Ripristinato: ${entry.text}`);
    setTimeout(() => setRestoredMsg(null), 2500);
  };

  return (
    <>
      <div className="seg seg-wide" role="tablist" style={{ marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Modifiche</button>
        <button type="button" role="tab" aria-selected={tab === 'trash'} className={tab === 'trash' ? 'on' : ''} onClick={() => setTab('trash')}>
          Cestino{trash.length ? ` (${trash.length})` : ''}
        </button>
      </div>

      {tab === 'history' && (
        <>
          <p className="panel-desc" style={{ margin: '0 4px 10px' }}>
            Ogni cambiamento ai turni, alle sedi, alle prestazioni e alle spese, con il giorno, l'ora e il telefono
            da cui è stato fatto. Si tengono gli ultimi {HISTORY_DAYS} giorni.
          </p>
          <div className="filter-row" style={{ marginBottom: 10 }}>
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => { setFilter(f.id); setShown(60); }}>
                {f.label}
              </button>
            ))}
          </div>
          {groups.length === 0 ? (
            <div className="ncard hist-empty">Nessuna modifica registrata{filter === 'all' ? ' finora' : ' con questo filtro'}.</div>
          ) : groups.map((g) => (
            <div key={g.title}>
              <div className="grp-title">{g.title}</div>
              <div className="lcard">
                {g.items.map((h) => {
                  const a = ACT[h.act] ?? ACT.edit;
                  return (
                    <div key={h.id} className="hist-row">
                      <span className={`lrow-ic ${a.cls}`}><Icon name={a.icon} size={18} strokeWidth={2.2} /></span>
                      <span className="lrow-tx">
                        <span className="hist-t">{h.text}</span>
                        <span className="lrow-s" style={{ display: 'block' }}>alle {timeOf(h.at)} · {h.dev || 'dispositivo sconosciuto'}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {rows.length > shown && (
            <button type="button" className="btn btn-block" onClick={() => setShown((n) => n + 60)}>Mostra altre</button>
          )}
        </>
      )}

      {tab === 'trash' && (
        <>
          <p className="panel-desc" style={{ margin: '0 4px 10px' }}>
            Turni, prestazioni, giorni segnati, sedi e spese eliminati negli ultimi {TRASH_DAYS} giorni. "Ripristina" li rimette
            com'erano, anche sugli altri dispositivi.
          </p>
          {trash.length === 0 ? (
            <div className="ncard hist-empty">Il cestino è vuoto.</div>
          ) : (
            <div className="lcard">
              {trash.map((t) => (
                <div key={t.id} className="hist-row">
                  <span className="lrow-ic ic-rose"><Icon name="trash" size={18} strokeWidth={2.2} /></span>
                  <span className="lrow-tx">
                    <span className="hist-t">{t.text}</span>
                    <span className="lrow-s" style={{ display: 'block' }}>eliminato {whenLabel(t.at)} · {t.dev || 'dispositivo sconosciuto'}</span>
                  </span>
                  <button type="button" className="pill-btn hist-restore" onClick={() => restore(t)}>
                    <Icon name="undo" size={16} strokeWidth={2.4} /> Ripristina
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {restoredMsg && <div className="save-toast">✓ {restoredMsg}</div>}
    </>
  );
}
