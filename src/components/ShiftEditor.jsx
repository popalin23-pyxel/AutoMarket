import React, { useState } from 'react';
import { hoursOfShift } from '../lib/calc.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import Portal from '../lib/Portal.jsx';
import SiteAvatar from './SiteAvatar.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function ShiftEditor({
  date, shift, sites, favorites = [], lastSiteId, settings,
  onSave, onDelete, onClose, onSaveFavorite, onDeleteFavorite, onCopy,
}) {
  const [siteId, setSiteId] = useState(shift?.siteId ?? lastSiteId ?? sites[0]?.id ?? null);
  const [start, setStart] = useState(shift?.start ?? '07:00');
  const [end, setEnd] = useState(shift?.end ?? '14:00');
  const [note, setNote] = useState(shift?.note ?? '');
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [copyOpen, setCopyOpen] = useState(false);
  useLockBodyScroll();
  const [copyDate, setCopyDate] = useState('');

  const hours = hoursOfShift({ start, end });
  const canSave = siteId != null && start && end;
  const site = sites.find((s) => s.id === siteId);

  const save = () => {
    if (!canSave) return;
    onSave({ date, siteId, start, end, note: note.trim() }, repeatWeeks);
  };

  const applyFavorite = (fav) => { setSiteId(fav.siteId); setStart(fav.start); setEnd(fav.end); };

  const saveAsFavorite = () => {
    if (!canSave) return;
    onSaveFavorite?.({ siteId, start, end, label: `${site?.name ?? 'Sede'} ${start}–${end}` });
  };

  const confirmCopy = () => {
    if (!copyDate) return;
    onCopy?.({ date: copyDate, siteId, start, end, note });
    setCopyOpen(false);
    setCopyDate('');
  };

  let breakdown = null;
  if (site && hours > 0) {
    const rivPct = site.rivalsaPercent != null ? Number(site.rivalsaPercent) : (Number(settings?.rivalsaPercent) || 0);
    const revenue = round2(hours * site.rate);
    const rivalsa = round2(revenue * (rivPct / 100));
    const invoice = round2(revenue + rivalsa);
    const taxPercent = Number(settings?.taxPercent) || 0;
    const taxes = round2(invoice * (taxPercent / 100));
    const net = round2(invoice - taxes);
    breakdown = { revenue, rivPct, rivalsa, invoice, taxPercent, taxes, net };
  }

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{shift ? 'Modifica turno' : 'Nuovo turno'} · {date}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {sites.length === 0 ? (
          <p className="hint hint-warn">Aggiungi prima una sede nella scheda "Sedi".</p>
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

            {breakdown && (
              <div className="editor-breakdown">
                <div className="editor-breakdown-row"><span>Compenso</span><span>€{fmt(breakdown.revenue)}</span></div>
                <div className="editor-breakdown-row"><span>Rivalsa ({breakdown.rivPct}%)</span><span>€{fmt(breakdown.rivalsa)}</span></div>
                <div className="editor-breakdown-row"><span>Fatturato</span><span>€{fmt(breakdown.invoice)}</span></div>
                <div className="editor-breakdown-row muted"><span>Tasse ({breakdown.taxPercent}%)</span><span>−€{fmt(breakdown.taxes)}</span></div>
                <div className="editor-breakdown-row total"><span>Netto stimato</span><span>€{fmt(breakdown.net)}</span></div>
              </div>
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
