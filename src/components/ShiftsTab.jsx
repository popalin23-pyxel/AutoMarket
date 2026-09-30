import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  monthDays, weekdayOf, shiftsOnDay, hoursOfShift, todayISO, holidaysOfYear, isHoliday,
  startOfWeek, endOfWeek, shiftsInRange, addDaysISO, computeWeekSummary,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT, hexToRgba } from '../lib/defaults.js';
import { addShift, updateShift, removeShift, restoreShift, addFavorite, removeFavorite } from '../lib/store.js';
import { useSwipe } from '../lib/useSwipe.js';
import { useConfirm } from '../lib/ConfirmContext.jsx';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import ShiftEditor from './ShiftEditor.jsx';
import CalendarGridView from './charts/CalendarGridView.jsx';
import SiteAvatar from './SiteAvatar.jsx';

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VIEW_KEY = 'turnio_view_pref';

function DayPopoverOverlay({ dateISO, onClose, children }) {
  useLockBodyScroll();
  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>{dateISO}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ShiftsTab({ state, setState, year, month, setYear, setMonth }) {
  const [editing, setEditing] = useState(null); // { date, shift: null|obj }
  const [dayPopover, setDayPopover] = useState(null); // dateISO (solo vista calendario)
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'list'; } catch { return 'list'; } });
  const [toast, setToast] = useState(false);
  const [undoShift, setUndoShift] = useState(null);
  const [filterSite, setFilterSite] = useState(null);
  const undoTimer = useRef(null);
  const confirmAction = useConfirm();

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

  const days = monthDays(year, month);
  const today = todayISO();
  const holidaySet = useMemo(() => holidaysOfYear(year), [year]);
  const siteById = useMemo(() => new Map(state.sites.map((s) => [s.id, s])), [state.sites]);

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); };
  const swipe = useSwipe(nextMonth, prevMonth);

  const openNew = (dateISO) => { setDayPopover(null); setEditing({ date: dateISO, shift: null }); };
  const openEdit = (dateISO, shift) => { setDayPopover(null); setEditing({ date: dateISO, shift }); };

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
  const del = (id) => {
    const shift = state.shifts.find((s) => s.id === id);
    setState((s) => removeShift(s, id));
    setEditing(null);
    if (shift) {
      setUndoShift(shift);
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoShift(null), 5000);
    }
  };

  const undoDelete = () => {
    if (!undoShift) return;
    setState((s) => restoreShift(s, undoShift));
    setUndoShift(null);
    clearTimeout(undoTimer.current);
  };

  const saveFavorite = (fav) => setState((s) => addFavorite(s, fav));
  const deleteFavorite = (id) => setState((s) => removeFavorite(s, id));

  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const weekSummary = useMemo(
    () => computeWeekSummary(state.shifts, state.sites, state.settings, today),
    [state.shifts, state.sites, state.settings, today],
  );
  const thisWeekShifts = useMemo(() => shiftsInRange(state.shifts, weekStart, weekEnd), [state.shifts, weekStart, weekEnd]);
  const weekLabel = useMemo(() => {
    const wsD = Number(weekStart.slice(8)), wsM = Number(weekStart.slice(5, 7));
    const weD = Number(weekEnd.slice(8)), weM = Number(weekEnd.slice(5, 7));
    return wsM === weM
      ? `${wsD}–${weD} ${MONTHS_IT[weM - 1].slice(0, 3)}`
      : `${wsD} ${MONTHS_IT[wsM - 1].slice(0, 3)} – ${weD} ${MONTHS_IT[weM - 1].slice(0, 3)}`;
  }, [weekStart, weekEnd]);

  const duplicateWeek = async () => {
    if (thisWeekShifts.length === 0) return;
    const ok = await confirmAction(
      `Copieremo ${thisWeekShifts.length} turni di questa settimana nella settimana prossima (stessi giorni, sede e orario). I turni già presenti non vengono duplicati.`,
      { title: 'Duplicare questa settimana', confirmLabel: 'Duplica' },
    );
    if (!ok) return;
    setState((s) => {
      let next = s;
      for (const sh of thisWeekShifts) {
        const newDate = addDaysISO(sh.date, 7);
        const exists = next.shifts.some((x) => x.date === newDate && x.siteId === sh.siteId && x.start === sh.start && x.end === sh.end);
        if (exists) continue;
        next = addShift(next, { date: newDate, siteId: sh.siteId, start: sh.start, end: sh.end, note: sh.note || '' });
      }
      return next;
    });
    flashSaved();
  };

  const { monthTotalHours, monthAccent } = useMemo(() => {
    let h = 0;
    const bySite = new Map();
    for (let d = 1; d <= days; d++) {
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const sh of shiftsOnDay(state.shifts, dateISO)) {
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

  const DayShiftsBlock = ({ dateISO }) => {
    const dayShifts = shiftsOnDay(state.shifts, dateISO).filter((sh) => !filterSite || sh.siteId === filterSite);
    return (
      <div className="day-shifts">
        {dayShifts.map((sh) => {
          const site = siteById.get(sh.siteId);
          const color = site?.color ?? '#6b7280';
          return (
            <div key={sh.id} className="shift-chip" style={{ borderLeftColor: color, background: color + '14' }}
              onClick={() => openEdit(dateISO, sh)}>
              <SiteAvatar site={site} size={18} />
              <span className="shift-site">{site?.name ?? 'Sede eliminata'}</span>
              <span className="shift-time">{sh.start}–{sh.end}</span>
              <span className="shift-hours">{hoursOfShift(sh)}h</span>
            </div>
          );
        })}
        <button className="day-add-btn" onClick={() => openNew(dateISO)} disabled={state.sites.length === 0}>
          + turno
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="panel" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd} style={monthAccent ? {
        borderTopColor: monthAccent, borderTopWidth: 3,
        background: `linear-gradient(160deg, ${hexToRgba(monthAccent, 0.10)}, var(--glass))`,
      } : undefined}>
        <div className="month-nav">
          <button className="btn" onClick={prevMonth}>‹</button>
          <div key={`${year}-${month}`} className="month-slide">
            <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
            <span className="month-sub">{monthTotalHours}h totali questo mese</span>
          </div>
          <button className="btn" onClick={nextMonth}>›</button>
        </div>

        <div className="view-row">
          <button className="btn btn-sm" onClick={goToday}>Vai a oggi</button>
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ Lista</button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦ Calendario</button>
          </div>
        </div>

        {thisWeekShifts.length > 0 && (
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={duplicateWeek}>
            📋 Duplica questa settimana → prossima
          </button>
        )}

        {state.sites.length > 1 && (
          <div className="filter-row">
            <button className={`filter-chip ${filterSite == null ? 'active' : ''}`} onClick={() => setFilterSite(null)}>
              Tutte le sedi
            </button>
            {state.sites.map((s) => (
              <button key={s.id} className={`filter-chip ${filterSite === s.id ? 'active' : ''}`}
                onClick={() => setFilterSite(filterSite === s.id ? null : s.id)}>
                <span className="site-dot" style={{ background: s.color }} />{s.name}
              </button>
            ))}
          </div>
        )}

        {state.sites.length === 0 && (
          <div className="hint hint-warn" style={{ marginTop: 12 }}>
            Prima di registrare i turni, aggiungi almeno una sede nella scheda "Sedi".
          </div>
        )}
      </div>

      {view === 'list' ? (
        <div className="panel" style={{ padding: 0 }}>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const wd = weekdayOf(year, month, d);
            const holiday = isHoliday(year, month, d, holidaySet);
            const isWeekend = wd >= 5 || holiday;
            const isToday = dateISO === today;
            return (
              <div key={d} className={`day-row ${isWeekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`}
                style={{ padding: '10px 14px', ...(isToday ? { background: 'rgba(56,189,248,0.10)' } : {}) }}>
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
          shifts={filterSite ? state.shifts.filter((sh) => sh.siteId === filterSite) : state.shifts}
          siteById={siteById} holidaySet={holidaySet} today={today} onDayClick={(dateISO) => setDayPopover(dateISO)} />
      )}

      {thisWeekShifts.length > 0 && (
        <div className="panel week-total-card">
          <span className="week-total-label">Questa settimana ({weekLabel})</span>
          <div className="week-total-row">
            <span><b>{fmt(weekSummary.totalHours)}h</b> lavorate</span>
            <span>€<b>{fmt(weekSummary.net)}</b> netto stimato</span>
          </div>
        </div>
      )}

      {dayPopover && (
        <DayPopoverOverlay dateISO={dayPopover} onClose={() => setDayPopover(null)}>
          <DayShiftsBlock dateISO={dayPopover} />
        </DayPopoverOverlay>
      )}

      {editing && (
        <ShiftEditor date={editing.date} shift={editing.shift} sites={state.sites} settings={state.settings}
          favorites={state.favorites} lastSiteId={state.lastSiteId}
          onSave={save} onDelete={del} onClose={() => setEditing(null)} onCopy={copyShiftTo}
          onSaveFavorite={saveFavorite} onDeleteFavorite={deleteFavorite} />
      )}

      {toast && <div className="save-toast">✓ Turno salvato</div>}

      {undoShift && (
        <div className="undo-toast">
          <span>Turno eliminato</span>
          <button className="undo-btn" onClick={undoDelete}>Annulla</button>
        </div>
      )}
    </>
  );
}
