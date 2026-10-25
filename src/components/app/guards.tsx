import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useOrg } from '@/lib/data/hooks';
import { switchOrganization } from '@/lib/data/actions';
import { useEffect } from 'react';

/** Redirects to /login (remembering the destination) when no one is signed in. */
export function RequireAuth() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
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
