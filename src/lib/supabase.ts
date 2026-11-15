import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser Supabase client. Only the project URL and the *publishable* key may
// live here: both are public by design, and Row Level Security in
// supabase/migrations is what protects company data. Secret / service-role
// keys must never be imported into frontend code.

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

if (isSupabaseConfigured && publishableKey!.startsWith('sb_secret_')) {
  // Fail loudly rather than ship a secret key to every visitor.
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY contains a secret key. Use the publishable (sb_publishable_…) key in the frontend.');
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Email confirmation and password-reset links return with tokens in the URL.
        detectSessionInUrl: true,
        storageKey: 'cobalance-auth',
      },
    })
  : null;

/** The configured client, or a clear error when the environment variables are missing. */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}
