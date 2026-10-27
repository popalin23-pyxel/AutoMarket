// Copie automatiche giornaliere sul server e segnalazioni dei problemi.
// Entrambe richiedono l'aggiornamento del database (UPGRADE_SQL_2 in cloudState.js): finché
// non è stato eseguito le funzioni danno un errore riconoscibile (isMissingTable).

import { supabase } from './supabaseClient.js';

const BACKUPS = 'turnio_backups';
const REPORTS = 'turnio_reports';

// tabella non ancora creata (aggiornamento del database non eseguito)
export function isMissingTable(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(msg);
}

function fail(error) {
  const e = new Error(isMissingTable(error)
    ? 'Funzione non ancora attiva: chi gestisce l\'app deve aggiornare il database (vedi Amministrazione).'
    : error?.message || 'Richiesta non riuscita. Controlla la connessione e riprova.');
  e.missing = isMissingTable(error);
  throw e;
}

// ── Copie giornaliere (le scrive il database da solo, vedi il trigger turnio_daily_backup) ──
export async function listServerCopies(userId) {
  const { data, error } = await supabase.from(BACKUPS).select('day, created_at').eq('user_id', userId).order('day', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function fetchServerCopy(userId, day) {
  const { data, error } = await supabase.from(BACKUPS).select('data, day, created_at').eq('user_id', userId).eq('day', day).maybeSingle();
  if (error) fail(error);
  return data;
}

// ── Segnalazioni ──────────────────────────────────────────────
export async function sendReport({ userId, email, message, context, screenshot }) {
  const { error } = await supabase.from(REPORTS).insert({ user_id: userId, email, message, context, screenshot: screenshot || null });
  if (error) fail(error);
}

export async function listMyReports(userId) {
  const { data, error } = await supabase.from(REPORTS).select('id, created_at, message, status').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(20);
  if (error) fail(error);
  return data ?? [];
}

// solo per l'amministratore (la Row Level Security fa vedere a ognuno solo le proprie)
export async function listAllReports() {
  const { data, error } = await supabase.from(REPORTS).select('id, created_at, email, message, context, screenshot, status')
    .order('created_at', { ascending: false }).limit(100);
  if (error) fail(error);
  return data ?? [];
}

export async function countNewReports() {
  const { count, error } = await supabase.from(REPORTS).select('id', { count: 'exact', head: true }).eq('status', 'nuovo');
  if (error) return 0;
  return count ?? 0;
}

export async function setReportStatus(id, status) {
  const { error } = await supabase.from(REPORTS).update({ status }).eq('id', id);
  if (error) fail(error);
}

export async function deleteReport(id) {
  const { error } = await supabase.from(REPORTS).delete().eq('id', id);
  if (error) fail(error);
}

// L'aggiornamento del database è stato fatto? (per il riquadro in Amministrazione)
export async function checkServerUpgrade() {
  const probe = async (table) => {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    return !error || !isMissingTable(error);
  };
  const [backups, reports] = await Promise.all([probe(BACKUPS), probe(REPORTS)]);
  return { backups, reports };
}
