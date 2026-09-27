// Client Supabase per autenticazione e dati cloud.
// URL e anon key sono valori PUBBLICI per progetto (protetti dalla Row Level
// Security sul database, non dalla segretezza), impostati come variabili
// d'ambiente a build-time: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
