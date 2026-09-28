// Promemoria periodico "esporta un backup", salvato sul dispositivo.
const LAST_KEY = 'turnio_last_backup';
const FIRST_USE_KEY = 'turnio_first_use';
const SNOOZE_KEY = 'turnio_backup_reminder_snoozed_until';
const INTERVAL_DAYS = 14;
const DAY_MS = 86400000;

export function markFirstUse() {
  try { if (!localStorage.getItem(FIRST_USE_KEY)) localStorage.setItem(FIRST_USE_KEY, String(Date.now())); } catch {}
}

export function markBackupDone() {
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch {}
}

export function snoozeBackupReminder(days = 7) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * DAY_MS)); } catch {}
}

export function shouldShowBackupReminder() {
  try {
    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY)) || 0;
    if (Date.now() < snoozedUntil) return false;
    // Punto di riferimento: l'ultimo backup, oppure — se non ne hai mai fatto uno —
    // da quando usi l'app per la prima volta su questo dispositivo.
    const anchor = Number(localStorage.getItem(LAST_KEY)) || Number(localStorage.getItem(FIRST_USE_KEY)) || 0;
    if (!anchor) return false;
    return (Date.now() - anchor) / DAY_MS >= INTERVAL_DAYS;
  } catch { return false; }
}
