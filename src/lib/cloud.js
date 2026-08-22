// Sincronizzazione cloud opzionale via Supabase (REST, senza SDK).
// Modello "documento condiviso": una riga per "codice team" con l'intero stato.
// La configurazione è salvata SOLO in locale (non viene mai sincronizzata).

const CFG_KEY = 'turnify_cloud_cfg';

export function getCloudConfig() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { url: '', key: '', team: '', autoLoad: false };
    return { url: '', key: '', team: '', autoLoad: false, ...JSON.parse(raw) };
  } catch {
    return { url: '', key: '', team: '', autoLoad: false };
  }
}

export function saveCloudConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {}
}

export function isCloudConfigured(cfg = getCloudConfig()) {
  return !!(cfg.url && cfg.key && cfg.team);
}

function endpoint(cfg) {
  const base = cfg.url.replace(/\/+$/, '');
  return `${base}/rest/v1/turnify_state`;
}

function headers(cfg) {
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  };
}

// Carica lo stato dal cloud per il team indicato. Ritorna { state, updatedAt } o null.
export async function pullState(cfg = getCloudConfig()) {
  if (!isCloudConfigured(cfg)) throw new Error('Sincronizzazione non configurata.');
  const url = `${endpoint(cfg)}?team=eq.${encodeURIComponent(cfg.team)}&select=data,updated_at`;
  const res = await tryFetch(url, { headers: headers(cfg), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(await friendlyError(res));
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return { state: rows[0].data, updatedAt: rows[0].updated_at };
}

// Salva (upsert) lo stato sul cloud per il team indicato.
export async function pushState(state, cfg = getCloudConfig()) {
  if (!isCloudConfigured(cfg)) throw new Error('Sincronizzazione non configurata.');
  const body = JSON.stringify([{ team: cfg.team, data: state, updated_at: new Date().toISOString() }]);
  const res = await tryFetch(endpoint(cfg), {
    method: 'POST',
    headers: { ...headers(cfg), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(await friendlyError(res));
  return true;
}

async function tryFetch(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('Timeout: il server non risponde.');
    throw new Error('Rete non raggiungibile o URL Supabase errato.');
  }
}

async function friendlyError(res) {
  let detail = '';
  try { detail = (await res.json())?.message || ''; } catch {}
  if (res.status === 401 || res.status === 403) return 'Chiave o permessi non validi (controlla anon key e RLS).';
  if (res.status === 404) return 'Tabella non trovata: esegui lo script SQL di configurazione.';
  return `Errore ${res.status}${detail ? ': ' + detail : ''}`;
}

// Script SQL da eseguire una volta nel progetto Supabase
export const SETUP_SQL = `-- Tabella per la sincronizzazione Turnify
create table if not exists turnify_state (
  team text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Attiva RLS e consenti accesso con la anon key (tool interno).
-- NB: chiunque abbia URL + anon key + codice team può leggere/scrivere:
-- usa un codice team non banale.
alter table turnify_state enable row level security;

create policy "turnify anon rw" on turnify_state
  for all to anon using (true) with check (true);`;
