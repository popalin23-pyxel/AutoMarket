// Stato dell'app salvato su Supabase, una riga per utente (protetta da RLS).

import { supabase } from './supabaseClient.js';
import { mergeStates, sameData } from './mergeState.js';
import { sanitizeState } from './store.js';

const TABLE = 'turnio_states';

// Limite di tempo per ogni richiesta: con una rete "connessa ma morta" (Wi-Fi dell'ospedale,
// campo debole) una richiesta senza risposta bloccherebbe tutti i salvataggi successivi.
const TIMEOUT_MS = 20000;
function timeoutSignal() {
  if (typeof AbortController === 'undefined') return undefined;
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(TIMEOUT_MS);
  const c = new AbortController();
  setTimeout(() => c.abort(), TIMEOUT_MS);
  return c.signal;
}
const withTimeout = (query) => {
  const signal = timeoutSignal();
  return signal && query.abortSignal ? query.abortSignal(signal) : query;
};

// updated_at → millisecondi. Va confrontato come istante, NON come testo: l'app lo
// scrive come "…824Z" ma il server (PostgREST) lo restituisce come "…824+00:00".
// Confrontando le stringhe ogni salvataggio sembrava un conflitto con "un altro
// dispositivo" (unione + avviso a ogni modifica). Parser manuale perché Safari meno
// recente non legge i timestamp con più di 3 decimali.
export function toMillis(ts) {
  if (ts == null || ts === '') return null;
  if (typeof ts === 'number') return ts;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(String(ts).trim());
  if (!m) { const t = Date.parse(ts); return Number.isNaN(t) ? null : t; }
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
  const tz = m[8];
  if (tz && tz !== 'Z') {
    const digits = tz.slice(1).replace(':', '');
    const minutes = Number(digits.slice(0, 2)) * 60 + (digits.length > 2 ? Number(digits.slice(2, 4)) : 0);
    t -= (tz[0] === '-' ? -1 : 1) * minutes * 60000;
  }
  return t;
}

// Carica lo stato salvato per l'utente. null = nessuna riga ancora (primo accesso).
export async function fetchCloudState(userId) {
  const { data, error } = await withTimeout(supabase.from(TABLE).select('data, updated_at').eq('user_id', userId)).maybeSingle();
  if (error) throw error;
  return data ? { state: data.data, updatedAt: data.updated_at, version: toMillis(data.updated_at) } : null;
}

// Salva (crea o aggiorna) lo stato dell'utente. Ritorna la versione salvata (updated_at in ms),
// presa dalla risposta del server quando disponibile.
export async function saveCloudState(userId, state) {
  const updatedAt = new Date().toISOString();
  const { data, error } = await withTimeout(supabase.from(TABLE)
    .upsert({ user_id: userId, data: state, updated_at: updatedAt }, { onConflict: 'user_id' })
    .select('updated_at'))
    .single();
  if (error) throw error;
  return toMillis(data?.updated_at ?? updatedAt);
}

// Salva controllando prima se un altro dispositivo ha scritto nel frattempo
// (versione sul server diversa dall'ultima nota su questo dispositivo). In quel caso
// unisce i dati invece di sovrascriverli; se l'unione coincide già con quanto c'è sul
// server, non riscrive nulla.
// Ritorna { state, merged, version }: con merged=true `state` è il risultato dell'unione.
export async function saveCloudStateSafely(userId, localState, lastKnownVersion) {
  const remote = await fetchCloudState(userId);
  if (remote && remote.version !== lastKnownVersion) {
    const remoteState = sanitizeState(remote.state);
    const merged = mergeStates(localState, remoteState);
    if (sameData(merged, remoteState)) return { state: merged, merged: true, version: remote.version };
    const version = await saveCloudState(userId, merged);
    return { state: merged, merged: true, version };
  }
  const version = await saveCloudState(userId, localState);
  return { state: localState, merged: false, version };
}

// Script SQL da eseguire una volta sola nel progetto Supabase (SQL Editor).
export const SETUP_SQL = `-- ════════════════════════════════════════════════════════════
-- 1) Dati Turnio: una riga per utente, protetta da RLS
-- ════════════════════════════════════════════════════════════
create table if not exists turnio_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table turnio_states enable row level security;

create policy "ognuno vede solo i propri dati" on turnio_states
  for select using (auth.uid() = user_id);
create policy "ognuno scrive solo i propri dati" on turnio_states
  for insert with check (auth.uid() = user_id);
create policy "ognuno aggiorna solo i propri dati" on turnio_states
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ognuno elimina solo i propri dati" on turnio_states
  for delete using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 2) Profili utente: ruolo (user/admin) e approvazione manuale
-- ════════════════════════════════════════════════════════════
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- funzione "sono admin?" — gira con privilegi propri (bypassa la RLS al suo
-- interno) per evitare la ricorsione tipica delle policy che leggono la
-- stessa tabella che proteggono
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create policy "vedo il mio profilo, l'admin li vede tutti" on profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "solo l'admin approva/promuove" on profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- crea automaticamente il profilo (in attesa di approvazione) a ogni registrazione
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 3) Cancellazione account self-service (l'utente elimina solo se stesso)
-- ════════════════════════════════════════════════════════════
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;`;
