import { useSyncExternalStore } from 'react';
import type { DB } from './types';

// Demo-mode persistence. The whole dataset lives in this browser's localStorage;
// nothing is sent to a server. Swap this module for a Supabase-backed repository
// when the backend is connected — callers only use getDb/update/useDb.

const KEY = 'cobalance.demo.v1';

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
  session: { userId: null, organizationId: null, periodId: null, facilityId: 'all' },
});

function load(): DB {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as DB;
    if (parsed.version !== 1) return emptyDb();
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

let db: DB = load();
const listeners = new Set<() => void>();

export class StorageError extends Error {}

function persist(next: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new StorageError('Could not save: this browser\'s storage is full or unavailable. Your last change was not saved.');
  }
}

export function getDb(): DB {
  return db;
}

/** Apply a mutation to a copy of the database, persist it, then notify subscribers. */
export function update<T>(fn: (draft: DB) => T): T {
  const draft = structuredClone(db);
  const out = fn(draft);
  persist(draft);
  db = draft;
  listeners.forEach((l) => l());
  return out;
}

export function replaceDb(next: DB) {
  persist(next);
  db = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): DB {
  return useSyncExternalStore(subscribe, getDb, getDb);
}

if (typeof window !== 'undefined') {
  // Keep tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      db = load();
      listeners.forEach((l) => l());
    }
  });
}
