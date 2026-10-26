import React, { useState } from 'react';
import { todayISO } from '../lib/calc.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import NumberInput from './NumberInput.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const OCCASIONAL_THRESHOLD = 5000;

// Prestazione occasionale: reddito diverso dal lavoro nelle sedi (redditi
// diversi ex art. 67 TUIR). Niente sede/orario, importo libero, tassato a
// parte — vedi disclaimer nel modulo e in Impostazioni fiscali.
export default function OccasionalEditor({ date, entry, settings, occasionalWork = [], onSave, onDelete, onClose }) {
  const [description, setDescription] = useState(entry?.description ?? '');
  const [entryDate, setEntryDate] = useState(entry?.date ?? date ?? todayISO());
  const [amount, setAmount] = useState(entry?.grossAmount ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  useLockBodyScroll();
  useBackClose(onClose);

  const gross = Number(amount) || 0;
  const taxPercent = Number(settings?.occasionalTaxRatePercent) || 0;
  const taxes = round2(gross * (taxPercent / 100));
  const net = round2(gross - taxes);

  const entryYear = (entryDate || '').slice(0, 4);
  const otherYearGross = occasionalWork
    .filter((o) => o.id !== entry?.id && (o.date || '').slice(0, 4) === entryYear)
    .reduce((a, o) => a + (Number(o.grossAmount) || 0), 0);
  const yearTotalWithThis = round2(otherYearGross + gross);
  const overThreshold = gross > 0 && yearTotalWithThis > OCCASIONAL_THRESHOLD;

  const canSave = description.trim() && gross > 0 && entryDate;

  const save = () => {
    if (!canSave) return;
    onSave({ date: entryDate, description: description.trim(), grossAmount: gross, note: note.trim() });
  };

  return (
    <Portal>
      <div className="editor-overlay" onClick={onClose}>
        <div className="editor-card" onClick={(e) => e.stopPropagation()}>
          <div className="editor-head">
            <span>{entry ? 'Modifica prestazione' : 'Nuova prestazione occasionale'}</span>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>

          <div className="editor-label">Descrizione</div>
          <input type="text" value={description} placeholder="es. Consulenza infermieristica privata"
            onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', minWidth: 0 }} />

          <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="field">
              <label className="field-label">Data</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Importo lordo (€)</label>
              <NumberInput value={amount} onChange={setAmount} min={0} max={99999} allowEmpty />
            </div>
          </div>

          {gross > 0 && (
            <div className="editor-breakdown">
              <div className="editor-breakdown-row"><span>Lordo</span><span>€{fmt(gross)}</span></div>
              <div className="editor-breakdown-row muted"><span>Accantonamento stimato ({taxPercent}%)</span><span>−€{fmt(taxes)}</span></div>
              <div className="editor-breakdown-row total"><span>Netto stimato</span><span>€{fmt(net)}</span></div>
            </div>
          )}

          <p className="hint" style={{ marginTop: 10 }}>
            Le prestazioni occasionali non hanno rivalsa e si tassano a parte dal tuo regime forfettario
            (aliquota IRPEF a scaglioni, non quella forfettaria) — l'accantonamento qui sopra è solo una stima,
            verifica l'aliquota giusta col commercialista in base al tuo reddito complessivo.
          </p>

          {overThreshold && (
            <div className="hint hint-warn" style={{ marginTop: 10 }}>
              ⚠️ Con questa prestazione superi €{fmt(yearTotalWithThis)} di prestazioni occasionali nel {entryYear}{' '}
              (soglia €{fmt(OCCASIONAL_THRESHOLD)}): oltre questa soglia potrebbe essere dovuto il contributo INPS
              Gestione Separata. Parlane col commercialista.
            </div>
          )}

          <div className="editor-label">Nota (opzionale)</div>
          <input type="text" value={note} placeholder="es. fattura emessa, ritenuta d'acconto applicata"
            onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minWidth: 0 }} />

          <div className="editor-actions">
            <button className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>Salva</button>
            {entry && <button className="btn btn-danger" onClick={() => onDelete(entry.id)}>Elimina</button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
