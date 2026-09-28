import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(false); // true = arrivato dal link "reimposta password"
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('id, email, role, approved').eq('id', userId).maybeSingle();
      if (error) throw error;
      setProfile(data);
    } catch (e) {
      console.warn('Turnio: impossibile caricare il profilo', e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) loadProfile(data.session.user.id);
    }).catch((e) => {
      // Es. rete irraggiungibile: non restare bloccati sulla schermata di caricamento.
      console.warn('Turnio: impossibile recuperare la sessione', e);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(sess);
      setLoading(false);
      if (sess?.user) loadProfile(sess.user.id);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw friendlyAuthError(error);
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendlyAuthError(error);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw friendlyAuthError(error);
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw friendlyAuthError(error);
    setRecovery(false);
  }, []);

  // Cancella definitivamente l'account e tutti i dati (righe collegate via ON DELETE CASCADE).
  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw friendlyAuthError(error);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(() => {
    if (session?.user) return loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = {
    configured: isSupabaseConfigured,
    session, user: session?.user ?? null,
    loading, recovery, setRecovery,
    profile, profileLoading, refreshProfile,
    isAdmin: profile?.role === 'admin',
    isApproved: !!profile?.approved || profile?.role === 'admin',
    signUp, signIn, signOut, sendPasswordReset, updatePassword, deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}

function friendlyAuthError(error) {
  const msg = error?.message || '';
  if (/already registered/i.test(msg)) return new Error('Esiste già un account con questa email.');
  if (/invalid login credentials/i.test(msg)) return new Error('Email o password non corrette.');
  if (/password.*at least/i.test(msg) || /password should be/i.test(msg)) return new Error('La password deve avere almeno 6 caratteri.');
  if (/email not confirmed/i.test(msg)) return new Error('Devi confermare l\'email prima di accedere (controlla la posta).');
  if (/rate limit/i.test(msg)) return new Error('Troppi tentativi, riprova tra qualche minuto.');
  if (/invalid email/i.test(msg)) return new Error('Indirizzo email non valido.');
  return new Error(msg || 'Errore imprevisto.');
}
