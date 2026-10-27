import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  monthDays, weekdayOf, shiftsOnDay, hoursOfShift, todayISO, holidaysOfYear, isHoliday,
  startOfWeek, endOfWeek, shiftsInRange, addDaysISO, isCancelled, activeShifts,
  countMarks, latestMarkByDate,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT, WEEKDAYS_IT_LONG, DAY_MARK_KINDS, dayMarkKind, hexToRgba } from '../lib/defaults.js';
import {
  addShift, updateShift, removeShift, restoreShift, addFavorite, removeFavorite,
  addOccasionalWork, updateOccasionalWork, removeOccasionalWork,
  addDayMarks, updateDayMark, removeDayMark, restoreOccasionalWork, restoreDayMark,
} from '../lib/store.js';
import { useSwipe } from '../lib/useSwipe.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import ShiftEditor from './ShiftEditor.jsx';
import OccasionalEditor from './OccasionalEditor.jsx';
import CalendarGridView from './charts/CalendarGridView.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import StampBar from './StampBar.jsx';
import MarkEditor from './MarkEditor.jsx';
import AvailabilityDialog from './AvailabilityDialog.jsx';
import WeekDuplicateDialog from './WeekDuplicateDialog.jsx';
import TurniWeek from './TurniWeek.jsx';
import Icon from './icons/Icon.jsx';
import { historyOf } from '../lib/history.js';

const fmt = (n) => n.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VIEW_KEY = 'turnio_view_pref';
const MODE_KEY = 'turnio_turni_mode'; // 'week' | 'month'

const pad2 = (n) => String(n).padStart(2, '0');
// la settimana "appartiene" al mese del suo giovedì (come le settimane ISO)
// (ma la settimana di oggi appartiene al mese di oggi: domenica 1 novembre la settimana dal
// 26 ottobre deve aprire novembre, altrimenti nella vista Mese oggi non si vedrebbe)
const weekMonth = (ws, today = todayISO()) => {
  const ref = startOfWeek(today) === ws ? today : addDaysISO(ws, 3);
  return [Number(ref.slice(0, 4)), Number(ref.slice(5, 7))];
};
// prima settimana di un mese: quella che contiene il suo primo giovedì
const firstWeekOf = (y, m) => {
  const ws = startOfWeek(`${y}-${pad2(m)}-01`);
  const [wy, wm] = weekMonth(ws);
  return wy === y && wm === m ? ws : addDaysISO(ws, 7);
};
const longDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS_IT_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_IT[d.getMonth()].toLowerCase()}`;
};

function DayPopoverOverlay({ dateISO, onClose, children }) {
  useLockBodyScroll();
  useBackClose(onClose);
  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{longDate(dateISO)}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
    </Portal>
  );
}

export default function ShiftsTab({ state, setState, year, month, setYear, setMonth, onNavigate, action, onActionDone, now = new Date() }) {
  const [mode, setModeRaw] = useState(() => { try { return localStorage.getItem(MODE_KEY) || 'week'; } catch { return 'week'; } });
  // settimana mostrata (lunedì): quella di oggi se è aperto il mese corrente, altrimenti la prima del mese
  const [weekStart, setWeekStartRaw] = useState(() => {
    const t = todayISO();
    return Number(t.slice(0, 4)) === year && Number(t.slice(5, 7)) === month ? startOfWeek(t) : firstWeekOf(year, month);
  });
  const [editing, setEditing] = useState(null); // { date, shift: null|obj }
  const [editingOccasional, setEditingOccasional] = useState(null); // { date, entry: null|obj }
  const [editingMark, setEditingMark] = useState(null); // { date, mark: null|obj } — ferie e assenze
  const [dayPopover, setDayPopover] = useState(null); // dateISO (solo vista calendario)
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'list'; } catch { return 'list'; } });
  const [toast, setToast] = useState(false);
  // ultimo elemento eliminato, per "Annulla": { kind: 'shift'|'occasional'|'mark', item }
  const [undoItem, setUndoItem] = useState(null);
  const [filterSite, setFilterSite] = useState(null);
  const undoTimer = useRef(null);
  // modalità timbro: `stamp` è ciò che ogni tocco su un giorno aggiunge (o toglie)
  const [stampOn, setStampOn] = useState(false);
  const [stamp, setStamp] = useState(null);
  const [stampCount, setStampCount] = useState(0);
  // cosa è stato timbrato in questa sessione: solo questo si toglie con un secondo tocco
  const stampAdded = useRef(new Set());
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  // vista da cui è partito il timbro: a "Fine" si torna lì
  const stampFromMode = useRef(null);
  const stopStamp = () => {
    setStampOn(false);
    if (stampFromMode.current) { setModeRaw(stampFromMode.current); stampFromMode.current = null; }
  };
  useBackClose(stopStamp, stampOn);
  // spazio in fondo alla pagina per la barra del timbro (vedi html.stamping in styles.css)
  useEffect(() => {
    document.documentElement.classList.toggle('stamping', stampOn);
    return () => document.documentElement.classList.remove('stamping');
  }, [stampOn]);

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

  // il mese aperto segue la settimana mostrata (serve a timbro, disponibilità, copia settimana e a Soldi)
  const setWeekStart = (ws) => {
    setWeekStartRaw(ws);
    const [wy, wm] = weekMonth(ws);
    if (wy !== year || wm !== month) { setYear(wy); setMonth(wm); }
  };
  const setMode = (m) => {
    if (m === mode) return;
    if (stampOn) { setStampOn(false); stampFromMode.current = null; } // il timbro è solo per la vista Mese
    if (m === 'week') {
      const t = todayISO();
      setWeekStart(Number(t.slice(0, 4)) === year && Number(t.slice(5, 7)) === month ? startOfWeek(t) : firstWeekOf(year, month));
    }
    setModeRaw(m);
    try { localStorage.setItem(MODE_KEY, m); } catch {}
  };

  const days = monthDays(year, month);
  const today = todayISO();
  const holidaySet = useMemo(() => holidaysOfYear(year), [year]);
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);
  // sedi archiviate: restano per i turni passati ma non si propongono per quelli nuovi
  const activeSites = useMemo(() => state.sites.filter((s) => !s.archived), [state.sites]);
  const activeFavorites = useMemo(() => state.favorites.filter((f) => activeSites.some((s) => s.id === f.siteId)), [state.favorites, activeSites]);

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); };
  const swipe = useSwipe(nextMonth, prevMonth);

  const openNew = (dateISO) => { setDayPopover(null); setEditing({ date: dateISO, shift: null }); };
  const openEdit = (dateISO, shift) => { setDayPopover(null); setEditing({ date: dateISO, shift }); };
  const openNewOccasional = (dateISO) => { setDayPopover(null); setEditingOccasional({ date: dateISO, entry: null }); };
  const openEditOccasional = (dateISO, entry) => { setDayPopover(null); setEditingOccasional({ date: dateISO, entry }); };
  const openNewMark = (dateISO) => { setDayPopover(null); setEditingMark({ date: dateISO, mark: null }); };
  const openEditMark = (mark) => { setDayPopover(null); setEditingMark({ date: mark.date, mark }); };
  const dayMarks = state.dayMarks ?? [];

  const flashSaved = () => {
    setToast(true);
    try { navigator.vibrate?.(25); } catch {}
    setTimeout(() => setToast(false), 1400);
  };

  const save = (data, repeatWeeks = 0) => {
    if (editing?.shift) {
      setState((s) => updateShift(s, editing.shift.id, data));
    } else {
      setState((s) => {
        let next = addShift(s, data);
        for (let i = 1; i <= repeatWeeks; i++) {
          next = addShift(next, { ...data, date: addDaysISO(data.date, i * 7) });
        }
        return next;
      });
    }
    setEditing(null);
    flashSaved();
  };

  const copyShiftTo = (data) => {
    setState((s) => addShift(s, data));
    flashSaved();
  };
  const offerUndo = (kind, item) => {
    if (!item) return;
    setUndoItem({ kind, item });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 5000);
  };

  const del = (id) => {
    const shift = state.shifts.find((s) => s.id === id);
    setState((s) => removeShift(s, id));
    setEditing(null);
    offerUndo('shift', shift);
  };

  const undoDelete = () => {
    if (!undoItem) return;
    const { kind, item } = undoItem;
    if (kind === 'shift') setState((s) => restoreShift(s, item));
    else if (kind === 'occasional') setState((s) => restoreOccasionalWork(s, item));
    else if (kind === 'mark') setState((s) => restoreDayMark(s, item));
    setUndoItem(null);
    clearTimeout(undoTimer.current);
  };

  const startStamp = () => {
    const fav = activeFavorites.find((f) => f.siteId === filterSite) ?? activeFavorites[0];
    stampAdded.current = new Set();
    setStamp(fav ? { type: 'shift', siteId: fav.siteId, start: fav.start, end: fav.end } : null);
    setStampCount(0);
    setDayPopover(null);
    if (mode !== 'month') { stampFromMode.current = mode; setModeRaw('month'); } // il timbro si usa sul mese intero
    setStampOn(true);
  };

  // strumento chiesto da fuori (Altro → Strumenti)
  useEffect(() => {
    if (!action) return;
    if (action === 'stamp') { if (activeSites.length > 0) startStamp(); else setModeRaw('month'); }
    else if (action === 'availability') setAvailabilityOpen(true);
    else if (action === 'duplicate') setDupOpen(true);
    onActionDone?.();
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un tocco aggiunge il turno (o il giorno di ferie/assenza) timbrato su quel giorno; un secondo
  // tocco lo toglie, ma solo se è stato timbrato in questa sessione (con "Annulla"): ciò che c'era
  // già (magari con note, tariffa o conferma) non si tocca.
  const applyStamp = (dateISO) => {
    const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };
    if (stamp?.type === 'mark') {
      const key = `${dateISO}|mark|${stamp.kind}`;
      const existingMark = dayMarks.find((m) => m.date === dateISO && m.kind === stamp.kind);
      if (existingMark) {
        if (!stampAdded.current.has(key)) { buzz(30); return; } // già segnato prima: resta
        stampAdded.current.delete(key);
        setState((s) => removeDayMark(s, existingMark.id));
        setStampCount((c) => c - 1);
        offerUndo('mark', existingMark);
      } else {
        stampAdded.current.add(key);
        setState((s) => addDayMarks(s, { kind: stamp.kind, from: dateISO }));
        setStampCount((c) => c + 1);
      }
      buzz();
      return;
    }
    if (!stamp || stamp.type !== 'shift' || stamp.siteId == null || !stamp.start || !stamp.end || stamp.start === stamp.end) return;
    const key = `${dateISO}|${stamp.siteId}|${stamp.start}|${stamp.end}`;
    const existing = state.shifts.find((x) => !isCancelled(x) && x.date === dateISO && x.siteId === stamp.siteId
      && x.start === stamp.start && x.end === stamp.end);
    if (existing) {
      if (!stampAdded.current.has(key)) { buzz(30); return; } // turno che c'era già: resta
      stampAdded.current.delete(key);
      setState((s) => removeShift(s, existing.id));
      setStampCount((c) => c - 1);
      offerUndo('shift', existing);
    } else {
      stampAdded.current.add(key);
      setState((s) => addShift(s, { date: dateISO, siteId: stamp.siteId, start: stamp.start, end: stamp.end, note: '' }));
      setStampCount((c) => c + 1);
    }
    buzz();
  };

  const saveFavorite = (fav) => setState((s) => addFavorite(s, fav));
  const deleteFavorite = (id) => setState((s) => removeFavorite(s, id));

  const saveOccasional = (data) => {
    if (editingOccasional?.entry) {
      setState((s) => updateOccasionalWork(s, editingOccasional.entry.id, data));
    } else {
      setState((s) => addOccasionalWork(s, data));
    }
    setEditingOccasional(null);
    flashSaved();
  };
  const delOccasional = (id) => {
    const entry = state.occasionalWork.find((o) => o.id === id);
    setState((s) => removeOccasionalWork(s, id));
    setEditingOccasional(null);
    offerUndo('occasional', entry);
  };

  const saveMarks = (data) => { setState((s) => addDayMarks(s, data)); setEditingMark(null); flashSaved(); };
  const updateMark = (id, patch) => { setState((s) => updateDayMark(s, id, patch)); setEditingMark(null); flashSaved(); };
  const delMark = (id) => {
    const mark = dayMarks.find((m) => m.id === id);
    setState((s) => removeDayMark(s, id));
    setEditingMark(null);
    offerUndo('mark', mark);
  };

  // copia i turni della settimana scelta (che inizia il lunedì weekStartISO) in quella dopo
  const duplicateWeek = (weekStartISO) => {
    const weekShifts = activeShifts(shiftsInRange(state.shifts, weekStartISO, endOfWeek(weekStartISO)));
    setDupOpen(false);
    if (weekShifts.length === 0) return;
    setState((s) => {
      let next = s;
      for (const sh of weekShifts) {
        const newDate = addDaysISO(sh.date, 7);
        // un turno uguale ma annullato ("non fatto") non impedisce la copia
        const exists = next.shifts.some((x) => !isCancelled(x) && x.date === newDate && x.siteId === sh.siteId && x.start === sh.start && x.end === sh.end);
        if (exists) continue;
        next = addShift(next, { date: newDate, siteId: sh.siteId, start: sh.start, end: sh.end, note: sh.note || '', ...(sh.rate != null ? { rate: sh.rate } : {}) });
      }
      return next;
    });
    flashSaved();
  };

  const monthHasShifts = useMemo(
    () => state.shifts.some((s) => !isCancelled(s) && (s.date || '').startsWith(`${year}-${String(month).padStart(2, '0')}-`)),
    [state.shifts, year, month],
  );

  const { monthTotalHours, monthAccent } = useMemo(() => {
    let h = 0;
    const bySite = new Map();
    for (let d = 1; d <= days; d++) {
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const sh of activeShifts(shiftsOnDay(state.shifts, dateISO))) {
        const sh2 = hoursOfShift(sh);
        h += sh2;
        if (sh.siteId != null) bySite.set(sh.siteId, (bySite.get(sh.siteId) || 0) + sh2);
      }
    }
    let bestId = null, bestH = 0;
    for (const [id, hh] of bySite) if (hh > bestH) { bestH = hh; bestId = id; }
    return {
      monthTotalHours: Math.round(h * 100) / 100,
      monthAccent: bestId != null ? siteById.get(bestId)?.color : null,
    };
  }, [state.shifts, year, month, days, siteById]);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const monthMarksLabel = useMemo(() => {
    const counts = countMarks(dayMarks, monthPrefix);
    return DAY_MARK_KINDS.filter((k) => counts[k.id])
      .map((k) => `${counts[k.id]} ${counts[k.id] === 1 ? 'giorno' : 'giorni'} ${k.label.toLowerCase()}`).join(' · ');
  }, [dayMarks, monthPrefix]);
  // in modalità timbro il filtro per sede si ignora: si vede tutto ciò che si aggiunge
  const shownFilter = stampOn ? null : filterSite;

  const DayShiftsBlock = ({ dateISO }) => {
    const dayShifts = shiftsOnDay(state.shifts, dateISO).filter((sh) => !shownFilter || sh.siteId === shownFilter);
    const dayOccasional = shiftsOnDay(state.occasionalWork, dateISO);
    const marks = shiftsOnDay(dayMarks, dateISO);
    return (
      <div className="day-shifts">
        {marks.map((mk) => {
          const k = dayMarkKind(mk.kind);
          return (
            <div key={`mk-${mk.id}`} className="shift-chip mark-chip"
              style={{ borderLeftColor: k.color, background: hexToRgba(k.color, 0.12) }}
              onClick={() => openEditMark(mk)}>
              <div className="shift-chip-row">
                <span className="occasional-dot">{k.icon}</span>
                <span className="shift-site">{k.label}</span>
              </div>
              {mk.note && <div className="shift-note">📝 {mk.note}</div>}
            </div>
          );
        })}
        {dayShifts.map((sh) => {
          const site = siteById.get(sh.siteId);
          const color = site?.color ?? '#6b7280';
          const cancelled = isCancelled(sh);
          return (
            <div key={sh.id} className={`shift-chip ${cancelled ? 'cancelled' : ''}`} style={{ borderLeftColor: color, background: color + '14' }}
              onClick={() => openEdit(dateISO, sh)}>
              <div className="shift-chip-row">
                <SiteAvatar site={site} size={18} />
                <span className="shift-site">{site?.name ?? 'Sede eliminata'}</span>
                <span className="shift-time">{sh.start}–{sh.end}</span>
                {cancelled ? <span className="shift-cancel-tag">non fatto</span> : <span className="shift-hours">{hoursOfShift(sh)}h</span>}
              </div>
              {sh.note && <div className="shift-note">📝 {sh.note}</div>}
            </div>
          );
        })}
        {dayOccasional.map((o) => (
          <div key={`occ-${o.id}`} className="shift-chip occasional-chip"
            onClick={() => openEditOccasional(dateISO, o)}>
            <div className="shift-chip-row">
              <span className="occasional-dot">💼</span>
              <span className="shift-site">{o.description}</span>
              <span className="shift-hours">€{fmt(o.grossAmount)}</span>
            </div>
            {o.note && <div className="shift-note">📝 {o.note}</div>}
          </div>
        ))}
        <div className="day-add-row">
          <button className="day-add-btn" onClick={() => openNew(dateISO)} disabled={activeSites.length === 0}>
            + turno
          </button>
          <button className="day-add-btn" onClick={() => openNewOccasional(dateISO)}>
            + prestazione
          </button>
          <button className="day-add-btn" onClick={() => openNewMark(dateISO)}>
            + ferie/assenza
          </button>
        </div>
      </div>
    );
  };

  const noSitesHint = activeSites.length === 0 && (
    <div className="hint hint-warn" style={{ marginTop: 12 }}>
      Prima di registrare i turni, aggiungi almeno una sede di lavoro con la sua paga oraria.
      {onNavigate && (
        <div><button className="link-btn" style={{ marginTop: 8 }} onClick={() => onNavigate('altro', 'sites')}>
          Aggiungi una sede in Altro → Sedi e paghe →
        </button></div>
      )}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Turni</h1>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'week'} className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>Settimana</button>
          <button type="button" role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Mese</button>
        </div>
      </div>

      {mode === 'week' && (
        <>
          {noSitesHint}
          <TurniWeek state={state} weekStart={weekStart} setWeekStart={setWeekStart} today={today} now={now}
            onOpenDay={(d) => setDayPopover(d)} onEditShift={openEdit} onEditOccasional={openEditOccasional} onEditMark={openEditMark} />
          <div className="grp-title">Strumenti</div>
          <div className="tools3">
            <button type="button" className="tool3" onClick={startStamp} disabled={activeSites.length === 0}>
              <Icon name="stamp" size={26} />Segna più giorni
            </button>
            <button type="button" className="tool3" onClick={() => setAvailabilityOpen(true)}>
              <Icon name="send" size={26} />Invia giorni liberi
            </button>
            <button type="button" className="tool3" onClick={() => setDupOpen(true)}>
              <Icon name="copy" size={26} />Copia la settimana
            </button>
          </div>
        </>
      )}

      {mode === 'month' && (<>
      <div className="panel" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd} style={monthAccent ? {
        borderTopColor: monthAccent, borderTopWidth: 3,
        background: `linear-gradient(160deg, ${hexToRgba(monthAccent, 0.10)}, var(--glass))`,
      } : undefined}>
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <div key={`${year}-${month}`} className="month-slide">
            <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
            <span className="month-sub">{monthTotalHours}h totali questo mese{monthMarksLabel ? ` · ${monthMarksLabel}` : ''}</span>
          </div>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>

        <div className="view-row">
          <div className="view-row-left">
            <button className="btn btn-sm" onClick={goToday}>Vai a oggi</button>
            {activeSites.length > 0 && (
              <button className={`btn btn-sm ${stampOn ? 'btn-primary' : ''}`} onClick={() => (stampOn ? stopStamp() : startStamp())}
                title="Riempi il mese toccando i giorni">
                ✋ Timbro
              </button>
            )}
            <button className="btn btn-sm" onClick={() => setAvailabilityOpen(true)} title="Messaggio con i giorni liberi da mandare alle strutture">
              📤 Disponibilità
            </button>
          </div>
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ Lista</button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦ Calendario</button>
          </div>
        </div>

        {monthHasShifts && (
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setDupOpen(true)}>
            📋 Duplica una settimana → la successiva
          </button>
        )}

        {activeSites.length > 1 && !stampOn && (
          <div className="filter-row">
            <button className={`filter-chip ${filterSite == null ? 'active' : ''}`} onClick={() => setFilterSite(null)}>
              Tutte le sedi
            </button>
            {activeSites.map((s) => (
              <button key={s.id} className={`filter-chip ${filterSite === s.id ? 'active' : ''}`}
                onClick={() => setFilterSite(filterSite === s.id ? null : s.id)}>
                <span className="site-dot" style={{ background: s.color }} />{s.name}
              </button>
            ))}
          </div>
        )}

        {noSitesHint}
      </div>

      {view === 'list' ? (
        <div className={`panel ${stampOn ? 'stamping' : ''}`} style={{ padding: 0 }}>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const wd = weekdayOf(year, month, d);
            const holiday = isHoliday(year, month, d, holidaySet);
            const isWeekend = wd >= 5 || holiday;
            const isToday = dateISO === today;
            return (
              <div key={d} className={`day-row ${isWeekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${stampOn ? 'stamp-target' : ''}`}
                style={{ padding: '10px 14px', ...(isToday ? { background: 'rgba(56,189,248,0.10)' } : {}) }}
                onClick={stampOn ? () => applyStamp(dateISO) : undefined}>
                <div className="day-num">
                  <b style={isToday ? { color: 'var(--accent)' } : undefined}>{d}</b>
                  <span style={holiday ? { color: 'var(--red)' } : undefined}>{holiday ? '★' : WEEKDAYS_IT[wd]}</span>
                </div>
                <DayShiftsBlock dateISO={dateISO} />
              </div>
            );
          })}
        </div>
      ) : (
        <CalendarGridView year={year} month={month}
          shifts={shownFilter ? state.shifts.filter((sh) => sh.siteId === shownFilter) : state.shifts}
          occasionalWork={state.occasionalWork} latestMarks={latestMarkByDate(dayMarks)}
          siteById={siteById} holidaySet={holidaySet} today={today} stamping={stampOn}
          onDayClick={(dateISO) => (stampOn ? applyStamp(dateISO) : setDayPopover(dateISO))} />
      )}

      </>)}

      {dayPopover && (
        <DayPopoverOverlay dateISO={dayPopover} onClose={() => setDayPopover(null)}>
          <DayShiftsBlock dateISO={dayPopover} />
        </DayPopoverOverlay>
      )}

      {editing && (
        <ShiftEditor date={editing.date} shift={editing.shift} settings={state.settings}
          sites={state.sites.filter((s) => !s.archived || s.id === editing.shift?.siteId)}
          favorites={activeFavorites} lastSiteId={activeSites.some((s) => s.id === state.lastSiteId) ? state.lastSiteId : null}
          allShifts={state.shifts} history={editing.shift ? historyOf(state, 'shifts', editing.shift.id) : []}
          onSave={save} onDelete={del} onClose={() => setEditing(null)} onCopy={copyShiftTo}
          onSaveFavorite={saveFavorite} onDeleteFavorite={deleteFavorite} />
      )}

      {editingOccasional && (
        <OccasionalEditor date={editingOccasional.date} entry={editingOccasional.entry} settings={state.settings}
          occasionalWork={state.occasionalWork}
          onSave={saveOccasional} onDelete={delOccasional} onClose={() => setEditingOccasional(null)} />
      )}

      {stampOn && (
        <StampBar sites={activeSites} favorites={activeFavorites} markKinds={DAY_MARK_KINDS} stamp={stamp} setStamp={setStamp}
          count={stampCount} onDone={stopStamp} />
      )}

      {dupOpen && (
        <WeekDuplicateDialog shifts={state.shifts} year={year} month={month} today={today}
          initialWeek={mode === 'week' ? weekStart : undefined}
          onConfirm={duplicateWeek} onClose={() => setDupOpen(false)} />
      )}

      {availabilityOpen && (
        <AvailabilityDialog state={state} year={year} month={month} onClose={() => setAvailabilityOpen(false)} />
      )}

      {editingMark && (
        <MarkEditor date={editingMark.date} mark={editingMark.mark}
          onSave={saveMarks} onUpdate={updateMark} onDelete={delMark} onClose={() => setEditingMark(null)} />
      )}

      {toast && <Portal><div className="save-toast">✓ Salvato</div></Portal>}

      {undoItem && (
        <Portal>
        <div className="undo-toast">
          <span>{undoItem.kind === 'shift' ? 'Turno eliminato' : undoItem.kind === 'occasional' ? 'Prestazione eliminata' : 'Giorno segnato eliminato'}</span>
          <button className="undo-btn" onClick={undoDelete}>Annulla</button>
        </div>
        </Portal>
      )}
    </>
  );
}
