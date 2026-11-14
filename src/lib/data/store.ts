import { useSyncExternalStore } from 'react';
import type { DB, Session } from './types';

// In-memory cache of the signed-in user's data, loaded from Supabase (see remote.ts).
// Company data is never written to localStorage: a reload fetches it again, and
// logging out clears it. Only the UI selection (organisation / period / facility)
// is remembered per user, because it is not company data.

export const emptySession = (): Session => ({ userId: null, organizationId: null, periodId: null, facilityId: 'all' });

export const emptyDb = (): DB => ({
  version: 1,
  users: [],
  organizations: [],
  memberships: [],
  facilities: [],
  periods: [],
  activities: [],
  evidence: [],
  runs: [],
  reductionActions: [],
  reports: [],
  factors: [],
  audit: [],
  session: emptySession(),
});

export type LoadState = { status: 'idle' | 'loading' | 'ready' } | { status: 'error'; message: string };

let db: DB = emptyDb();
let loadState: LoadState = { status: 'idle' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDb(): DB {
  return db;
}

/** Apply a mutation to a copy of the cache, then notify subscribers. Callers write to Supabase first. */
export function update<T>(fn: (draft: DB) => T): T {
  const draft = structuredClone(db);
  const out = fn(draft);
  db = draft;
  if (draft.session.userId) savePrefs(draft.session);
  emit();
  return out;
}

export function replaceDb(next: DB) {
  db = next;
  emit();
}

export function getLoadState(): LoadState {
  return loadState;
}

export function setLoadState(next: LoadState) {
  loadState = next;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): DB {
  return useSyncExternalStore(subscribe, getDb, getDb);
}

export function useLoadState(): LoadState {
  return useSyncExternalStore(subscribe, getLoadState, getLoadState);
}

// ── Per-user UI selection ───────────────────────────────────────────────────

const prefsKey = (userId: string) => `cobalance.prefs.${userId}`;

export function loadPrefs(userId: string): Omit<Session, 'userId'> | null {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Session>;
    return { organizationId: p.organizationId ?? null, periodId: p.periodId ?? null, facilityId: p.facilityId ?? 'all' };
  } catch {
    return null;
  }
}

function savePrefs(s: Session) {
  try {
    localStorage.setItem(prefsKey(s.userId!), JSON.stringify({ organizationId: s.organizationId, periodId: s.periodId, facilityId: s.facilityId }));
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}
