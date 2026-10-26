import React, { useState } from 'react';
import { hoursOfShift, isShiftDone, siteRateOn, computeTaxes } from '../lib/calc.js';
import { rivalsaLabel, MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import NumberInput from './NumberInput.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const longDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : `${WEEKDAYS_IT_LONG[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()}`;
};

export default function ShiftEditor({
  date, shift, sites, favorites = [], lastSiteId, settings, allShifts = [],
  onSave, onDelete, onClose, onSaveFavorite, onDeleteFavorite, onCopy,
  initial, // nuovo turno già impostato (sede e orario scelti in "Aggiungi")
}) {
  const [siteId, setSiteId] = useState(shift?.siteId ?? initial?.siteId ?? lastSiteId ?? sites[0]?.id ?? null);
  const [start, setStart] = useState(shift?.start ?? initial?.start ?? '07:00');
  const [end, setEnd] = useState(shift?.end ?? initial?.end ?? '14:00');
  const [note, setNote] = useState(shift?.note ?? '');
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  // turno già passato: svolto (confermato) o non fatto (annullato, non conta nei guadagni)
  const [status, setStatus] = useState(shift?.status ?? null);
  // tariffa speciale solo per questo turno (es. notte pagata di più); altrimenti quella della sede
  const [customRateOn, setCustomRateOn] = useState(shift?.rate != null);
  const [customRate, setCustomRate] = useState(shift?.rate ?? '');
  const [copyOpen, setCopyOpen] = useState(false);
  useLockBodyScroll();
  useBackClose(onClose);
  const [copyDate, setCopyDate] = useState('');

  const hours = hoursOfShift({ date, start, end });
  const canSave = siteId != null && start && end;
  const showStatus = !!shift && (isShiftDone({ date, start, end }) || shift.status === 'cancelled');
  const site = sites.find((s) => s.id === siteId);

  const save = () => {
    if (!canSave) return;
    const data = { date, siteId, start, end, note: note.trim() };
    if (shift) data.status = status ?? undefined;
    const special = customRateOn && customRate !== '' && customRate != null ? Number(customRate) : undefined;
    if (shift || special != null) data.rate = special;
    onSave(data, repeatWeeks);
  };

  const applyFavorite = (fav) => { setSiteId(fav.siteId); setStart(fav.start); setEnd(fav.end); };

  const saveAsFavorite = () => {
    if (!canSave) return;
    onSaveFavorite?.({ siteId, start, end, label: `${site?.name ?? 'Sede'} ${start}–${end}` });
  };

  const confirmCopy = () => {
    if (!copyDate) return;
    const special = customRateOn && customRate !== '' && customRate != null ? { rate: Number(customRate) } : {};
    onCopy?.({ date: copyDate, siteId, start, end, note, ...special });
    setCopyOpen(false);
    setCopyDate('');
  };

  const siteRate = siteRateOn(site, date);
  // tetto di ore al mese per la struttura (scheda della sede): avviso, non blocca
  const monthCap = Number(site?.maxHoursMonth) || 0;
  const monthHoursWithThis = monthCap > 0 && hours > 0 && status !== 'cancelled'
    ? allShifts.filter((x) => x.siteId === site.id && x.id !== shift?.id && x.status !== 'cancelled' && (x.date || '').slice(0, 7) === date.slice(0, 7))
      .reduce((a, x) => a + hoursOfShift(x), 0) + hours
    : 0;
  const rateUsed = customRateOn && customRate !== '' && customRate != null ? Number(customRate) : siteRate;

  let breakdown = null;
  if (site && hours > 0) {
    const rivPct = site.rivalsaPercent != null ? Number(site.rivalsaPercent) : (Number(settings?.rivalsaPercent) || 0);
    const revenue = round2(hours * rateUsed);
    const rivalsa = round2(revenue * (rivPct / 100));
    const t = computeTaxes(revenue, rivalsa, settings);
    breakdown = { revenue, rivPct, rivalsa, invoice: t.invoice, taxPercent: t.taxPercent, taxes: t.taxes, net: t.net, exact: t.taxMode === 'forfettario' };
  }

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{shift ? 'Modifica turno' : 'Nuovo turno'} · {longDate(date)}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {sites.length === 0 ? (
          <p className="hint hint-warn">Aggiungi prima una sede in Altro → Sedi e paghe.</p>
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                <div className="editor-label">Scorciatoie</div>
                <div className="fav-chip-row">
                  {favorites.map((f) => {
                    const fSite = sites.find((s) => s.id === f.siteId);
                    return (
                      <span key={f.id} className="fav-chip" onClick={() => applyFavorite(f)}>
                        {fSite && <SiteAvatar site={fSite} size={16} />}
                        {f.label || `${fSite?.name ?? 'Sede'} ${f.start}–${f.end}`}
                        <button type="button" className="fav-chip-x"
                          onClick={(e) => { e.stopPropagation(); onDeleteFavorite?.(f.id); }}>✕</button>
                      </span>
                    );
                  })}
                </div>
              </>
            )}

            <div className="editor-label">Sede</div>
            <div className="site-picker">
              {sites.map((s) => (
                <button key={s.id} type="button" className={`site-pick-btn ${siteId === s.id ? 'sel' : ''}`}
                  onClick={() => setSiteId(s.id)}>
                  <span className="site-dot" style={{ background: s.color }} />{s.name}
                </button>
              ))}
            </div>

            <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
              <div className="field">
                <label className="field-label">Inizio</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Fine</label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="editor-hours-preview-row">
              <span className="editor-hours-preview">
                {hours > 0 ? `${hours}h di turno` : 'orario non valido'}
                {end < start && hours > 0 ? ' · a cavallo di mezzanotte' : ''}
              </span>
              <button type="button" className="fav-save-btn" onClick={saveAsFavorite} disabled={!canSave}>
                ☆ Salva come scorciatoia
              </button>
            </div>

            {site && (
              <div className="editor-rate-row">
                <span>
                  Tariffa: <b className="mono">€{fmt(rateUsed)}/h</b>{' '}
                  <span className="muted-text">{customRateOn ? '(solo questo turno)' : '(della sede)'}</span>
                </span>
                <button type="button" className="fav-save-btn" onClick={() => setCustomRateOn(!customRateOn)}>
                  {customRateOn ? 'Usa quella della sede' : 'Tariffa diversa per questo turno'}
                </button>
              </div>
            )}
            {customRateOn && (
              <div className="field" style={{ maxWidth: 160, marginTop: 6 }}>
                <label className="field-label">Tariffa di questo turno (€/h)</label>
                <NumberInput value={customRate} onChange={setCustomRate} min={0} max={999} allowEmpty />
              </div>
            )}

            {monthCap > 0 && monthHoursWithThis > monthCap && (
              <p className="hint hint-warn" style={{ marginTop: 10, marginBottom: 0 }}>
                Con questo turno arrivi a {Math.round(monthHoursWithThis * 100) / 100} ore a {site.name} questo mese:
                il massimo nella scheda della struttura è {monthCap}.
              </p>
            )}

            {breakdown && (
              <div className="editor-breakdown">
                <div className="editor-breakdown-row"><span>Compenso</span><span>€{fmt(breakdown.revenue)}</span></div>
                <div className="editor-breakdown-row"><span>{rivalsaLabel(settings)} ({breakdown.rivPct}%)</span><span>€{fmt(breakdown.rivalsa)}</span></div>
                <div className="editor-breakdown-row"><span>Fatturato</span><span>€{fmt(breakdown.invoice)}</span></div>
                <div className="editor-breakdown-row muted"><span>{breakdown.exact ? 'Tasse e contributi' : `Tasse (${breakdown.taxPercent}%)`}</span><span>−€{fmt(breakdown.taxes)}</span></div>
                <div className="editor-breakdown-row total"><span>Netto stimato</span><span>€{fmt(breakdown.net)}</span></div>
              </div>
            )}

            {showStatus && (
              <>
                <div className="editor-label">Com'è andato</div>
                <div className="theme-switch">
                  <button type="button" className={`theme-opt ${status !== 'cancelled' ? 'active' : ''}`} onClick={() => setStatus('done')}>✓ Svolto</button>
                  <button type="button" className={`theme-opt ${status === 'cancelled' ? 'active' : ''}`} onClick={() => setStatus('cancelled')}>✗ Non fatto</button>
                </div>
                {status === 'cancelled' && (
                  <p className="panel-desc" style={{ marginTop: 6, marginBottom: 0 }}>Resta nel calendario barrato ma non conta in ore e guadagni.</p>
                )}
              </>
            )}

            <div className="editor-label">Nota (opzionale)</div>
            <input type="text" value={note} placeholder="es. cambio ultimo minuto"
              onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minWidth: 0 }} />

            {!shift && (
              <>
                <div className="editor-label">Ripeti</div>
                <select value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))}>
                  <option value={0}>Non ripetere</option>
                  <option value={3}>Ogni settimana per 4 settimane</option>
                  <option value={7}>Ogni settimana per 8 settimane</option>
                  <option value={11}>Ogni settimana per 12 settimane</option>
                </select>
              </>
            )}

            {shift && (
              <>
                <div className="editor-label">Copia turno</div>
                {copyOpen ? (
                  <div className="form-row" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
                    <div className="field">
                      <input type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} />
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={confirmCopy} disabled={!copyDate}>Copia</button>
                    <button className="btn btn-sm" onClick={() => setCopyOpen(false)}>Annulla</button>
                  </div>
                ) : (
                  <button className="btn btn-sm" onClick={() => setCopyOpen(true)}>📋 Copia su un altro giorno</button>
                )}
              </>
            )}

            <div className="editor-actions">
              <button className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>Salva</button>
              {shift && <button className="btn btn-danger" onClick={() => onDelete(shift.id)}>Elimina</button>}
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
