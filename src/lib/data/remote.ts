// Supabase repository: maps app records (types.ts) to and from the tables in
// supabase/migrations, loads everything the signed-in user can see, and wraps
// the writes. Row Level Security decides what each call may read or change;
// the app's own role checks only exist to give a friendly message first.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalculationResult, EmissionFactor } from '@/lib/engine/types';
import type { RunSummary } from '@/lib/engine/calculate';
import type {
  ActivityRecord,
  AuditEvent,
  CalculationRun,
  DB,
  EvidenceDocument,
  Facility,
  Membership,
  Organization,
  ReductionAction,
  Report,
  ReportingPeriod,
  User,
} from './types';

type Row = Record<string, unknown>;

/** Postgres timestamps come back as "…+00:00"; the app compares ISO strings, so normalise them. */
export const ts = (v: unknown): string => (v ? new Date(v as string).toISOString() : new Date(0).toISOString());
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export class RemoteError extends Error {}

/** Turns a PostgREST / Storage error into a message a user can act on. */
export function friendly(e: { message?: string; code?: string } | null | undefined, fallback = 'Something went wrong.'): RemoteError {
  const code = e?.code;
  if (code === '42501' || /row-level security|permission denied/i.test(e?.message ?? '')) {
    return new RemoteError('You do not have permission to make this change.');
  }
  if (code === '23503') return new RemoteError('This item is still referenced by other records.');
  if (code === '23505') return new RemoteError('A record with the same details already exists.');
  if (code === '23514') return new RemoteError('Some values are not allowed. Check the form and try again.');
  if (/Failed to fetch|NetworkError|fetch failed/i.test(e?.message ?? '')) {
    return new RemoteError('Could not reach the server. Check your connection and try again — your change was not saved.');
  }
  return new RemoteError(e?.message || fallback);
}

/** Throws a friendly error, otherwise returns the data (non-null once there is no error). */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }, fallback?: string): NonNullable<T> {
  if (res.error) throw friendly(res.error, fallback);
  return res.data as NonNullable<T>;
}

// ── Row → app record ────────────────────────────────────────────────────────

export const toUser = (r: Row): User => ({ id: str(r.id), email: str(r.email), name: str(r.full_name), createdAt: ts(r.created_at) });

export const toOrganization = (r: Row): Organization => ({
  id: str(r.id),
  name: str(r.name),
  industry: str(r.industry),
  companySize: str(r.company_size),
  country: str(r.country),
  state: str(r.state),
  city: str(r.city),
  website: str(r.website),
  isSample: Boolean(r.is_sample),
  onboardingStep: Number(r.onboarding_step ?? 0),
  createdAt: ts(r.created_at),
});

export const toMembership = (r: Row): Membership => ({
  organizationId: str(r.company_id),
  userId: str(r.user_id),
  role: r.role as Membership['role'],
  createdAt: ts(r.created_at),
});

export const toFacility = (r: Row): Facility => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  name: str(r.name),
  address: str(r.address),
  state: str(r.state),
  city: str(r.city),
  facilityType: str(r.facility_type),
  industry: str(r.industry),
  productionUnit: str(r.production_unit),
  annualCapacity: num(r.annual_capacity),
  createdAt: ts(r.created_at),
});

export const toPeriod = (r: Row): ReportingPeriod => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  label: str(r.label),
  startDate: str(r.start_date),
  endDate: str(r.end_date),
  status: r.status as ReportingPeriod['status'],
  methodologyVersion: str(r.methodology_version),
  scope3Exclusions: (r.scope3_exclusions as ReportingPeriod['scope3Exclusions']) ?? [],
  createdAt: ts(r.created_at),
});

export const toActivity = (r: Row): ActivityRecord => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  facilityId: str(r.facility_id),
  reportingPeriodId: str(r.assessment_id),
  category: r.category as ActivityRecord['category'],
  subtype: str(r.subtype),
  activityDate: str(r.activity_date),
  quantity: num(r.quantity),
  unit: str(r.unit),
  normalizedQuantity: num(r.normalized_quantity),
  normalizedUnit: (r.normalized_unit as string | null) ?? null,
  distanceKm: num(r.distance_km),
  weightTonnes: num(r.weight_tonnes),
  costAmount: num(r.cost_amount),
  currency: str(r.currency) || 'INR',
  dataQuality: r.data_quality as ActivityRecord['dataQuality'],
  dataSource: r.data_source as ActivityRecord['dataSource'],
  evidenceDocumentId: (r.evidence_document_id as string | null) ?? null,
  reviewStatus: r.review_status as ActivityRecord['reviewStatus'],
  notes: str(r.notes),
  createdBy: str(r.created_by),
  createdAt: ts(r.created_at),
  updatedAt: ts(r.updated_at),
});

export const toEvidence = (r: Row): EvidenceDocument => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  facilityId: (r.facility_id as string | null) ?? null,
  reportingPeriodId: (r.assessment_id as string | null) ?? null,
  fileName: str(r.file_name),
  mimeType: str(r.mime_type),
  sizeBytes: Number(r.size_bytes ?? 0),
  storagePath: str(r.storage_path),
  documentType: str(r.document_type),
  reviewStatus: r.review_status as EvidenceDocument['reviewStatus'],
  uploadedBy: str(r.uploaded_by),
  createdAt: ts(r.created_at),
});

export const toFactor = (r: Row): EmissionFactor => ({
  id: str(r.id),
  factorCode: str(r.factor_code),
  category: r.category as EmissionFactor['category'],
  subtype: str(r.subtype),
  activityUnit: str(r.activity_unit),
  components: r.components as EmissionFactor['components'],
  factorUnit: str(r.factor_unit),
  geography: str(r.geography),
  validFrom: str(r.valid_from),
  validTo: (r.valid_to as string | null) ?? null,
  publicationYear: Number(r.publication_year),
  sourceName: str(r.source_name),
  sourceUrl: str(r.source_url),
  methodology: str(r.methodology),
  version: str(r.version),
  gwpReference: r.gwp_reference as EmissionFactor['gwpReference'],
  reviewStatus: r.review_status as EmissionFactor['reviewStatus'],
  ...(r.conversions ? { conversions: r.conversions as EmissionFactor['conversions'] } : {}),
  notes: str(r.notes),
  origin: r.origin as EmissionFactor['origin'],
  organizationId: (r.company_id as string | null) ?? null,
});

export const toResult = (r: Row): CalculationResult => ({
  activityId: str(r.source_activity_id),
  scope: (num(r.scope) as CalculationResult['scope']) ?? null,
  category: r.category as CalculationResult['category'],
  subtype: str(r.subtype),
  status: r.status as CalculationResult['status'],
  inputQuantity: num(r.input_quantity),
  inputUnit: str(r.input_unit),
  normalizedQuantity: num(r.normalized_quantity),
  normalizedUnit: (r.normalized_unit as string | null) ?? null,
  emissionsKgCo2e: num(r.emissions_kg_co2e),
  gases: (r.gases as CalculationResult['gases']) ?? [],
  factor: (r.factor_snapshot as CalculationResult['factor']) ?? null,
  warnings: (r.warnings as string[]) ?? [],
});

export const toRun = (r: Row, results: CalculationResult[]): CalculationRun => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  reportingPeriodId: str(r.assessment_id),
  engineVersion: str(r.engine_version),
  methodologyVersion: str(r.methodology_version),
  status: r.status as CalculationRun['status'],
  createdBy: str(r.created_by),
  createdAt: ts(r.created_at),
  inputs: (r.inputs as ActivityRecord[]) ?? [],
  results,
  summary: r.summary as RunSummary,
  scope3Exclusions: (r.scope3_exclusions as CalculationRun['scope3Exclusions']) ?? [],
});

export const toReduction = (r: Row): ReductionAction => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  facilityId: (r.facility_id as string | null) ?? null,
  reportingPeriodId: str(r.assessment_id),
  actionType: r.action_type as ReductionAction['actionType'],
  title: str(r.title),
  description: str(r.description),
  baselineLabel: str(r.baseline_label),
  baselineUnit: str(r.baseline_unit),
  inputs: r.inputs as ReductionAction['inputs'],
  assumptions: str(r.assumptions),
  limitations: str(r.limitations),
  status: r.status as ReductionAction['status'],
  createdAt: ts(r.created_at),
  updatedAt: ts(r.updated_at),
});

export const toReport = (r: Row): Report => ({
  id: str(r.id),
  organizationId: str(r.company_id),
  reportingPeriodId: str(r.assessment_id),
  calculationRunId: str(r.calculation_run_id),
  reportType: r.report_type as Report['reportType'],
  status: r.status as Report['status'],
  fileName: str(r.file_name),
  generatedAt: ts(r.generated_at),
  createdBy: str(r.created_by),
});

export const toAudit = (r: Row): AuditEvent => ({
  id: str(r.id),
  organizationId: (r.company_id as string | null) ?? null,
  userId: (r.user_id as string | null) ?? null,
  action: str(r.action),
  entityType: str(r.entity_type),
  entityId: (r.entity_id as string | null) ?? null,
  summary: str(r.summary),
  createdAt: ts(r.created_at),
});

// ── App record → row (insert / update payloads) ─────────────────────────────

export const orgProfileRow = (o: Pick<Organization, 'name' | 'industry' | 'companySize' | 'country' | 'state' | 'city' | 'website'>) => ({
  name: o.name,
  industry: o.industry,
  company_size: o.companySize,
  country: o.country,
  state: o.state,
  city: o.city,
  website: o.website,
});

export const facilityRow = (f: Omit<Facility, 'id' | 'organizationId' | 'createdAt'>) => ({
  name: f.name,
  address: f.address,
  state: f.state,
  city: f.city,
  facility_type: f.facilityType,
  industry: f.industry,
  production_unit: f.productionUnit,
  annual_capacity: f.annualCapacity,
});

export const periodRow = (p: Pick<ReportingPeriod, 'label' | 'startDate' | 'endDate' | 'status' | 'methodologyVersion' | 'scope3Exclusions'>) => ({
  label: p.label,
  start_date: p.startDate,
  end_date: p.endDate,
  status: p.status,
  methodology_version: p.methodologyVersion,
  scope3_exclusions: p.scope3Exclusions,
});

/** Updatable activity columns (the RLS migration grants exactly these). */
export const activityRow = (a: Omit<ActivityRecord, 'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => ({
  facility_id: a.facilityId,
  assessment_id: a.reportingPeriodId,
  category: a.category,
  subtype: a.subtype,
  activity_date: a.activityDate,
  quantity: a.quantity,
  unit: a.unit,
  normalized_quantity: a.normalizedQuantity,
  normalized_unit: a.normalizedUnit,
  distance_km: a.distanceKm,
  weight_tonnes: a.weightTonnes,
  cost_amount: a.costAmount,
  currency: a.currency,
  data_quality: a.dataQuality,
  data_source: a.dataSource,
  evidence_document_id: a.evidenceDocumentId,
  review_status: a.reviewStatus,
  notes: a.notes,
});

export const factorRow = (f: EmissionFactor, companyId: string) => ({
  id: f.id,
  company_id: companyId,
  factor_code: f.factorCode,
  category: f.category,
  subtype: f.subtype,
  activity_unit: f.activityUnit,
  components: f.components,
  factor_unit: f.factorUnit,
  geography: f.geography,
  valid_from: f.validFrom,
  valid_to: f.validTo,
  publication_year: f.publicationYear,
  source_name: f.sourceName,
  source_url: f.sourceUrl,
  methodology: f.methodology,
  version: f.version,
  gwp_reference: f.gwpReference,
  review_status: f.reviewStatus,
  origin: f.origin,
  conversions: f.conversions ?? null,
  notes: f.notes ?? '',
});

export const reductionRow = (a: Omit<ReductionAction, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => ({
  facility_id: a.facilityId,
  assessment_id: a.reportingPeriodId,
  action_type: a.actionType,
  title: a.title,
  description: a.description,
  baseline_label: a.baselineLabel,
  baseline_unit: a.baselineUnit,
  inputs: a.inputs,
  assumptions: a.assumptions,
  limitations: a.limitations,
  status: a.status,
});

// ── Loading ─────────────────────────────────────────────────────────────────

const PAGE = 1000; // PostgREST's default max rows per request.

/** Fetch every row of a query, page by page. */
async function all(build: () => { range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }> }): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await build().range(from, from + PAGE - 1);
    const rows = check(res, 'Could not load your data.') ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Everything the signed-in user can see. RLS limits each table to their companies. */
export async function fetchAll(sb: SupabaseClient): Promise<Omit<DB, 'session' | 'version'>> {
  const [profiles, companies, members, facilities, periods, activities, evidence, factors, runs, results, reductions, reports, audit] = await Promise.all([
    all(() => sb.from('profiles').select('*').order('created_at')),
    all(() => sb.from('companies').select('*').order('created_at')),
    all(() => sb.from('company_members').select('*').order('created_at')),
    all(() => sb.from('facilities').select('*').order('created_at')),
    all(() => sb.from('carbon_assessments').select('*').order('start_date', { ascending: false })),
    all(() => sb.from('emission_activities').select('*').order('activity_date').order('id')),
    all(() => sb.from('evidence_documents').select('*').order('created_at')),
    // Company factors only: the shared library is the tested set in src/lib/engine/factors.ts
    // (the database copy is generated from it by scripts/generate-factor-seed.ts).
    all(() => sb.from('emission_factors').select('*').not('company_id', 'is', null).order('created_at')),
    all(() => sb.from('calculation_runs').select('*').order('created_at')),
    all(() => sb.from('calculation_results').select('*').order('run_id').order('id')),
    all(() => sb.from('reduction_actions').select('*').order('created_at')),
    all(() => sb.from('reports').select('*').order('generated_at', { ascending: false })),
    // Recent history only: the audit log can grow without limit.
    sb
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then((r) => check(r, 'Could not load the activity history.') ?? []),
  ]);

  const byRun = new Map<string, CalculationResult[]>();
  for (const r of results) {
    const list = byRun.get(str(r.run_id)) ?? [];
    list.push(toResult(r));
    byRun.set(str(r.run_id), list);
  }

  return {
    users: profiles.map(toUser),
    organizations: companies.map(toOrganization),
    memberships: members.map(toMembership),
    facilities: facilities.map(toFacility),
    periods: periods.map(toPeriod),
    activities: activities.map(toActivity),
    evidence: evidence.map(toEvidence),
    factors: factors.map(toFactor),
    runs: runs.map((r) => toRun(r, byRun.get(str(r.id)) ?? [])),
    reductionActions: reductions.map(toReduction),
    reports: reports.map(toReport),
    audit: (audit as Row[]).map(toAudit),
  };
}

export async function fetchAudit(sb: SupabaseClient, companyId: string): Promise<AuditEvent[]> {
  const rows = check(await sb.from('audit_events').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500));
  return (rows ?? []).map(toAudit);
}

/** Run payload for save_calculation_run (one transaction: run + every result row). */
export function runRpcArgs(run: CalculationRun) {
  return {
    p_company_id: run.organizationId,
    p_assessment_id: run.reportingPeriodId,
    p_engine_version: run.engineVersion,
    p_methodology_version: run.methodologyVersion,
    p_status: run.status,
    p_summary: run.summary,
    p_inputs: run.inputs,
    p_scope3_exclusions: run.scope3Exclusions,
    p_results: run.results,
  };
}

/** Insert rows in chunks so very large imports stay under request-size limits. */
export async function insertChunked(sb: SupabaseClient, table: string, rows: Row[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    check(await sb.from(table).insert(rows.slice(i, i + size)), `Could not save ${table.replace(/_/g, ' ')}.`);
  }
}

export const EVIDENCE_BUCKET = 'evidence';

/** Storage object names can't contain some characters; keep the name readable but safe. */
export const safeFileName = (name: string) => name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'file';
