// Pannello Super Admin: elenco utenti, approvazione e ruoli.
// Le query passano sempre dalla Row Level Security: solo chi ha role='admin'
// nella propria riga "profiles" può leggere/aggiornare le righe altrui
// (vedi funzione is_admin() e le policy nello script SQL di setup).

import { supabase } from './supabaseClient.js';

const TABLE = 'profiles';

export async function fetchAllProfiles() {
  const { data, error } = await supabase.from(TABLE).select('id, email, role, approved, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateProfile(id, patch) {
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}
