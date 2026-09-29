// Stato dell'app salvato su Supabase, una riga per utente (protetta da RLS).

import { supabase } from './supabaseClient.js';
import { mergeStates } from './mergeState.js';

const TABLE = 'turnio_states';

// Carica lo stato salvato per l'utente. null = nessuna riga ancora (primo accesso).
export async function fetchCloudState(userId) {
  const { data, error } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { state: data.data, updatedAt: data.updated_at } : null;
}

// Salva (crea o aggiorna) lo stato dell'utente. Ritorna il nuovo updated_at.
export async function saveCloudState(userId, state) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from(TABLE).upsert(
    { user_id: userId, data: state, updated_at: updatedAt },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  return updatedAt;
}

// Salva controllando prima se un altro dispositivo ha scritto nel frattempo
// (confrontando updated_at con l'ultimo valore conosciuto su questo
// dispositivo). In quel caso unisce i dati invece di sovrascriverli alla
// cieca — vedi mergeState.js per i dettagli e i limiti dell'unione.
// Ritorna { state, merged, updatedAt }: se merged è true, il chiamante deve
// aggiornare lo stato locale con `state` (contiene elementi arrivati da un
// altro dispositivo).
export async function saveCloudStateSafely(userId, localState, lastKnownUpdatedAt) {
  if (lastKnownUpdatedAt) {
    const remote = await fetchCloudState(userId);
    if (remote && remote.updatedAt !== lastKnownUpdatedAt) {
      const merged = mergeStates(localState, remote.state);
      const updatedAt = await saveCloudState(userId, merged);
      return { state: merged, merged: true, updatedAt };
    }
  }
  const updatedAt = await saveCloudState(userId, localState);
  return { state: localState, merged: false, updatedAt };
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
