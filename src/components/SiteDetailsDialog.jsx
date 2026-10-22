import React, { useState } from 'react';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import NumberInput from './NumberInput.jsx';

const FIELDS = ['company', 'vat', 'contact', 'phone', 'email', 'address', 'paymentDays', 'contractStart', 'contractEnd', 'noticeDays', 'maxHoursMonth', 'notes'];

// Scheda della struttura: dati per fatture e contatti, contratto, tetto di ore, note.
export default function SiteDetailsDialog({ site, onSave, onClose }) {
  const [f, setF] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, site[k] ?? ''])));
  useLockBodyScroll();
  useBackClose(onClose);
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e?.target ? e.target.value : e }));

  const save = () => {
    const patch = {};
    for (const k of FIELDS) {
      const v = typeof f[k] === 'string' ? f[k].trim() : f[k];
      patch[k] = v === '' || v == null ? undefined : v;
    }
    onSave(patch);
  };
  const mapsUrl = f.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}` : null;

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Scheda · {site.name}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="editor-label">Dati per la fattura</div>
        <div className="form-row">
          <div className="field"><label className="field-label">Ragione sociale</label>
            <input type="text" value={f.company} onChange={set('company')} placeholder="es. Villa Rosa S.r.l." /></div>
          <div className="field"><label className="field-label">P.IVA / C.F.</label>
            <input type="text" value={f.vat} onChange={set('vat')} /></div>
        </div>

        <div className="editor-label">Contatti</div>
        <div className="form-row">
          <div className="field"><label className="field-label">Referente</label>
            <input type="text" value={f.contact} onChange={set('contact')} placeholder="es. coord. Bianchi" /></div>
          <div className="field"><label className="field-label">Telefono</label>
            <input type="tel" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label className="field-label">Email</label>
            <input type="email" value={f.email} onChange={set('email')} /></div>
        </div>
        <div className="field" style={{ marginBottom: 6 }}><label className="field-label">Indirizzo</label>
          <input type="text" value={f.address} onChange={set('address')} placeholder="via, città" /></div>
        <div className="site-links">
          {f.phone && <a className="link-btn" href={`tel:${f.phone.replace(/\s+/g, '')}`}>📞 Chiama</a>}
          {f.email && <a className="link-btn" href={`mailto:${f.email}`}>✉️ Scrivi</a>}
          {mapsUrl && <a className="link-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">📍 Apri in Mappe</a>}
        </div>

        <div className="editor-label">Contratto e pagamenti</div>
        <div className="form-row">
          <div className="field"><label className="field-label">Inizio contratto</label>
            <input type="date" value={f.contractStart} onChange={set('contractStart')} /></div>
          <div className="field"><label className="field-label">Fine contratto</label>
            <input type="date" value={f.contractEnd} min={f.contractStart || undefined} onChange={set('contractEnd')} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label className="field-label">Preavviso (giorni)</label>
            <NumberInput value={f.noticeDays} onChange={set('noticeDays')} min={0} max={365} allowEmpty /></div>
          <div className="field"><label className="field-label">Pagano entro (giorni)</label>
            <NumberInput value={f.paymentDays} onChange={set('paymentDays')} min={0} max={365} allowEmpty /></div>
          <div className="field"><label className="field-label">Max ore al mese</label>
            <NumberInput value={f.maxHoursMonth} onChange={set('maxHoursMonth')} min={0} max={744} allowEmpty /></div>
        </div>

        <div className="editor-label">Note</div>
        <textarea rows={3} value={f.notes} onChange={set('notes')} style={{ width: '100%', minWidth: 0 }}
          placeholder="es. parcheggio dietro, badge in portineria" />

        <p className="panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
          Con la fine del contratto e il tetto di ore, Turnio ti avvisa nelle Notifiche (30 giorni prima della scadenza,
          e quando ti avvicini al massimo di ore del mese).
        </p>

        <div className="editor-actions">
          <button className="btn btn-primary btn-block" onClick={save}>Salva</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
