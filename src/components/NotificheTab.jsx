import React from 'react';
import {
  todayISO, monthDays, weekdayOf, shiftsToday, nextShiftAfter, computeMonthSummary,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDateLong(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS_IT_LONG[weekdayOf(y, m, d)]} ${d} ${MONTHS_IT[m - 1]}`;
}

function siteFor(sites, siteId) {
  return sites.find((s) => s.id === siteId) || { name: 'Sede eliminata', color: '#6b7280' };
}

export default function NotificheTab({ state, onBack }) {
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const dayOfMonth = Number(today.slice(8, 10));

  const todays = shiftsToday(state.shifts, today);
  const upcoming = !todays.length ? nextShiftAfter(state.shifts, today) : null;
  const month = computeMonthSummary(state.shifts, state.sites, state.settings, y, m);
  const goal = Number(state.settings.monthlyGoal) || 0;

  const items = [];
  const now = new Date();

  for (const sh of todays) {
    const [h, mn] = sh.start.split(':').map(Number);
    const startDate = new Date(); startDate.setHours(h, mn, 0, 0);
    const diffMin = (startDate - now) / 60000;
    const site = siteFor(state.sites, sh.siteId);
    if (diffMin > 0 && diffMin <= 60) {
      items.push({ id: `soon-${sh.id}`, icon: 'bell', tile: 'rose', title: 'Turno tra poco',
        text: `Inizia alle ${sh.start} — ${site.name}`, site });
    } else {
      items.push({ id: `today-${sh.id}`, icon: 'calendar', tile: 'teal', title: 'Turno di oggi',
        text: `${site.name} · ${sh.start}–${sh.end}`, site });
    }
  }

  if (!todays.length && upcoming) {
    const site = siteFor(state.sites, upcoming.siteId);
    items.push({ id: 'upcoming', icon: 'calendar', tile: 'teal', title: 'Prossimo turno',
      text: `${formatDateLong(upcoming.date)} · ${site.name} ${upcoming.start}–${upcoming.end}`, site });
  }

  if (goal > 0) {
    if (month.net >= goal) {
      items.push({ id: 'goal-done', icon: 'checkCircle', tile: 'lime', title: 'Obiettivo raggiunto 🎯',
        text: `Netto di ${MONTHS_IT[m - 1]}: €${fmt(month.net)} su €${fmt(goal)}` });
    } else {
      items.push({ id: 'goal-todo', icon: 'euro', tile: 'gold', title: 'Obiettivo del mese',
        text: `Mancano €${fmt(goal - month.net)} per arrivare a €${fmt(goal)}` });
    }
  }

  if (state.shifts.length > 0) {
    const lastDate = state.shifts.reduce((max, s) => (s.date > max ? s.date : max), state.shifts[0].date);
    const daysSince = Math.round((new Date(today) - new Date(lastDate)) / 86400000);
    if (daysSince >= 7) {
      items.push({ id: 'stale', icon: 'hourglass', tile: 'violet', title: 'Turni da aggiornare',
        text: `Non registri un turno da ${daysSince} giorni.` });
    }
  }

  if (monthDays(y, m) - dayOfMonth <= 3 && month.shiftCount > 0) {
    items.push({ id: 'month-end', icon: 'history', tile: 'indigo', title: 'Il mese sta per finire',
      text: `Finora a ${MONTHS_IT[m - 1]}: €${fmt(month.net)} netti stimati.` });
  }

  return (
    <div className="panel">
      {onBack && <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>‹ Home</button>}
      <h2 className="panel-title">Notifiche</h2>
      <p className="panel-desc">Promemoria basati sui tuoi dati, visibili quando apri l'app (non sono notifiche push del telefono).</p>

      {items.length === 0 ? (
        <EmptyState icon="checkCircle" title="Tutto tranquillo" hint="Non ci sono promemoria al momento." />
      ) : (
        <div className="notif-list">
          {items.map((it) => (
            <div key={it.id} className="notif-card">
              <span className={`nav-icon-tile tile-${it.tile}`}><Icon name={it.icon} size={18} /></span>
              <div className="notif-body">
                <div className="notif-title">{it.title}</div>
                <div className="notif-text">
                  {it.site && <SiteAvatar site={it.site} size={14} />} {it.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
