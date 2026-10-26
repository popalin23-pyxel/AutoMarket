import React, { useMemo, useState } from 'react';
import { todayISO, hoursOfShift, siteRateOn, computeTaxes, addDaysISO } from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import { addShift, addFavorite, removeFavorite, addOccasionalWork, addDayMarks } from '../lib/store.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import Icon from './icons/Icon.jsx';
import ShiftEditor from './ShiftEditor.jsx';
import OccasionalEditor from './OccasionalEditor.jsx';
import MarkEditor from './MarkEditor.jsx';

const fmt0 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 });
const fmt1 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 1 });

function longDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS_IT_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()}`;
}

// nome dell'orario dalla sua ora di inizio
function slotOf(start) {
  const h = Number((start || '0').split(':')[0]);
  if (h >= 5 && h < 12) return { name: 'Mattina', icon: 'sun', cls: 'mat' };
  if (h >= 12 && h < 18) return { name: 'Pomeriggio', icon: 'sunset', cls: 'pom' };
  return { name: 'Notte', icon: 'moon', cls: 'not' };
}
const shortTime = (t) => (t.endsWith(':00') ? t.slice(0, 2) : t);

function SheetBody({ state, setState, onClose, onSaved, onGoSites, onOpenEditor }) {
  const today = todayISO();
  const sites = useMemo(() => state.sites.filter((s) => !s.archived), [state.sites]);
  const [kind, setKind] = useState('shift');
  const [date, setDate] = useState(today);
  const [siteId, setSiteId] = useState(() => (sites.some((s) => s.id === state.lastSiteId) ? state.lastSiteId : sites[0]?.id ?? null));
  const favs = useMemo(
    () => state.favorites.filter((f) => f.siteId === siteId).sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [state.favorites, siteId],
  );
  const [slot, setSlot] = useState(null); // { start, end } scelto tra le scorciatoie
  const [custom, setCustom] = useState(false); // orario a mano
  const [start, setStart] = useState('07:00');
  const [end, setEnd] = useState('14:00');
  const site = sites.find((s) => s.id === siteId);

  // senza scorciatoie per la sede si scrive l'orario a mano
  const manual = custom || favs.length === 0;
  const time = manual ? { start, end } : slot;
  const hours = time ? hoursOfShift({ date, ...time }) : 0;
  const canSave = !!site && !!time && !!date && hours > 0;

  let net = null;
  if (canSave) {
    const revenue = hours * siteRateOn(site, date);
    const rivPct = site.rivalsaPercent != null ? Number(site.rivalsaPercent) : (Number(state.settings.rivalsaPercent) || 0);
    net = computeTaxes(revenue, revenue * (rivPct / 100), state.settings).net;
  }

  const pickSite = (id) => { setSiteId(id); setSlot(null); };
  const pickKind = (k) => {
    if (k === 'shift') { setKind(k); return; }
    onOpenEditor(k, date || today); // prestazione e ferie hanno già la loro scheda completa
  };
  const save = () => {
    if (!canSave) return;
    setState((s) => addShift(s, { date, siteId, start: time.start, end: time.end, note: '' }));
    onSaved();
    onClose();
  };

  return (
    <>
      <div className="kinds">
        <button type="button" className={`kind ${kind === 'shift' ? 'on' : ''}`} onClick={() => pickKind('shift')}>
          {kind === 'shift' && <span className="kind-tick"><Icon name="check" size={13} strokeWidth={3} /></span>}
          <Icon name="clock" size={26} /><b>Turno</b><small>in struttura</small>
        </button>
        <button type="button" className="kind" onClick={() => pickKind('occasional')}>
          <Icon name="briefcase" size={26} /><b>Prestazione</b><small>occasionale</small>
        </button>
        <button type="button" className="kind" onClick={() => pickKind('mark')}>
          <Icon name="umbrella" size={26} /><b>Ferie</b><small>o assenza</small>
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="hint hint-warn" style={{ marginTop: 14 }}>
          Per aggiungere un turno serve almeno una sede con la sua paga oraria.
          <div><button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={onGoSites}>Aggiungi una sede →</button></div>
        </div>
      ) : (
        <>
          <div className="sheet-step"><span className="sheet-sn">1</span>Quando</div>
          <label className="sheet-when">
            <Icon name="calendar" size={20} />
            <span className="sheet-when-t">{date ? longDate(date) : 'Scegli il giorno'}</span>
            <span className="sheet-when-c">Cambia</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Giorno del turno"
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }} />
          </label>
          <div className="sheet-quick">
            <button type="button" className={date === today ? 'on' : ''} onClick={() => setDate(today)}>Oggi</button>
            <button type="button" className={date === addDaysISO(today, 1) ? 'on' : ''} onClick={() => setDate(addDaysISO(today, 1))}>Domani</button>
          </div>

          <div className="sheet-step"><span className="sheet-sn">2</span>Dove</div>
          <div className="sheet-sites">
            {sites.map((s) => (
              <button key={s.id} type="button" className={`sheet-site ${siteId === s.id ? 'on' : ''}`} onClick={() => pickSite(s.id)}>
                <span className="site-dot" style={{ background: s.color }} />{s.name}
                {siteId === s.id && <Icon name="check" size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>

          <div className="sheet-step"><span className="sheet-sn">3</span>Che orario</div>
          {favs.length > 0 && (
            <div className="sheet-slots">
              {favs.map((f) => {
                const sl = slotOf(f.start);
                const on = !custom && slot?.start === f.start && slot?.end === f.end;
                return (
                  <button key={f.id} type="button" className={`sheet-slot ${on ? 'on' : ''}`}
                    onClick={() => { setCustom(false); setSlot({ start: f.start, end: f.end }); }}>
                    {on && <span className="kind-tick"><Icon name="check" size={13} strokeWidth={3} /></span>}
                    <span className={`sheet-slot-ic ${sl.cls}`}><Icon name={sl.icon} size={18} /></span>
                    <b>{sl.name}</b><span className="mono">{shortTime(f.start)}–{shortTime(f.end)}</span>
                  </button>
                );
              })}
              <button type="button" className={`sheet-slot ${custom ? 'on' : ''}`} onClick={() => { setCustom(true); setSlot(null); }}>
                {custom && <span className="kind-tick"><Icon name="check" size={13} strokeWidth={3} /></span>}
                <span className="sheet-slot-ic oth"><Icon name="clock" size={18} /></span>
                <b>Altro</b><span>orario</span>
              </button>
            </div>
          )}
          {manual && (
            <div className="form-row" style={{ marginTop: favs.length ? 10 : 0, marginBottom: 0 }}>
              <div className="field">
                <label className="field-label">Inizio</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Fine</label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          <button type="button" className="lrow sheet-more" disabled={!date}
            onClick={() => onOpenEditor('shift', date, { siteId, start: time?.start ?? start, end: time?.end ?? end })}>
            <span className="lrow-ic ic-sla"><Icon name="sliders" size={19} /></span>
            <span className="lrow-tx">
              <span className="lrow-t" style={{ display: 'block' }}>Altre opzioni</span>
              <span className="lrow-s" style={{ display: 'block' }}>Nota · paga diversa · ripeti ogni settimana</span>
            </span>
            <span className="lrow-end"><Icon name="chevronRight" size={19} /></span>
          </button>

          <div className="sheet-sum">
            {canSave
              ? <><b><span className="mono">{fmt1(hours)}</span> ore</b> · ti restano circa <b className="g mono">€{fmt0(net)}</b></>
              : !date ? 'Scegli il giorno' : time ? 'Orario non valido' : 'Scegli l’orario'}
          </div>
          <button type="button" className="btn btn-primary btn-block sheet-save" onClick={save} disabled={!canSave}>
            <Icon name="check" size={20} strokeWidth={2.6} /> Salva il turno
          </button>
        </>
      )}
    </>
  );
}

// "+ Aggiungi" dalla barra in basso: turno in tre passi (quando, dove, che orario);
// prestazione e ferie aprono le loro schede.
export default function AddSheet({ state, setState, onClose, onSaved, onGoSites }) {
  const [editor, setEditor] = useState(null); // { kind, date, initial }
  useLockBodyScroll();
  useBackClose(onClose);
  const sites = state.sites.filter((s) => !s.archived);
  const activeFavorites = state.favorites.filter((f) => sites.some((s) => s.id === f.siteId));
  const done = () => { onSaved(); onClose(); };

  if (editor?.kind === 'shift') {
    return (
      <ShiftEditor date={editor.date} shift={null} settings={state.settings} sites={sites}
        favorites={activeFavorites} lastSiteId={state.lastSiteId} allShifts={state.shifts} initial={editor.initial}
        onSave={(data, repeatWeeks = 0) => {
          setState((s) => {
            let next = addShift(s, data);
            for (let i = 1; i <= repeatWeeks; i++) next = addShift(next, { ...data, date: addDaysISO(data.date, i * 7) });
            return next;
          });
          done();
        }}
        onCopy={(data) => { setState((s) => addShift(s, data)); onSaved(); }}
        onSaveFavorite={(fav) => setState((s) => addFavorite(s, fav))}
        onDeleteFavorite={(id) => setState((s) => removeFavorite(s, id))}
        onClose={onClose} />
    );
  }
  if (editor?.kind === 'occasional') {
    return (
      <OccasionalEditor date={editor.date} entry={null} settings={state.settings} occasionalWork={state.occasionalWork}
        onSave={(data) => { setState((s) => addOccasionalWork(s, data)); done(); }} onClose={onClose} />
    );
  }
  if (editor?.kind === 'mark') {
    return (
      <MarkEditor date={editor.date} mark={null}
        onSave={(data) => { setState((s) => addDayMarks(s, data)); done(); }} onClose={onClose} />
    );
  }

  return (
    <Portal>
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet" role="dialog" aria-label="Cosa vuoi aggiungere?" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-head">
            <h2>Cosa vuoi aggiungere?</h2>
            <button type="button" className="round-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" size={20} /></button>
          </div>
          <SheetBody state={state} setState={setState} onClose={onClose} onSaved={onSaved} onGoSites={onGoSites}
            onOpenEditor={(kind, date, initial) => setEditor({ kind, date, initial })} />
        </div>
      </div>
    </Portal>
  );
}
