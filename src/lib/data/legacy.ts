// Migration path for data saved by the earlier demo version, which kept every
// account and organisation in this browser (localStorage "cobalance.demo.v1",
// files in IndexedDB "cobalance-evidence").
//
// Strategy (nothing happens without the user choosing it):
//   1. After login, detect demo organisations still stored in this browser.
//   2. The user imports the ones they want: each becomes a new company owned by
//      their account (fresh ids, files uploaded to private storage). An import is
//      all-or-nothing — see bundle.ts.
//   3. The browser copy is left untouched until the user chooses "Remove browser
//      copy", so a failed or partial migration can always be retried.

import { useSyncExternalStore } from 'react';
import { reloadAccount, switchOrganization } from './actions';
import { importBundle, type ImportResult } from './bundle';
import { clearLegacyFiles, getLegacyFile } from './evidence-files';
import type { DB } from './types';

const LEGACY_KEY = 'cobalance.demo.v1';
const IMPORTED_KEY = 'cobalance.legacy-imports.v1';

export interface LegacyOrg {
  id: string;
  name: string;
  /** Email of the demo account that owned it, when known. */
  ownerEmail: string | null;
  activities: number;
  facilities: number;
  documents: number;
  /** When it was imported into a Supabase account (from this browser). */
  importedAt: string | null;
}

let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};

function readLegacy(): DB | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    return parsed && parsed.version === 1 && Array.isArray(parsed.organizations) ? parsed : null;
  } catch {
    return null;
  }
}

function readImported(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(IMPORTED_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Real (non-sample) organisations found in the old browser storage. */
export function listLegacyOrgs(): LegacyOrg[] {
  const d = readLegacy();
  if (!d) return [];
  const imported = readImported();
  return d.organizations
    .filter((o) => !o.isSample)
    .map((o) => {
      const owner = d.memberships.find((m) => m.organizationId === o.id && m.role === 'owner');
      return {
        id: o.id,
        name: o.name,
        ownerEmail: d.users.find((u) => u.id === owner?.userId)?.email ?? null,
        activities: d.activities.filter((a) => a.organizationId === o.id).length,
        facilities: d.facilities.filter((f) => f.organizationId === o.id).length,
        documents: (d.evidence ?? []).filter((e) => e.organizationId === o.id).length,
        importedAt: imported[o.id] ?? null,
      };
    });
}

export function useLegacyOrgs(): LegacyOrg[] {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return listLegacyOrgs();
}

export async function importLegacyOrganization(legacyOrgId: string, onProgress?: (step: string) => void): Promise<ImportResult> {
  const d = readLegacy();
  const o = d?.organizations.find((x) => x.id === legacyOrgId);
  if (!d || !o) throw new Error('That organisation is no longer stored in this browser.');
  const of = <T extends { organizationId?: string | null }>(xs: T[] | undefined) => (xs ?? []).filter((x) => x.organizationId === o.id);

  onProgress?.('Reading files saved in this browser');
  const evidence = await Promise.all(
    of(d.evidence).map(async (e) => ({ ...e, blob: (await getLegacyFile(e.storagePath).catch(() => undefined)) ?? null })),
  );

  const result = await importBundle(
    {
      org: { name: o.name, industry: o.industry, companySize: o.companySize, country: o.country, state: o.state, city: o.city, website: o.website, onboardingStep: o.onboardingStep },
      facilities: of(d.facilities),
      periods: of(d.periods),
      factors: of(d.factors),
      evidence,
      activities: of(d.activities),
      reductionActions: of(d.reductionActions),
      runs: of(d.runs),
      reports: of(d.reports),
    },
    { onProgress },
  );

  try {
    localStorage.setItem(IMPORTED_KEY, JSON.stringify({ ...readImported(), [o.id]: new Date().toISOString() }));
  } catch {
    // Only affects the "already imported" label.
  }
  onProgress?.('Loading your data');
  await reloadAccount();
  switchOrganization(result.orgId);
  changed();
  return result;
}

/** Deletes the old browser copy (localStorage + IndexedDB files). Only on explicit request. */
export async function removeLegacyData() {
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(IMPORTED_KEY);
  await clearLegacyFiles().catch(() => undefined);
  changed();
}
