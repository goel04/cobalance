import { calculateAll, ENGINE_VERSION, METHODOLOGY_VERSION, selectFactor, summarize } from '@/lib/engine/calculate';
import { DEFAULT_FACTORS } from '@/lib/engine/factors';
import { convert } from '@/lib/engine/units';
import type { ActivityInput, EmissionFactor } from '@/lib/engine/types';
import { getDb, update, emptyDb, replaceDb } from './store';
import { clearFiles, deleteFile, putFile } from './evidence-files';
import type {
  ActivityRecord,
  CalculationRun,
  DB,
  EvidenceDocument,
  Facility,
  Organization,
  ReductionAction,
  Report,
  ReportingPeriod,
  Role,
  Scope3Exclusion,
} from './types';

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export class PermissionError extends Error {}

const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleOf(d: DB, orgId: string | null, userId: string | null): Role | null {
  if (!orgId || !userId) return null;
  return d.memberships.find((m) => m.organizationId === orgId && m.userId === userId)?.role ?? null;
}

export const canEdit = (role: Role | null) => role !== null && ROLE_RANK[role] >= ROLE_RANK.editor;
export const canAdmin = (role: Role | null) => role !== null && ROLE_RANK[role] >= ROLE_RANK.admin;

/** Organisation-level authorisation: the demo equivalent of the planned RLS policies. */
function requireRole(d: DB, orgId: string, min: Role): string {
  const userId = d.session.userId;
  const role = roleOf(d, orgId, userId);
  if (!userId || !role) throw new PermissionError('You are not a member of this organisation.');
  if (ROLE_RANK[role] < ROLE_RANK[min]) throw new PermissionError(`This action needs the ${min} role or higher.`);
  return userId;
}

function audit(d: DB, organizationId: string | null, action: string, entityType: string, entityId: string | null, summary: string) {
  d.audit.unshift({ id: uid(), organizationId, userId: d.session.userId, action, entityType, entityId, summary, createdAt: now() });
  if (d.audit.length > 2000) d.audit.length = 2000;
}

export function geographyOf(org: Pick<Organization, 'country'> | undefined): string {
  return org?.country === 'India' ? 'IN' : 'GLOBAL';
}

export function factorsFor(d: DB, orgId: string | null): EmissionFactor[] {
  return [...DEFAULT_FACTORS, ...d.factors.filter((f) => f.organizationId === orgId)];
}

export function toEngineInput(r: ActivityRecord, geography: string): ActivityInput {
  return {
    id: r.id,
    category: r.category,
    subtype: r.subtype,
    activityDate: r.activityDate,
    quantity: r.quantity,
    unit: r.unit,
    dataQuality: r.dataQuality,
    geography,
    distanceKm: r.distanceKm,
    weightTonnes: r.weightTonnes,
  };
}

/** Normalised quantity in the unit expected by the currently applicable factor (original values are kept). */
export function normalize(d: DB, r: ActivityRecord): Pick<ActivityRecord, 'normalizedQuantity' | 'normalizedUnit'> {
  const org = d.organizations.find((o) => o.id === r.organizationId);
  const input = toEngineInput(r, geographyOf(org));
  const qty = r.distanceKm != null && r.weightTonnes != null ? r.distanceKm * r.weightTonnes : r.quantity;
  const f = selectFactor(input, factorsFor(d, r.organizationId));
  if (qty == null || !f) return { normalizedQuantity: null, normalizedUnit: null };
  const c = convert(qty, r.unit, f.activityUnit, f.conversions);
  return c.ok ? { normalizedQuantity: c.value, normalizedUnit: f.activityUnit } : { normalizedQuantity: null, normalizedUnit: null };
}

// ── Auth (demo) ────────────────────────────────────────────────────────────

async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`cobalance-demo:${email.toLowerCase()}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signUp(name: string, email: string, password: string) {
  const e = email.trim().toLowerCase();
  if (getDb().users.some((u) => u.email === e)) throw new Error('An account with this email already exists in this browser. Log in instead.');
  const passwordHash = await hashPassword(e, password);
  update((d) => {
    const id = uid();
    d.users.push({ id, email: e, name: name.trim(), passwordHash, createdAt: now() });
    d.session = { userId: id, organizationId: null, periodId: null, facilityId: 'all' };
    audit(d, null, 'user.signup', 'user', id, `Account created for ${e}`);
  });
}

export async function logIn(email: string, password: string) {
  const e = email.trim().toLowerCase();
  const user = getDb().users.find((u) => u.email === e);
  if (!user || user.passwordHash !== (await hashPassword(e, password))) throw new Error('Incorrect email or password.');
  update((d) => {
    const m = d.memberships.find((x) => x.userId === user.id && !d.organizations.find((o) => o.id === x.organizationId)?.isSample)
      ?? d.memberships.find((x) => x.userId === user.id);
    const periodId = m ? latestPeriodId(d, m.organizationId) : null;
    d.session = { userId: user.id, organizationId: m?.organizationId ?? null, periodId, facilityId: 'all' };
    audit(d, null, 'user.login', 'user', user.id, `Logged in`);
  });
}

export function logOut() {
  update((d) => {
    d.session = { userId: null, organizationId: null, periodId: null, facilityId: 'all' };
  });
}

function latestPeriodId(d: DB, orgId: string): string | null {
  const ps = d.periods.filter((p) => p.organizationId === orgId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return ps[0]?.id ?? null;
}

// ── Session context ────────────────────────────────────────────────────────

export function switchOrganization(orgId: string) {
  update((d) => {
    requireRole(d, orgId, 'viewer');
    d.session.organizationId = orgId;
    d.session.periodId = latestPeriodId(d, orgId);
    d.session.facilityId = 'all';
  });
}

export function setPeriod(periodId: string) {
  update((d) => {
    d.session.periodId = periodId;
  });
}

export function setFacilityFilter(facilityId: string) {
  update((d) => {
    d.session.facilityId = facilityId;
  });
}

// ── Organisations ──────────────────────────────────────────────────────────

export type OrgInput = Pick<Organization, 'name' | 'industry' | 'companySize' | 'country' | 'state' | 'city' | 'website'>;

export function createOrganization(input: OrgInput): string {
  return update((d) => {
    const userId = d.session.userId;
    if (!userId) throw new PermissionError('Please log in first.');
    const id = uid();
    d.organizations.push({ id, ...input, isSample: false, onboardingStep: 1, createdAt: now() });
    d.memberships.push({ organizationId: id, userId, role: 'owner', createdAt: now() });
    d.session.organizationId = id;
    d.session.periodId = null;
    audit(d, id, 'organization.create', 'organization', id, `Organisation "${input.name}" created`);
    return id;
  });
}

export function updateOrganization(orgId: string, input: OrgInput) {
  update((d) => {
    requireRole(d, orgId, 'admin');
    const o = d.organizations.find((x) => x.id === orgId)!;
    Object.assign(o, input);
    audit(d, orgId, 'organization.update', 'organization', orgId, 'Organisation profile updated');
  });
}

export function setOnboardingStep(orgId: string, step: number) {
  update((d) => {
    requireRole(d, orgId, 'editor');
    const o = d.organizations.find((x) => x.id === orgId)!;
    o.onboardingStep = Math.max(o.onboardingStep, step);
  });
}

// ── Facilities ─────────────────────────────────────────────────────────────

export type FacilityInput = Omit<Facility, 'id' | 'organizationId' | 'createdAt'>;

export function createFacility(orgId: string, input: FacilityInput): string {
  return update((d) => {
    requireRole(d, orgId, 'editor');
    const id = uid();
    d.facilities.push({ id, organizationId: orgId, ...input, createdAt: now() });
    audit(d, orgId, 'facility.create', 'facility', id, `Facility "${input.name}" created`);
    return id;
  });
}

export function updateFacility(id: string, input: FacilityInput) {
  update((d) => {
    const f = d.facilities.find((x) => x.id === id)!;
    requireRole(d, f.organizationId, 'editor');
    Object.assign(f, input);
    audit(d, f.organizationId, 'facility.update', 'facility', id, `Facility "${input.name}" updated`);
  });
}

export function deleteFacility(id: string) {
  update((d) => {
    const f = d.facilities.find((x) => x.id === id)!;
    requireRole(d, f.organizationId, 'admin');
    if (d.activities.some((a) => a.facilityId === id)) throw new Error('This facility has activity records. Delete or move them first.');
    d.facilities = d.facilities.filter((x) => x.id !== id);
    if (d.session.facilityId === id) d.session.facilityId = 'all';
    audit(d, f.organizationId, 'facility.delete', 'facility', id, `Facility "${f.name}" deleted`);
  });
}

// ── Reporting periods ──────────────────────────────────────────────────────

export function createPeriod(orgId: string, input: Pick<ReportingPeriod, 'label' | 'startDate' | 'endDate'>): string {
  if (input.endDate <= input.startDate) throw new Error('End date must be after start date.');
  return update((d) => {
    requireRole(d, orgId, 'admin');
    const id = uid();
    d.periods.push({ id, organizationId: orgId, ...input, status: 'open', methodologyVersion: METHODOLOGY_VERSION, scope3Exclusions: [], createdAt: now() });
    d.session.periodId = id;
    audit(d, orgId, 'period.create', 'reporting_period', id, `Reporting period ${input.label} created`);
    return id;
  });
}

export function setScope3Exclusions(periodId: string, exclusions: Scope3Exclusion[]) {
  update((d) => {
    const p = d.periods.find((x) => x.id === periodId)!;
    requireRole(d, p.organizationId, 'admin');
    p.scope3Exclusions = exclusions;
    audit(d, p.organizationId, 'period.boundary', 'reporting_period', periodId, `Scope 3 boundary updated (${exclusions.length} excluded)`);
  });
}

// ── Activity records ───────────────────────────────────────────────────────

export type ActivityDraft = Omit<
  ActivityRecord,
  'id' | 'organizationId' | 'normalizedQuantity' | 'normalizedUnit' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

export function saveActivity(orgId: string, draft: ActivityDraft, id?: string): string {
  return update((d) => {
    const userId = requireRole(d, orgId, 'editor');
    if (id) {
      const r = d.activities.find((x) => x.id === id && x.organizationId === orgId);
      if (!r) throw new Error('Record not found.');
      Object.assign(r, draft, { updatedAt: now() });
      Object.assign(r, normalize(d, r));
      audit(d, orgId, 'activity.update', 'activity_record', id, `Updated ${draft.category}/${draft.subtype} for ${draft.activityDate}`);
      return id;
    }
    const rec: ActivityRecord = {
      ...draft,
      id: uid(),
      organizationId: orgId,
      normalizedQuantity: null,
      normalizedUnit: null,
      createdBy: userId,
      createdAt: now(),
      updatedAt: now(),
    };
    Object.assign(rec, normalize(d, rec));
    d.activities.push(rec);
    audit(d, orgId, 'activity.create', 'activity_record', rec.id, `Added ${draft.category}/${draft.subtype} for ${draft.activityDate}`);
    return rec.id;
  });
}

export function importActivities(orgId: string, drafts: ActivityDraft[]): number {
  return update((d) => {
    const userId = requireRole(d, orgId, 'editor');
    for (const draft of drafts) {
      const rec: ActivityRecord = { ...draft, id: uid(), organizationId: orgId, normalizedQuantity: null, normalizedUnit: null, createdBy: userId, createdAt: now(), updatedAt: now() };
      Object.assign(rec, normalize(d, rec));
      d.activities.push(rec);
    }
    audit(d, orgId, 'activity.import', 'activity_record', null, `Imported ${drafts.length} records from CSV`);
    return drafts.length;
  });
}

export function deleteActivity(id: string) {
  update((d) => {
    const r = d.activities.find((x) => x.id === id)!;
    requireRole(d, r.organizationId, 'editor');
    d.activities = d.activities.filter((x) => x.id !== id);
    audit(d, r.organizationId, 'activity.delete', 'activity_record', id, `Deleted ${r.category}/${r.subtype} for ${r.activityDate}`);
  });
}

export function setActivityReview(id: string, status: ActivityRecord['reviewStatus']) {
  update((d) => {
    const r = d.activities.find((x) => x.id === id)!;
    requireRole(d, r.organizationId, 'admin');
    r.reviewStatus = status;
    r.updatedAt = now();
    audit(d, r.organizationId, 'activity.review', 'activity_record', id, `Marked ${status}`);
  });
}

/** Duplicate = same facility, category, subtype and month. */
export function findDuplicate(d: DB, orgId: string, r: Pick<ActivityRecord, 'facilityId' | 'category' | 'subtype' | 'activityDate'>, ignoreId?: string) {
  return d.activities.find(
    (a) =>
      a.organizationId === orgId &&
      a.id !== ignoreId &&
      a.facilityId === r.facilityId &&
      a.category === r.category &&
      a.subtype === r.subtype &&
      a.activityDate.slice(0, 7) === r.activityDate.slice(0, 7),
  );
}

// ── Evidence ───────────────────────────────────────────────────────────────

export async function uploadEvidence(
  orgId: string,
  file: File,
  meta: { facilityId: string | null; reportingPeriodId: string | null; documentType: string; attachToActivityId?: string },
): Promise<string> {
  requireRole(getDb(), orgId, 'editor');
  if (file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
  const id = uid();
  const storagePath = `${orgId}/${id}/${file.name}`;
  await putFile(storagePath, file);
  update((d) => {
    const userId = requireRole(d, orgId, 'editor');
    const doc: EvidenceDocument = {
      id,
      organizationId: orgId,
      facilityId: meta.facilityId,
      reportingPeriodId: meta.reportingPeriodId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath,
      documentType: meta.documentType,
      reviewStatus: 'unreviewed',
      uploadedBy: userId,
      createdAt: now(),
    };
    d.evidence.push(doc);
    if (meta.attachToActivityId) {
      const a = d.activities.find((x) => x.id === meta.attachToActivityId && x.organizationId === orgId);
      if (a) {
        a.evidenceDocumentId = id;
        a.updatedAt = now();
      }
    }
    audit(d, orgId, 'evidence.upload', 'evidence_document', id, `Uploaded ${file.name}`);
  });
  return id;
}

export async function deleteEvidence(id: string) {
  const doc = getDb().evidence.find((e) => e.id === id);
  if (!doc) return;
  requireRole(getDb(), doc.organizationId, 'editor');
  await deleteFile(doc.storagePath).catch(() => undefined);
  update((d) => {
    d.evidence = d.evidence.filter((e) => e.id !== id);
    d.activities.forEach((a) => {
      if (a.evidenceDocumentId === id) a.evidenceDocumentId = null;
    });
    audit(d, doc.organizationId, 'evidence.delete', 'evidence_document', id, `Deleted ${doc.fileName}`);
  });
}

// ── Emission factors ───────────────────────────────────────────────────────

export function addCustomFactor(orgId: string, f: Omit<EmissionFactor, 'id' | 'origin' | 'organizationId'>): string {
  return update((d) => {
    requireRole(d, orgId, 'admin');
    const id = uid();
    d.factors.push({ ...f, id, origin: 'user', organizationId: orgId });
    audit(d, orgId, 'factor.create', 'emission_factor', id, `Added factor ${f.factorCode} (${f.version})`);
    return id;
  });
}

/** Factors are never edited in place: retiring keeps history intact for past runs. */
export function retireFactor(id: string) {
  update((d) => {
    const f = d.factors.find((x) => x.id === id)!;
    requireRole(d, f.organizationId!, 'admin');
    f.reviewStatus = 'retired';
    audit(d, f.organizationId!, 'factor.retire', 'emission_factor', id, `Retired factor ${f.factorCode} (${f.version})`);
  });
}

export function setFactorStatus(id: string, status: 'approved' | 'provisional') {
  update((d) => {
    const f = d.factors.find((x) => x.id === id)!;
    requireRole(d, f.organizationId!, 'admin');
    f.reviewStatus = status;
    audit(d, f.organizationId!, 'factor.review', 'emission_factor', id, `Factor ${f.factorCode} marked ${status}`);
  });
}

// ── Calculation runs ───────────────────────────────────────────────────────

export function createCalculationRun(orgId: string, periodId: string): string {
  return update((d) => runInto(d, orgId, periodId));
}

export function runInto(d: DB, orgId: string, periodId: string): string {
  const userId = requireRole(d, orgId, 'editor');
  const org = d.organizations.find((o) => o.id === orgId)!;
  const period = d.periods.find((p) => p.id === periodId && p.organizationId === orgId);
  if (!period) throw new Error('Reporting period not found.');
  const inputs = d.activities.filter((a) => a.organizationId === orgId && a.reportingPeriodId === periodId);
  const geography = geographyOf(org);
  const { results } = calculateAll(inputs.map((r) => toEngineInput(r, geography)), factorsFor(d, orgId));
  // Activities in categories excluded from the boundary are not counted.
  const excluded = new Set(period.scope3Exclusions.map((x) => x.category));
  for (const r of results) {
    if (excluded.has(r.category) && r.emissionsKgCo2e !== null) {
      r.warnings.push('Category is excluded from the reporting boundary; not included in totals.');
    }
  }
  const countedSummary = summarize(results.filter((r) => !excluded.has(r.category)));
  const id = uid();
  const run: CalculationRun = {
    id,
    organizationId: orgId,
    reportingPeriodId: periodId,
    engineVersion: ENGINE_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    status: countedSummary.warningsCount > 0 || countedSummary.counts.awaiting_factor > 0 || countedSummary.counts.invalid > 0 ? 'completed_with_warnings' : 'completed',
    createdBy: userId,
    createdAt: now(),
    inputs: structuredClone(inputs),
    results,
    summary: countedSummary,
    scope3Exclusions: structuredClone(period.scope3Exclusions),
  };
  d.runs.push(run);
  audit(d, orgId, 'calculation.run', 'calculation_run', id, `Calculation run: ${(countedSummary.totalKg / 1000).toFixed(2)} tCO2e from ${inputs.length} records`);
  return id;
}

// ── Reduction actions ──────────────────────────────────────────────────────

export type ReductionDraft = Omit<ReductionAction, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export function saveReductionAction(orgId: string, draft: ReductionDraft, id?: string): string {
  return update((d) => {
    requireRole(d, orgId, 'editor');
    if (id) {
      const a = d.reductionActions.find((x) => x.id === id && x.organizationId === orgId)!;
      Object.assign(a, draft, { updatedAt: now() });
      audit(d, orgId, 'reduction.update', 'reduction_action', id, `Updated "${draft.title}" (${draft.status})`);
      return id;
    }
    const nid = uid();
    d.reductionActions.push({ ...draft, id: nid, organizationId: orgId, createdAt: now(), updatedAt: now() });
    audit(d, orgId, 'reduction.create', 'reduction_action', nid, `Created "${draft.title}"`);
    return nid;
  });
}

export function deleteReductionAction(id: string) {
  update((d) => {
    const a = d.reductionActions.find((x) => x.id === id)!;
    requireRole(d, a.organizationId, 'editor');
    d.reductionActions = d.reductionActions.filter((x) => x.id !== id);
    audit(d, a.organizationId, 'reduction.delete', 'reduction_action', id, `Deleted "${a.title}"`);
  });
}

// ── Reports ────────────────────────────────────────────────────────────────

export function recordReport(orgId: string, r: Pick<Report, 'reportingPeriodId' | 'calculationRunId' | 'reportType' | 'fileName'>): string {
  return update((d) => {
    const userId = requireRole(d, orgId, 'viewer');
    const id = uid();
    d.reports.unshift({ ...r, id, organizationId: orgId, status: 'draft', generatedAt: now(), createdBy: userId });
    audit(d, orgId, 'report.generate', 'report', id, `Generated ${r.reportType.toUpperCase()} report ${r.fileName}`);
    return id;
  });
}

export function setReportStatus(id: string, status: Report['status']) {
  update((d) => {
    const r = d.reports.find((x) => x.id === id)!;
    requireRole(d, r.organizationId, 'admin');
    r.status = status;
    audit(d, r.organizationId, 'report.status', 'report', id, `Report marked ${status === 'draft' ? 'Draft' : 'Reviewed internally'}`);
  });
}

// ── Demo data management ───────────────────────────────────────────────────

export async function resetAllDemoData() {
  await clearFiles().catch(() => undefined);
  replaceDb(emptyDb());
}
