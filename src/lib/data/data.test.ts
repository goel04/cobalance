import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── A recording fake of the Supabase client ─────────────────────────────────

type Call = { table: string; op: 'select' | 'insert' | 'update' | 'delete' | 'rpc' | 'upload' | 'remove'; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
let failInsertInto: string | null = null;

function respond(q: Call & { single?: boolean }) {
  if (q.op === 'insert' && q.table === failInsertInto) return { data: null, error: { message: 'boom', code: '23514' } };
  if (q.op === 'rpc' && q.table === 'create_company') return { data: 'company-new', error: null };
  if (q.op === 'rpc' && q.table === 'save_calculation_run') return { data: `run-${calls.length}`, error: null };
  if (q.op === 'insert' || q.op === 'update') {
    const rows = Array.isArray(q.payload) ? q.payload : [q.payload];
    const out = rows.map((r) => ({ id: 'server-id', created_at: '2026-01-01T00:00:00+00:00', ...(r as object) }));
    return { data: q.single ? out[0] : out, error: null };
  }
  if (q.op === 'select' && q.single) return { data: { created_at: '2026-01-01T00:00:00+00:00', id: 'x' }, error: null };
  return { data: q.single ? null : [], error: null };
}

function builder(table: string) {
  const q: Call & { single?: boolean } = { table, op: 'select', filters: [] };
  const api: Record<string, unknown> = {
    insert: (p: unknown) => ((q.op = 'insert'), (q.payload = p), api),
    update: (p: unknown) => ((q.op = 'update'), (q.payload = p), api),
    delete: () => ((q.op = 'delete'), api),
    select: () => api,
    single: () => ((q.single = true), api),
    eq: (c: string, v: unknown) => (q.filters.push([c, v]), api),
    in: (c: string, v: unknown) => (q.filters.push([c, v]), api),
    order: () => api,
    not: () => api,
    limit: () => api,
    range: () => api,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      calls.push(q);
      return Promise.resolve(respond(q)).then(res, rej);
    },
  };
  return api;
}

const fake = {
  from: (t: string) => builder(t),
  rpc: (name: string, args: unknown) => {
    const q: Call = { table: name, op: 'rpc', payload: args, filters: [] };
    calls.push(q);
    return Promise.resolve(respond(q));
  },
  storage: {
    from: () => ({
      upload: (path: string) => (calls.push({ table: 'storage', op: 'upload', payload: path, filters: [] }), Promise.resolve({ data: { path }, error: null })),
      remove: (paths: string[]) => (calls.push({ table: 'storage', op: 'remove', payload: paths, filters: [] }), Promise.resolve({ data: [], error: null })),
    }),
  },
};

vi.mock('@/lib/supabase', () => ({ getSupabase: () => fake, supabase: fake, isSupabaseConfigured: true }));

const { importBundle } = await import('./bundle');
const { pickSession } = await import('./actions');
const { emptyDb, replaceDb } = await import('./store');
const { friendly, ts } = await import('./remote');
const { buildSampleBundle } = await import('./seed');

const USER = 'user-1';

beforeEach(() => {
  calls.length = 0;
  failInsertInto = null;
  replaceDb({ ...emptyDb(), session: { userId: USER, organizationId: null, periodId: null, facilityId: 'all' } });
});

const inserted = (table: string) => calls.filter((c) => c.table === table && c.op === 'insert').flatMap((c) => c.payload as Record<string, unknown>[]);

describe('importBundle', () => {
  it('creates a new company and re-keys every record to fresh ids', async () => {
    const bundle = buildSampleBundle(USER);
    bundle.evidence = [
      {
        id: 'old-doc',
        organizationId: 'old-org',
        facilityId: bundle.facilities[0].id,
        reportingPeriodId: bundle.periods[0].id,
        fileName: 'bill.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
        storagePath: 'old-org/old-doc/bill.pdf',
        documentType: 'Electricity bill',
        reviewStatus: 'unreviewed',
        uploadedBy: 'someone-else',
        createdAt: '',
        blob: new Blob(['pdf'], { type: 'application/pdf' }),
      },
    ];
    bundle.activities[0].evidenceDocumentId = 'old-doc';

    const r = await importBundle(bundle, { isSample: true });
    expect(r.orgId).toBe('company-new');
    expect(r.counts.activities).toBe(bundle.activities.length);
    expect(r.missingFiles).toEqual([]);

    const oldIds = new Set([...bundle.facilities, ...bundle.periods, ...bundle.activities, ...bundle.factors].map((x) => x.id));
    const facilities = inserted('facilities');
    const periods = inserted('carbon_assessments');
    const activities = inserted('emission_activities');
    expect(facilities).toHaveLength(1);
    for (const row of [...facilities, ...periods, ...activities, ...inserted('emission_factors')]) {
      expect(oldIds.has(row.id as string)).toBe(false);
      expect(row.company_id).toBe('company-new');
    }
    // Activities point at the new facility/period and are created by the importing user (required by RLS).
    for (const a of activities) {
      expect(a.facility_id).toBe(facilities[0].id);
      expect(a.assessment_id).toBe(periods[0].id);
      expect(a.created_by).toBe(USER);
    }
    // The evidence file was uploaded under the new company and the link was remapped.
    const upload = calls.find((c) => c.op === 'upload')!;
    expect(String(upload.payload)).toMatch(/^company-new\/[0-9a-f-]{36}\/bill\.pdf$/);
    const doc = calls.find((c) => c.table === 'evidence_documents' && c.op === 'insert')!.payload as Record<string, unknown>;
    expect(doc.uploaded_by).toBe(USER);
    expect(activities[0].evidence_document_id).toBe(doc.id);
    // Sample factors stay sample; nothing is deleted on success.
    expect(inserted('emission_factors').every((f) => f.origin === 'sample')).toBe(true);
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('rolls back completely when a step fails', async () => {
    const bundle = buildSampleBundle(USER);
    bundle.evidence = [
      { id: 'd1', organizationId: 'o', facilityId: null, reportingPeriodId: null, fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1, storagePath: 'o/d1/a.pdf', documentType: 'Other', reviewStatus: 'unreviewed', uploadedBy: 'u', createdAt: '', blob: new Blob(['x']) },
    ];
    failInsertInto = 'emission_activities';
    await expect(importBundle(bundle, { isSample: true })).rejects.toThrow();
    const del = calls.find((c) => c.table === 'companies' && c.op === 'delete');
    expect(del?.filters).toContainEqual(['id', 'company-new']);
    const removed = calls.find((c) => c.op === 'remove');
    expect((removed?.payload as string[])[0]).toMatch(/^company-new\//);
  });

  it('skips documents whose file is missing and reports them', async () => {
    const bundle = buildSampleBundle(USER);
    bundle.evidence = [
      { id: 'd1', organizationId: 'o', facilityId: null, reportingPeriodId: null, fileName: 'lost.pdf', mimeType: 'application/pdf', sizeBytes: 1, storagePath: 'o/d1/lost.pdf', documentType: 'Other', reviewStatus: 'unreviewed', uploadedBy: 'u', createdAt: '', blob: null },
    ];
    bundle.activities[0].evidenceDocumentId = 'd1';
    const r = await importBundle(bundle, { isSample: true });
    expect(r.missingFiles).toEqual(['lost.pdf']);
    expect(inserted('emission_activities')[0].evidence_document_id).toBeNull();
  });

  it('only imports user factors for a real (non-sample) company', async () => {
    const bundle = buildSampleBundle(USER);
    await importBundle(bundle);
    expect(inserted('emission_factors')).toHaveLength(0);
  });
});

describe('pickSession', () => {
  const base = { ...emptyDb() };
  const org = (id: string, isSample = false) => ({ id, name: id, industry: '', companySize: '', country: 'India', state: '', city: '', website: '', isSample, onboardingStep: 4, createdAt: '' });
  const data = {
    ...base,
    organizations: [org('sample', true), org('real')],
    memberships: [
      { organizationId: 'sample', userId: USER, role: 'owner' as const, createdAt: '' },
      { organizationId: 'real', userId: USER, role: 'owner' as const, createdAt: '' },
    ],
    periods: [
      { id: 'p-old', organizationId: 'real', label: '', startDate: '2024-04-01', endDate: '2025-03-31', status: 'open' as const, methodologyVersion: '', scope3Exclusions: [], createdAt: '' },
      { id: 'p-new', organizationId: 'real', label: '', startDate: '2025-04-01', endDate: '2026-03-31', status: 'open' as const, methodologyVersion: '', scope3Exclusions: [], createdAt: '' },
    ],
  };

  it('prefers a real organisation and its latest period by default', () => {
    expect(pickSession(data, USER, null)).toEqual({ userId: USER, organizationId: 'real', periodId: 'p-new', facilityId: 'all' });
  });

  it('restores the last selection when it is still valid', () => {
    expect(pickSession(data, USER, { organizationId: 'real', periodId: 'p-old', facilityId: 'all' }).periodId).toBe('p-old');
  });

  it('ignores a remembered organisation the user no longer belongs to', () => {
    expect(pickSession(data, USER, { organizationId: 'someone-elses', periodId: 'x', facilityId: 'f' })).toMatchObject({ organizationId: 'real', periodId: 'p-new', facilityId: 'all' });
  });
});

describe('remote helpers', () => {
  it('normalises Postgres timestamps to ISO strings so they compare correctly', () => {
    expect(ts('2026-01-01T10:00:00.5+00:00')).toBe('2026-01-01T10:00:00.500Z');
    expect(ts('2026-01-01T10:00:00+05:30') < ts('2026-01-01T10:00:00+00:00')).toBe(true);
  });

  it('turns database errors into actionable messages', () => {
    expect(friendly({ code: '42501', message: 'new row violates row-level security policy' }).message).toMatch(/permission/);
    expect(friendly({ message: 'TypeError: Failed to fetch' }).message).toMatch(/not saved/);
  });
});

describe('legacy browser data', () => {
  it('lists real organisations saved by the demo version, skipping samples', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const legacy = {
      ...emptyDb(),
      users: [{ id: 'u1', email: 'old@example.test', name: 'Old', createdAt: '' }],
      organizations: [
        { id: 'o1', name: 'Real Co', industry: '', companySize: '', country: 'India', state: '', city: '', website: '', isSample: false, onboardingStep: 4, createdAt: '' },
        { id: 'o2', name: 'Sample', industry: '', companySize: '', country: 'India', state: '', city: '', website: '', isSample: true, onboardingStep: 4, createdAt: '' },
      ],
      memberships: [{ organizationId: 'o1', userId: 'u1', role: 'owner', createdAt: '' }],
    };
    store.set('cobalance.demo.v1', JSON.stringify(legacy));
    const { listLegacyOrgs } = await import('./legacy');
    expect(listLegacyOrgs()).toEqual([{ id: 'o1', name: 'Real Co', ownerEmail: 'old@example.test', activities: 0, facilities: 0, documents: 0, importedAt: null }]);
    vi.unstubAllGlobals();
  });
});
