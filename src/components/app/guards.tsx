import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, useOrg } from '@/lib/data/hooks';
import { reloadAccount, startGuestSession, switchOrganization } from '@/lib/data/actions';
import { useLoadState } from '@/lib/data/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button, Notice } from '@/components/ui';
import { SetupRequired } from './SetupRequired';

export function AuthLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-ink-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

// One guest sign-in per page load, even if the guard re-renders or React mounts it twice.
let guestAttempt: Promise<void> | null = null;

/**
 * Logging in is optional: a visitor without a session is signed in as a guest
 * (an anonymous Supabase account). If guest access is turned off in Supabase,
 * they are sent to /login instead, with the reason.
 */
function StartGuest() {
  const loc = useLocation();
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    guestAttempt ??= startGuestSession().finally(() => {
      guestAttempt = null;
    });
    guestAttempt.catch((e) => setFailed(e instanceof Error ? e.message : 'Could not start a guest session.'));
  }, []);
  if (failed) {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}&guest=unavailable`} replace />;
  }
  return <AuthLoading label="Opening Cobalance…" />;
}

/**
 * Makes sure there is a session (a real account or a guest), then waits for the
 * account's data to load from Supabase before rendering.
 */
export function RequireAuth() {
  const { ready, user } = useAuth();
  const load = useLoadState();
  if (!isSupabaseConfigured) return <SetupRequired />;
  if (!ready) return <AuthLoading />;
  if (!user) return <StartGuest />;
  if (load.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <Notice tone="error" title="Could not load your data">
            {load.message}
          </Notice>
          <Button onClick={() => void reloadAccount().catch(() => undefined)} className="w-full">
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (load.status !== 'ready') return <AuthLoading label="Loading your data…" />;
  return <Outlet />;
}

/** Requires an organisation the user is a member of, with onboarding past the reporting-period step. */
export function RequireOrganization() {
  const { org, myOrgs } = useOrg();
  const fallback = !org ? myOrgs.find((o) => o.onboardingStep >= 3) : undefined;
  useEffect(() => {
    if (fallback) switchOrganization(fallback.id);
  }, [fallback]);
  if (fallback) return null;
  if (!org || org.onboardingStep < 3) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
