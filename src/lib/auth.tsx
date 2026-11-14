import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearAccount, loadAccount, syncProfile } from './data/actions';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAnonymous: boolean;
}

interface AuthState {
  /** False until Supabase has restored (or ruled out) a saved session. */
  ready: boolean;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthState>({ ready: false, user: null });

// An expired or reused email link comes back as #error_description=… in the URL.
// Read it at startup, before a route redirect drops the fragment.
let linkError: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.hash.slice(1));
  if (!p.get('error')) return null;
  return p.get('error_code') === 'otp_expired'
    ? 'That email link has expired or was already used. Log in to get a new confirmation email, or use "Forgot password?" for a new reset link.'
    : p.get('error_description') ?? 'That email link could not be used.';
})();

export const getLinkError = () => linkError;

const toAuthUser = (u: SupabaseUser): AuthUser => ({
  id: u.id,
  email: u.email ?? '',
  name: typeof u.user_metadata?.full_name === 'string' ? u.user_metadata.full_name : '',
  // Guests get an anonymous Supabase account; they can attach an email later and keep their data.
  isAnonymous: Boolean(u.is_anonymous),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: !supabase, user: null });

  useEffect(() => {
    if (!supabase) return;
    let loadedFor: string | null = null;
    // INITIAL_SESSION fires once the saved session (or a link in the URL) has been read.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ? toAuthUser(session.user) : null;
      if (user) linkError = null;
      // Load data only when the signed-in user changes (not on every token refresh).
      // Deferred on purpose: awaiting Supabase calls inside this callback can deadlock.
      if (user && user.id !== loadedFor) {
        loadedFor = user.id;
        setTimeout(() => void loadAccount(user), 0);
      } else if (user) {
        // Same account, new details (e.g. a guest just confirmed their email): keep the profile in step.
        setTimeout(() => void syncProfile(user), 0);
      } else if (!user && loadedFor) {
        loadedFor = null;
        clearAccount();
      }
      setState({ ready: true, user });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
