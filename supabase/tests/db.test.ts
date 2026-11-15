// Database tests: apply the real migrations to an in-process Postgres (PGlite),
// with minimal stand-ins for Supabase's auth and storage schemas, then
//   1. run supabase/tests/rls_test.sql (role and isolation rules), and
//   2. replay the app's own writes — payloads built by the same mapper functions
//      the app sends through PostgREST (src/lib/data/remote.ts) — as two users.
//
// Run: npm run test:db

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateAll, ENGINE_VERSION, METHODOLOGY_VERSION, summarize } from '@/lib/engine/calculate';
import { DEFAULT_FACTORS } from '@/lib/engine/factors';
import { activityRow, facilityRow, factorRow, orgProfileRow, periodRow, reductionRow, runRpcArgs, toActivity } from '@/lib/data/remote';
import type { ActivityRecord, CalculationRun } from '@/lib/data/types';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b1';
const C = '00000000-0000-4000-8000-0000000000c1';

// What a Supabase project provides before any migration runs.
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;
`;

let db: PGlite;

/** Act as a signed-in user (like PostgREST: role authenticated + JWT claims), or anonymously. */
async function as(user: string | null) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [user ? JSON.stringify({ sub: user, role: 'authenticated' }) : '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
}

async function asAdmin() {
  await db.exec('reset role');
}

type Row = Record<string, unknown>;

/** Insert only the given columns, the way PostgREST does, and return the stored row. */
async function insert(table: string, row: Row): Promise<Row> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(', ');
  const res = await db.query<Row>(
    `insert into ${table} (${cols}) select ${cols} from json_populate_record(null::${table}, $1::json) returning *`,
    [JSON.stringify(row)],
  );
  return res.rows[0];
}

/** Update only the given columns; returns the number of rows changed (RLS hides others → 0). */
async function patch(table: string, id: string, row: Row): Promise<number> {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(', ');
  const res = await db.query(
    `update ${table} set (${cols}) = (select ${cols} from json_populate_record(null::${table}, $1::json)) where id = $2`,
    [JSON.stringify(row), id],
  );
  return res.affectedRows ?? 0;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params);
  return res.rows[0].n;
}

async function rejects(p: Promise<unknown>, pattern: RegExp = /row-level security|permission denied/) {
  await expect(p).rejects.toThrow(pattern);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  const dir = join(ROOT, 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  for (const [id, email, name] of [
    [A, 'owner-a@example.test', 'Owner A'],
    [B, 'outsider-b@example.test', 'Outsider B'],
    [C, 'viewer-c@example.test', 'Viewer C'],
  ]) {
    await db.query(`insert into auth.users (id, aud, role, email, raw_user_meta_data) values ($1, 'authenticated', 'authenticated', $2, $3)`, [
      id,
      email,
      JSON.stringify({ full_name: name }),
    ]);
  }
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe('migrations', () => {
  it('create profiles for new users and seed the shared factor library', async () => {
    await asAdmin();
    expect(await count(`public.profiles where id in ($1, $2, $3)`, [A, B, C])).toBe(3);
    expect(await count(`public.emission_factors where company_id is null`)).toBe(DEFAULT_FACTORS.length);
  });

  it('pass the RLS test suite (supabase/tests/rls_test.sql)', async () => {
    await asAdmin();
    const results = await db.exec(readFileSync(join(ROOT, 'tests', 'rls_test.sql'), 'utf8'));
    const last = results.filter((r) => r.rows.length).pop();
    expect(JSON.stringify(last?.rows)).toContain('ALL RLS TESTS PASSED');
  });
});

describe('app data flow (payloads from src/lib/data/remote.ts)', () => {
  let cid = '';
  let facilityId = '';
  let periodId = '';
  let activityId = '';
  let evidenceId = '';
  let runId = '';

  it('owner creates a company, facility and reporting period', async () => {
    await as(A);
    cid = (await db.query<{ id: string }>(`select public.create_company($1, $2, $3, $4, $5, $6, $7, false) as id`, ['Acme Forge', 'Metals', '11–50 employees', 'India', 'Maharashtra', 'Pune', ''])).rows[0].id;
    expect(await count(`public.company_members where company_id = $1 and user_id = $2 and role = 'owner'`, [cid, A])).toBe(1);

    const f = await insert('public.facilities', {
      company_id: cid,
      ...facilityRow({ name: 'Plant 1', address: 'MIDC', state: 'Maharashtra', city: 'Pune', facilityType: 'Manufacturing plant', industry: 'Metals', productionUnit: 't', annualCapacity: 1200 }),
    });
    facilityId = f.id as string;

    const p = await insert('public.carbon_assessments', {
      company_id: cid,
      ...periodRow({ label: 'FY 2025-26', startDate: '2025-04-01', endDate: '2026-03-31', status: 'open', methodologyVersion: METHODOLOGY_VERSION, scope3Exclusions: [] }),
    });
    periodId = p.id as string;
    expect(p.scope3_exclusions).toEqual([]);
  });

  it('owner updates the profile, onboarding step and Scope 3 boundary', async () => {
    await as(A);
    expect(await patch('public.companies', cid, orgProfileRow({ name: 'Acme Forge Pvt Ltd', industry: 'Metals', companySize: '11–50 employees', country: 'India', state: 'Maharashtra', city: 'Pune', website: 'https://acme.example' }))).toBe(1);
    expect(await patch('public.companies', cid, { onboarding_step: 3 })).toBe(1);
    expect(await patch('public.carbon_assessments', periodId, { scope3_exclusions: [{ category: 'employee_commuting', reason: 'Out of scope this year' }] })).toBe(1);
  });

  it('owner adds a user-supplied emission factor', async () => {
    await as(A);
    const lib = DEFAULT_FACTORS[0];
    await insert('public.emission_factors', factorRow({ ...lib, id: crypto.randomUUID(), factorCode: 'USER-1', origin: 'user', organizationId: cid }, cid));
    expect(await count(`public.emission_factors where company_id = $1`, [cid])).toBe(1);
  });

  it('editor-level writes: add, edit and review an activity record (client-generated id)', async () => {
    await as(A);
    activityId = crypto.randomUUID();
    const record: ActivityRecord = {
      id: activityId,
      organizationId: cid,
      facilityId,
      reportingPeriodId: periodId,
      category: 'purchased_electricity',
      subtype: 'grid',
      activityDate: '2025-04-01',
      quantity: 42000,
      unit: 'kWh',
      normalizedQuantity: 42000,
      normalizedUnit: 'kWh',
      distanceKm: null,
      weightTonnes: null,
      costAmount: 352800,
      currency: 'INR',
      dataQuality: 'measured',
      dataSource: 'manual',
      evidenceDocumentId: null,
      reviewStatus: 'unreviewed',
      notes: 'April bill',
      createdBy: A,
      createdAt: '',
      updatedAt: '',
    };
    const row = await insert('public.emission_activities', { id: activityId, company_id: cid, created_by: A, ...activityRow(record) });
    // The app maps the stored row back; values must survive the round trip.
    const back = toActivity({ ...row, quantity: Number(row.quantity), cost_amount: Number(row.cost_amount), normalized_quantity: Number(row.normalized_quantity) });
    expect(back).toMatchObject({ id: activityId, facilityId, reportingPeriodId: periodId, quantity: 42000, unit: 'kWh', costAmount: 352800, notes: 'April bill' });

    expect(await patch('public.emission_activities', activityId, activityRow({ ...record, quantity: 43000, notes: 'Corrected' }))).toBe(1);
    expect(await patch('public.emission_activities', activityId, { review_status: 'reviewed' })).toBe(1);
  });

  it('evidence: upload path is scoped to the company, attach to a record', async () => {
    await as(A);
    evidenceId = crypto.randomUUID();
    const path = `${cid}/${evidenceId}/bill.pdf`;
    await insert('storage.objects', { bucket_id: 'evidence', name: path, owner: A });
    await insert('public.evidence_documents', {
      id: evidenceId,
      company_id: cid,
      facility_id: facilityId,
      assessment_id: periodId,
      file_name: 'bill.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      storage_path: path,
      document_type: 'Electricity bill',
      uploaded_by: A,
    });
    expect(await patch('public.emission_activities', activityId, { evidence_document_id: evidenceId })).toBe(1);
    // A path outside the company folder is refused by the storage policy.
    await rejects(insert('storage.objects', { bucket_id: 'evidence', name: `not-a-company/${evidenceId}/x.pdf`, owner: A }));
  });

  it('saves a calculation run computed by the real engine (save_calculation_run)', async () => {
    await as(A);
    const activity = toActivity((await db.query<Row>(`select * from public.emission_activities where id = $1`, [activityId])).rows[0]);
    activity.quantity = Number(activity.quantity);
    const { results } = calculateAll(
      [{ id: activity.id, category: activity.category, subtype: activity.subtype, activityDate: activity.activityDate, quantity: activity.quantity, unit: activity.unit, dataQuality: activity.dataQuality, geography: 'IN', distanceKm: null, weightTonnes: null }],
      DEFAULT_FACTORS,
    );
    const run: CalculationRun = {
      id: crypto.randomUUID(),
      organizationId: cid,
      reportingPeriodId: periodId,
      engineVersion: ENGINE_VERSION,
      methodologyVersion: METHODOLOGY_VERSION,
      status: 'completed',
      createdBy: A,
      createdAt: new Date().toISOString(),
      inputs: [activity],
      results,
      summary: summarize(results),
      scope3Exclusions: [],
    };
    const args = runRpcArgs(run);
    runId = (
      await db.query<{ id: string }>(`select public.save_calculation_run($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb) as id`, [
        args.p_company_id,
        args.p_assessment_id,
        args.p_engine_version,
        args.p_methodology_version,
        args.p_status,
        JSON.stringify(args.p_summary),
        JSON.stringify(args.p_inputs),
        JSON.stringify(args.p_scope3_exclusions),
        JSON.stringify(args.p_results),
      ])
    ).rows[0].id;
    const stored = (await db.query<Row>(`select * from public.calculation_results where run_id = $1`, [runId])).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe(results[0].status);
    expect(stored[0].source_activity_id).toBe(activityId);
    expect(Number(stored[0].emissions_kg_co2e)).toBeCloseTo(results[0].emissionsKgCo2e!, 6);
  });

  it('reduction scenarios and reports', async () => {
    await as(A);
    const r = await insert('public.reduction_actions', {
      company_id: cid,
      ...reductionRow({
        facilityId,
        reportingPeriodId: periodId,
        actionType: 'solar',
        title: 'Rooftop solar',
        description: '',
        baselineLabel: 'Annual grid electricity',
        baselineUnit: 'kWh',
        inputs: { baselineQuantity: 500000, unitCost: 8.4, emissionFactorKgPerUnit: 0.727, reductionPct: 0, capex: 4200000, annualOperatingCost: 42000 },
        assumptions: '',
        limitations: '',
        status: 'proposed',
      }),
    });
    expect(await patch('public.reduction_actions', r.id as string, { status: 'in_progress' })).toBe(1);

    const rep = await insert('public.reports', { company_id: cid, assessment_id: periodId, calculation_run_id: runId, report_type: 'pdf', file_name: 'r.pdf', created_by: A });
    expect(await patch('public.reports', rep.id as string, { status: 'reviewed_internally' })).toBe(1);
  });

  it('a second user sees none of it and cannot change it', async () => {
    await as(B);
    for (const t of ['companies', 'company_members', 'facilities', 'carbon_assessments', 'emission_activities', 'evidence_documents', 'calculation_runs', 'calculation_results', 'reduction_actions', 'reports', 'audit_events']) {
      const col = t === 'companies' ? 'id' : 'company_id';
      expect(await count(`public.${t} where ${col} = $1`, [cid]), t).toBe(0);
    }
    expect(await count(`public.emission_factors where company_id = $1`, [cid])).toBe(0);
    expect(await count(`storage.objects where name like $1`, [`${cid}/%`])).toBe(0);
    expect(await patch('public.emission_activities', activityId, { notes: 'hacked' })).toBe(0);
    expect(await patch('public.companies', cid, { name: 'Hacked' })).toBe(0);
    expect((await db.query(`delete from public.facilities where id = $1`, [facilityId])).affectedRows).toBe(0);
    await rejects(insert('public.facilities', { company_id: cid, ...facilityRow({ name: 'Intruder', address: '', state: '', city: '', facilityType: '', industry: '', productionUnit: 'kg', annualCapacity: null }) }));
    await rejects(insert('storage.objects', { bucket_id: 'evidence', name: `${cid}/${crypto.randomUUID()}/x.pdf`, owner: B }));
  });

  it('a viewer reads the company but cannot write', async () => {
    await as(A);
    await insert('public.company_members', { company_id: cid, user_id: C, role: 'viewer' });
    await as(C);
    expect(await count(`public.emission_activities where company_id = $1`, [cid])).toBe(1);
    expect(await patch('public.emission_activities', activityId, { notes: 'viewer edit' })).toBe(0);
    await rejects(insert('public.emission_activities', { id: crypto.randomUUID(), company_id: cid, created_by: C, facility_id: facilityId, assessment_id: periodId, category: 'waste', subtype: 'x', activity_date: '2025-05-01', unit: 't', data_quality: 'measured', data_source: 'manual' }));
  });

  it('deletes keep history intact: evidence detaches, results keep their snapshot', async () => {
    await as(A);
    await db.query(`delete from public.evidence_documents where id = $1`, [evidenceId]);
    const act = (await db.query<Row>(`select evidence_document_id from public.emission_activities where id = $1`, [activityId])).rows[0];
    expect(act.evidence_document_id).toBeNull();

    expect((await db.query(`delete from public.emission_activities where id = $1`, [activityId])).affectedRows).toBe(1);
    const res = (await db.query<Row>(`select activity_id, source_activity_id, factor_snapshot from public.calculation_results where run_id = $1`, [runId])).rows[0];
    expect(res.activity_id).toBeNull();
    expect(res.source_activity_id).toBe(activityId);
    expect(res.factor_snapshot).not.toBeNull();

    // Owner can delete the now-unused facility; audit history was written by triggers.
    expect((await db.query(`delete from public.facilities where id = $1`, [facilityId])).affectedRows).toBe(1);
    expect(await count(`public.audit_events where company_id = $1`, [cid])).toBeGreaterThan(5);
  });

  it('an import that is rolled back (company deleted) leaves nothing behind', async () => {
    await as(A);
    const tmp = (await db.query<{ id: string }>(`select public.create_company('Import Test', '', '', 'India', '', '', '', false) as id`)).rows[0].id;
    const f = await insert('public.facilities', { id: crypto.randomUUID(), company_id: tmp, ...facilityRow({ name: 'Old plant', address: '', state: '', city: '', facilityType: '', industry: '', productionUnit: 'kg', annualCapacity: null }) });
    const p = await insert('public.carbon_assessments', { id: crypto.randomUUID(), company_id: tmp, ...periodRow({ label: 'FY', startDate: '2024-04-01', endDate: '2025-03-31', status: 'open', methodologyVersion: 'x', scope3Exclusions: [] }) });
    await insert('public.emission_activities', { id: crypto.randomUUID(), company_id: tmp, created_by: A, facility_id: f.id, assessment_id: p.id, category: 'production', subtype: 'output', activity_date: '2024-04-01', quantity: 1, unit: 'kg', data_quality: 'measured', data_source: 'manual' });
    expect((await db.query(`delete from public.companies where id = $1`, [tmp])).affectedRows).toBe(1);
    await asAdmin();
    for (const t of ['facilities', 'carbon_assessments', 'emission_activities', 'company_members']) {
      expect(await count(`public.${t} where company_id = $1`, [tmp]), t).toBe(0);
    }
  });

  it('sample organisations are flagged and accept sample factors', async () => {
    await as(A);
    const sid = (await db.query<{ id: string }>(`select public.create_company('Sample Textiles Co. (illustrative)', '', '', 'India', '', '', '', true) as id`)).rows[0].id;
    const row = (await db.query<Row>(`select is_sample, onboarding_step from public.companies where id = $1`, [sid])).rows[0];
    expect(row).toEqual({ is_sample: true, onboarding_step: 4 });
    const lib = DEFAULT_FACTORS[0];
    await insert('public.emission_factors', factorRow({ ...lib, id: crypto.randomUUID(), factorCode: 'SAMPLE-1', origin: 'sample', organizationId: sid }, sid));
  });

  it('guests (anonymous Supabase sign-ins) get a private workspace of their own', async () => {
    // Supabase signs guests in with role "authenticated" and is_anonymous = true in the JWT.
    const G = '00000000-0000-4000-8000-0000000000d1';
    await asAdmin();
    await db.query(`insert into auth.users (id, aud, role) values ($1, 'authenticated', 'authenticated')`, [G]);
    await db.exec('set role authenticated');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: G, role: 'authenticated', is_anonymous: true })]);
    const gid = (await db.query<{ id: string }>(`select public.create_company('Guest Co', '', '', 'India', '', '', '', false) as id`)).rows[0].id;
    await insert('public.facilities', { company_id: gid, ...facilityRow({ name: 'Guest plant', address: '', state: '', city: '', facilityType: '', industry: '', productionUnit: 'kg', annualCapacity: null }) });
    expect(await count(`public.companies`)).toBe(1); // only their own
    // …and other users still can't see it.
    await as(A);
    expect(await count(`public.companies where id = $1`, [gid])).toBe(0);
  });

  it('anonymous visitors cannot create companies or read data', async () => {
    await as(null);
    // Supabase's default privileges let anon execute the function; it refuses callers without a user id.
    await rejects(db.query(`select public.create_company('x', '', '', 'India', '', '', '', false)`), /Not signed in|permission denied/);
    await rejects(db.query(`select * from public.companies`));
  });
});
