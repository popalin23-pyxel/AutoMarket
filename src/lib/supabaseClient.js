// Client Supabase per autenticazione e dati cloud.
// URL e anon key sono valori PUBBLICI per progetto (protetti dalla Row Level
// Security sul database, non dalla segretezza), impostati come variabili
// d'ambiente a build-time: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && anonKey);

// Cosa dice il link dell'email con cui si è aperta l'app. Va letto PRIMA di creare il client:
// Supabase poi cancella i parametri dall'indirizzo.
//  - recovery: link "reimposta password" valido
//  - linkError: link scaduto o già usato (es. aperto due volte, o una seconda email ha annullato la prima)
function readAuthLink() {
  if (typeof window === 'undefined') return { recovery: false, linkError: null };
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  new URLSearchParams(window.location.search).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const recovery = params.get('type') === 'recovery' && params.has('access_token');
  const code = params.get('error_code') || '';
  const linkError = params.has('error') || code
    ? (/expired|otp|invalid/i.test(code + ' ' + (params.get('error_description') || ''))
        ? 'Il link dell\'email è scaduto o è già stato usato. Richiedine uno nuovo: vale solo l\'ultima email ricevuta.'
        : 'Il link dell\'email non è valido. Richiedine uno nuovo.')
    : null;
  if (linkError) {
    // pulisce l'indirizzo, così l'errore non riappare ricaricando la pagina
    try { window.history.replaceState(null, '', window.location.pathname); } catch {}
  }
  return { recovery, linkError };
}
export const authLink = readAuthLink();

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
