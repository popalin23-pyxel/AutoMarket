import React from 'react';
import {
  todayISO, monthDays, weekdayOf, shiftsToday, nextShiftAfter, computeMonthProgress, shiftsToConfirm, activeShifts,
} from '../lib/calc.js';
import { MONTHS_IT, WEEKDAYS_IT_LONG } from '../lib/defaults.js';
import Icon from './icons/Icon.jsx';
import SiteAvatar from './SiteAvatar.jsx';
import EmptyState from './EmptyState.jsx';

const fmt = (n) => (n || 0).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const progress = computeMonthProgress(state.shifts, state.sites, state.settings, y, m, state.occasionalWork);
  const month = progress.done; // netto già guadagnato (turni finiti)
  const toConfirm = shiftsToConfirm(state.shifts);
  const goal = Number(state.settings.monthlyGoal) || 0;

  const items = [];
  const now = new Date();

  if (toConfirm.length > 0) {
    items.push({ id: 'confirm', icon: 'checkCircle', tile: 'teal', title: toConfirm.length === 1 ? 'Un turno da confermare' : `${toConfirm.length} turni da confermare`,
      text: 'In Home puoi segnare se sono andati come previsto, se è cambiato l\'orario o se non li hai fatti.' });
  }

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

  // obiettivo: come in Home e in "Quanto devo ancora lavorare?" (già guadagnato + turni in programma)
  if (goal > 0) {
    const forecast = progress.total.netTotal;
    if (month.netTotal >= goal) {
      items.push({ id: 'goal-done', icon: 'checkCircle', tile: 'lime', title: 'Obiettivo raggiunto 🎯',
        text: `Netto di ${MONTHS_IT[m - 1]}: €${fmt(month.netTotal)} su €${fmt(goal)}` });
    } else if (forecast >= goal) {
      items.push({ id: 'goal-covered', icon: 'checkCircle', tile: 'teal', title: 'Obiettivo coperto',
        text: `Con i turni in programma arrivi a €${fmt(forecast)} su €${fmt(goal)}.` });
    } else {
      items.push({ id: 'goal-todo', icon: 'euro', tile: 'gold', title: 'Obiettivo del mese',
        text: `Mancano €${fmt(goal - forecast)} per arrivare a €${fmt(goal)}, contando anche i turni in programma.` });
    }
  }

  // strutture: contratto in scadenza e tetto di ore del mese (dalla scheda della sede)
  for (const site of state.sites.filter((s) => !s.archived)) {
    if (site.contractEnd) {
      const daysLeft = Math.round((new Date(site.contractEnd) - new Date(today)) / 86400000);
      const notice = Number(site.noticeDays) || 0;
      const alertDays = Math.max(30, notice + 7);
      if (daysLeft >= 0 && daysLeft <= alertDays) {
        const [cy, cm, cd] = site.contractEnd.split('-');
        const noticeText = notice > 0 && daysLeft >= notice
          ? ` Per disdire o rinnovare serve un preavviso di ${notice} giorni.`
          : '';
        items.push({ id: `contract-${site.id}`, icon: 'history', tile: 'gold', title: 'Contratto in scadenza', site,
          text: `${site.name}: finisce il ${Number(cd)}/${Number(cm)}/${cy} (${daysLeft === 0 ? 'oggi' : `tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}`}).${noticeText}` });
      }
    }
    const cap = Number(site.maxHoursMonth) || 0;
    if (cap > 0) {
      const hours = progress.total.perSite.find((p) => p.siteId === site.id)?.hours ?? 0;
      if (hours >= cap * 0.9) {
        items.push({ id: `cap-${site.id}`, icon: 'hourglass', tile: hours > cap ? 'rose' : 'gold',
          title: hours > cap ? 'Tetto di ore superato' : 'Vicina al tetto di ore', site,
          text: `${site.name}: ${hours} ore su ${cap} questo mese (turni in programma compresi).` });
      }
    }
  }

  const active = activeShifts(state.shifts);
  if (active.length > 0) {
    const lastDate = active.reduce((max, s) => (s.date > max ? s.date : max), active[0].date);
    const daysSince = Math.round((new Date(today) - new Date(lastDate)) / 86400000);
    if (daysSince >= 7) {
      items.push({ id: 'stale', icon: 'hourglass', tile: 'violet', title: 'Turni da aggiornare',
        text: `Non registri un turno da ${daysSince} giorni.` });
    }
  }

  if (monthDays(y, m) - dayOfMonth <= 3 && (month.shiftCount > 0 || month.occasionalCount > 0)) {
    items.push({ id: 'month-end', icon: 'history', tile: 'indigo', title: 'Il mese sta per finire',
      text: `Finora a ${MONTHS_IT[m - 1]}: €${fmt(month.netTotal)} netti stimati.` });
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
