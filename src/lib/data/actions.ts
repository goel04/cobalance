import { calculateAll, ENGINE_VERSION, METHODOLOGY_VERSION, selectFactor, summarize } from '@/lib/engine/calculate';
import { DEFAULT_FACTORS } from '@/lib/engine/factors';
import { convert } from '@/lib/engine/units';
import type { ActivityInput, EmissionFactor } from '@/lib/engine/types';
import { getSupabase } from '@/lib/supabase';
import { emptyDb, emptySession, getDb, loadPrefs, replaceDb, setLoadState, update } from './store';
import {
  activityRow,
  check,
  EVIDENCE_BUCKET,
  facilityRow,
  factorRow,
  fetchAll,
  fetchAudit,
  friendly,
  orgProfileRow,
  periodRow,
  reductionRow,
  runRpcArgs,
  safeFileName,
  toActivity,
  toEvidence,
  toFacility,
  toFactor,
  toMembership,
  toOrganization,
  toPeriod,
  toReduction,
  toReport,
  ts,
} from './remote';
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
  Session,
} from './types';

export const uid = (): string => crypto.randomUUID();
const now = () => new Date().toISOString();

export class PermissionError extends Error {}

const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleOf(d: DB, orgId: string | null, userId: string | null): Role | null {
  if (!orgId || !userId) return null;
  return d.memberships.find((m) => m.organizationId === orgId && m.userId === userId)?.role ?? null;
}

export const canEdit = (role: Role | null) => role !== null && ROLE_RANK[role] >= ROLE_RANK.editor;
export const canAdmin = (role: Role | null) => role !== null && ROLE_RANK[role] >= ROLE_RANK.admin;

/**
 * Friendly, early role check. The database's Row Level Security policies are the
 * real enforcement point: a request that slips past this check is still refused.
 */
function requireRole(d: DB, orgId: string, min: Role): string {
  const userId = d.session.userId;
  const role = roleOf(d, orgId, userId);
  if (!userId || !role) throw new PermissionError('You are not a member of this organisation.');
  if (ROLE_RANK[role] < ROLE_RANK[min]) throw new PermissionError(`This action needs the ${min} role or higher.`);
  return userId;
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

function latestPeriodId(d: Pick<DB, 'periods'>, orgId: string): string | null {
  const ps = d.periods.filter((p) => p.organizationId === orgId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return ps[0]?.id ?? null;
}

// Audit rows are written by database triggers. Refresh the visible history shortly
// after a burst of changes instead of after every single write.
const auditTimers = new Map<string, number>();
function refreshAuditSoon(orgId: string) {
  window.clearTimeout(auditTimers.get(orgId));
  auditTimers.set(
    orgId,
    window.setTimeout(() => {
      fetchAudit(getSupabase(), orgId)
        .then((events) => update((d) => void (d.audit = [...events, ...d.audit.filter((e) => e.organizationId !== orgId)])))
        .catch(() => undefined);
    }, 800),
  );
}

// ── Auth (Supabase) ────────────────────────────────────────────────────────

const authRedirect = (path: string) => `${window.location.origin}${path}`;

function authMessage(e: { message: string; code?: string }): string {
  if (e.code === 'invalid_credentials') return 'Incorrect email or password.';
  if (e.code === 'email_not_confirmed') return 'Confirm your email first: open the link we sent you, then log in.';
  if (e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit') return 'Too many attempts. Wait a minute and try again.';
  if (e.code === 'weak_password') return 'Choose a stronger password.';
  if (e.code === 'user_already_exists' || e.code === 'email_exists') return 'An account with this email already exists. Log in or reset your password.';
  if (e.code === 'anonymous_provider_disabled') return 'Guest access is turned off. Create a free account or log in to continue.';
  return e.message;
}

// ── Guest (anonymous) accounts ─────────────────────────────────────────────
// A guest gets a real but anonymous Supabase user, so Row Level Security and
// every feature work unchanged. Adding an email later converts the same user
// into a permanent account, keeping all of its data.

/** Sign in as a guest. Requires "Anonymous sign-ins" to be enabled in Supabase Auth. */
export async function startGuestSession() {
  const { error } = await getSupabase().auth.signInAnonymously();
  if (error) throw new Error(authMessage(error));
}

/**
 * Step 1 of turning a guest into a permanent account: attach the email.
 * Supabase emails a confirmation link; it returns to /reset-password?welcome=1,
 * where the user chooses a password (step 2). Nothing is lost in between.
 */
export async function saveGuestAccount(name: string, email: string) {
  const { error } = await getSupabase().auth.updateUser(
    { email: email.trim().toLowerCase(), data: { full_name: name.trim() } },
    { emailRedirectTo: authRedirect('/reset-password?welcome=1') },
  );
  if (error) throw new Error(authMessage(error));
}

/** Copy the account's confirmed name and email into its profile (shown to co-members and in the audit log). */
export async function syncProfile(user: { id: string; email: string; name: string; isAnonymous?: boolean }) {
  if (user.isAnonymous || !user.email) return;
  const known = getDb().users.find((u) => u.id === user.id);
  if (known && known.email === user.email && (known.name === user.name || !user.name)) return;
  const patch = { email: user.email, ...(user.name ? { full_name: user.name } : {}) };
  const res = await getSupabase().from('profiles').update(patch).eq('id', user.id);
  if (res.error) return; // Cosmetic only; never block the app on it.
  update((d) => {
    const u = d.users.find((x) => x.id === user.id);
    if (u) Object.assign(u, { email: user.email, ...(user.name ? { name: user.name } : {}) });
  });
}

/** needsConfirmation is true when the user must open the emailed link before logging in. */
export async function signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: authRedirect('/onboarding') },
  });
  if (error) throw new Error(authMessage(error));
  return { needsConfirmation: !data.session };
}

export class EmailNotConfirmedError extends Error {}

export async function logIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error?.code === 'email_not_confirmed') throw new EmailNotConfirmedError(authMessage(error));
  if (error) throw new Error(authMessage(error));
}

export async function resendConfirmation(email: string) {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: authRedirect('/onboarding') } });
  if (error) throw new Error(authMessage(error));
}

export async function logOut() {
  // Supabase clears the local session even if the server can't be reached.
  await getSupabase().auth.signOut().catch(() => undefined);
  clearAccount();
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirect('/reset-password') });
  if (error) throw new Error(authMessage(error));
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw new Error(authMessage(error));
}

// ── Loading the signed-in account ──────────────────────────────────────────

let loadSeq = 0;
type AccountUser = { id: string; email: string; name: string; isAnonymous?: boolean };
let currentUser: AccountUser | null = null;

/** Choose the organisation / period to show: last selection if still valid, else a sensible default. */
export function pickSession(d: Omit<DB, 'session' | 'version'>, userId: string, prefs: Omit<Session, 'userId'> | null): Session {
  const mine = d.memberships.filter((m) => m.userId === userId).map((m) => m.organizationId);
  const isSample = (id: string) => d.organizations.find((o) => o.id === id)?.isSample;
  const orgId =
    (prefs?.organizationId && mine.includes(prefs.organizationId) ? prefs.organizationId : null) ?? mine.find((id) => !isSample(id)) ?? mine[0] ?? null;
  const periodOk = prefs?.periodId && d.periods.some((p) => p.id === prefs.periodId && p.organizationId === orgId);
  const facilityOk = prefs?.facilityId && d.facilities.some((f) => f.id === prefs.facilityId && f.organizationId === orgId);
  return {
    userId,
    organizationId: orgId,
    periodId: periodOk ? prefs!.periodId : orgId ? latestPeriodId(d, orgId) : null,
    facilityId: facilityOk ? prefs!.facilityId : 'all',
  };
}

/** Load everything the user can see from Supabase into the in-memory cache. */
export async function loadAccount(user: AccountUser, opts: { silent?: boolean } = {}) {
  const seq = ++loadSeq;
  currentUser = user;
  // A silent refresh keeps the current screen mounted while new data arrives.
  if (!opts.silent) setLoadState({ status: 'loading' });
  try {
    const data = await fetchAll(getSupabase());
    if (seq !== loadSeq) return; // A newer load (or a logout) superseded this one.
    if (!data.users.some((u) => u.id === user.id)) data.users.push({ id: user.id, email: user.email, name: user.name, createdAt: now() });
    replaceDb({ ...emptyDb(), ...data, session: pickSession(data, user.id, loadPrefs(user.id)) });
    setLoadState({ status: 'ready' });
    void syncProfile(user);
  } catch (e) {
    if (seq !== loadSeq) return;
    if (opts.silent) throw e;
    replaceDb({ ...emptyDb(), session: { ...emptySession(), userId: user.id } });
    setLoadState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load your data.' });
  }
}

/** Re-fetch everything in the background (e.g. after an import). Throws if it fails. */
export const reloadAccount = () => (currentUser ? loadAccount(currentUser, { silent: true }) : Promise.resolve());

export function clearAccount() {
  loadSeq++;
  currentUser = null;
  replaceDb(emptyDb());
  setLoadState({ status: 'idle' });
}

// ── Session context (local UI selection only) ──────────────────────────────

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

/** Creates the company and makes the caller its owner, atomically (create_company RPC). */
export async function createCompanyRemote(input: OrgInput, isSample = false): Promise<string> {
  const sb = getSupabase();
  const id = check(
    await sb.rpc('create_company', {
      p_name: input.name,
      p_industry: input.industry,
      p_company_size: input.companySize,
      p_country: input.country,
      p_state: input.state,
      p_city: input.city,
      p_website: input.website,
      p_is_sample: isSample,
    }),
    'Could not create the organisation.',
  ) as string;
  return id;
}

/** Pull one company (and its membership rows) into the cache. */
async function cacheCompany(orgId: string) {
  const sb = getSupabase();
  const [company, members] = await Promise.all([
    sb.from('companies').select('*').eq('id', orgId).single().then((r) => check(r)),
    sb.from('company_members').select('*').eq('company_id', orgId).then((r) => check(r) ?? []),
  ]);
  update((d) => {
    d.organizations = [...d.organizations.filter((o) => o.id !== orgId), toOrganization(company)];
    d.memberships = [...d.memberships.filter((m) => m.organizationId !== orgId), ...members.map(toMembership)];
  });
}

export async function createOrganization(input: OrgInput): Promise<string> {
  if (!getDb().session.userId) throw new PermissionError('Please log in first.');
  const id = await createCompanyRemote(input);
  await cacheCompany(id);
  update((d) => {
    d.session.organizationId = id;
    d.session.periodId = null;
    d.session.facilityId = 'all';
  });
  refreshAuditSoon(id);
  return id;
}

export async function updateOrganization(orgId: string, input: OrgInput) {
  requireRole(getDb(), orgId, 'admin');
  const row = check(await getSupabase().from('companies').update(orgProfileRow(input)).eq('id', orgId).select().single(), 'Could not update the organisation.');
  update((d) => void (d.organizations = d.organizations.map((o) => (o.id === orgId ? toOrganization(row) : o))));
  refreshAuditSoon(orgId);
}

export async function setOnboardingStep(orgId: string, step: number) {
  const d0 = getDb();
  requireRole(d0, orgId, 'editor');
  const current = d0.organizations.find((o) => o.id === orgId)?.onboardingStep ?? 0;
  if (step <= current) return;
  check(await getSupabase().from('companies').update({ onboarding_step: step }).eq('id', orgId), 'Could not save your progress.');
  update((d) => {
    const o = d.organizations.find((x) => x.id === orgId);
    if (o) o.onboardingStep = step;
  });
}

/** Owners only. Deletes the company and everything in it (used for sample organisations). */
export async function deleteOrganization(orgId: string) {
  requireRole(getDb(), orgId, 'owner');
  const sb = getSupabase();
  const paths = getDb().evidence.filter((e) => e.organizationId === orgId).map((e) => e.storagePath);
  check(await sb.from('companies').delete().eq('id', orgId), 'Could not delete the organisation.');
  if (paths.length) await sb.storage.from(EVIDENCE_BUCKET).remove(paths).catch(() => undefined);
  update((d) => {
    const keep = <T extends { organizationId?: string | null }>(xs: T[]) => xs.filter((x) => x.organizationId !== orgId);
    d.organizations = d.organizations.filter((o) => o.id !== orgId);
    d.memberships = keep(d.memberships);
    d.facilities = keep(d.facilities);
    d.periods = keep(d.periods);
    d.activities = keep(d.activities);
    d.evidence = keep(d.evidence);
    d.runs = keep(d.runs);
    d.reductionActions = keep(d.reductionActions);
    d.reports = keep(d.reports);
    d.factors = keep(d.factors);
    d.audit = keep(d.audit);
    if (d.session.organizationId === orgId) {
      const next = d.memberships.find((m) => m.userId === d.session.userId);
      d.session.organizationId = next?.organizationId ?? null;
      d.session.periodId = next ? latestPeriodId(d, next.organizationId) : null;
      d.session.facilityId = 'all';
    }
  });
}

// ── Facilities ─────────────────────────────────────────────────────────────

export type FacilityInput = Omit<Facility, 'id' | 'organizationId' | 'createdAt'>;

export async function createFacility(orgId: string, input: FacilityInput): Promise<string> {
  requireRole(getDb(), orgId, 'editor');
  const row = check(await getSupabase().from('facilities').insert({ company_id: orgId, ...facilityRow(input) }).select().single(), 'Could not add the facility.');
  const f = toFacility(row);
  update((d) => void d.facilities.push(f));
  refreshAuditSoon(orgId);
  return f.id;
}

export async function updateFacility(id: string, input: FacilityInput) {
  const f0 = getDb().facilities.find((x) => x.id === id);
  if (!f0) throw new Error('Facility not found.');
  requireRole(getDb(), f0.organizationId, 'editor');
  const row = check(await getSupabase().from('facilities').update(facilityRow(input)).eq('id', id).select().single(), 'Could not update the facility.');
  update((d) => void (d.facilities = d.facilities.map((x) => (x.id === id ? toFacility(row) : x))));
  refreshAuditSoon(f0.organizationId);
}

export async function deleteFacility(id: string) {
  const d0 = getDb();
  const f = d0.facilities.find((x) => x.id === id);
  if (!f) return;
  requireRole(d0, f.organizationId, 'admin');
  if (d0.activities.some((a) => a.facilityId === id)) throw new Error('This facility has activity records. Delete or move them first.');
  check(await getSupabase().from('facilities').delete().eq('id', id), 'Could not delete the facility.');
  update((d) => {
    d.facilities = d.facilities.filter((x) => x.id !== id);
    // The database sets these references to null (on delete set null).
    d.evidence.forEach((e) => e.facilityId === id && (e.facilityId = null));
    d.reductionActions.forEach((a) => a.facilityId === id && (a.facilityId = null));
    if (d.session.facilityId === id) d.session.facilityId = 'all';
  });
  refreshAuditSoon(f.organizationId);
}

// ── Reporting periods ──────────────────────────────────────────────────────

export async function createPeriod(orgId: string, input: Pick<ReportingPeriod, 'label' | 'startDate' | 'endDate'>): Promise<string> {
  if (input.endDate <= input.startDate) throw new Error('End date must be after start date.');
  requireRole(getDb(), orgId, 'admin');
  const row = check(
    await getSupabase()
      .from('carbon_assessments')
      .insert({ company_id: orgId, ...periodRow({ ...input, status: 'open', methodologyVersion: METHODOLOGY_VERSION, scope3Exclusions: [] }) })
      .select()
      .single(),
    'Could not add the reporting period.',
  );
  const p = toPeriod(row);
  update((d) => {
    d.periods.push(p);
    d.session.periodId = p.id;
  });
  refreshAuditSoon(orgId);
  return p.id;
}

export async function setScope3Exclusions(periodId: string, exclusions: Scope3Exclusion[]) {
  const p0 = getDb().periods.find((x) => x.id === periodId);
  if (!p0) throw new Error('Reporting period not found.');
  requireRole(getDb(), p0.organizationId, 'admin');
  const row = check(await getSupabase().from('carbon_assessments').update({ scope3_exclusions: exclusions }).eq('id', periodId).select().single(), 'Could not update the boundary.');
  update((d) => void (d.periods = d.periods.map((x) => (x.id === periodId ? toPeriod(row) : x))));
  refreshAuditSoon(p0.organizationId);
}

// ── Activity records ───────────────────────────────────────────────────────

export type ActivityDraft = Omit<
  ActivityRecord,
  'id' | 'organizationId' | 'normalizedQuantity' | 'normalizedUnit' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

function draftToRecord(d: DB, orgId: string, draft: ActivityDraft, userId: string, id = uid()): ActivityRecord {
  const rec: ActivityRecord = { ...draft, id, organizationId: orgId, normalizedQuantity: null, normalizedUnit: null, createdBy: userId, createdAt: now(), updatedAt: now() };
  return Object.assign(rec, normalize(d, rec));
}

export async function saveActivity(orgId: string, draft: ActivityDraft, id?: string): Promise<string> {
  const d0 = getDb();
  const userId = requireRole(d0, orgId, 'editor');
  const sb = getSupabase();
  if (id) {
    const existing = d0.activities.find((x) => x.id === id && x.organizationId === orgId);
    if (!existing) throw new Error('Record not found.');
    const rec = draftToRecord(d0, orgId, draft, existing.createdBy, id);
    const row = check(await sb.from('emission_activities').update(activityRow(rec)).eq('id', id).select().single(), 'Could not save the record.');
    update((d) => void (d.activities = d.activities.map((x) => (x.id === id ? toActivity(row) : x))));
    refreshAuditSoon(orgId);
    return id;
  }
  const rec = draftToRecord(d0, orgId, draft, userId);
  const row = check(
    await sb.from('emission_activities').insert({ id: rec.id, company_id: orgId, created_by: userId, ...activityRow(rec) }).select().single(),
    'Could not save the record.',
  );
  update((d) => void d.activities.push(toActivity(row)));
  refreshAuditSoon(orgId);
  return rec.id;
}

export async function importActivities(orgId: string, drafts: ActivityDraft[]): Promise<number> {
  const d0 = getDb();
  const userId = requireRole(d0, orgId, 'editor');
  const sb = getSupabase();
  const rows = drafts.map((draft) => {
    const rec = draftToRecord(d0, orgId, draft, userId);
    return { id: rec.id, company_id: orgId, created_by: userId, ...activityRow(rec) };
  });
  const saved: ActivityRecord[] = [];
  try {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = check(await sb.from('emission_activities').insert(rows.slice(i, i + 500)).select(), 'Could not import the records.');
      saved.push(...(chunk ?? []).map(toActivity));
    }
  } catch (e) {
    // Don't leave a half-finished import behind: remove whatever was saved.
    if (saved.length) await sb.from('emission_activities').delete().in('id', saved.map((s) => s.id));
    throw e;
  }
  update((d) => void d.activities.push(...saved));
  refreshAuditSoon(orgId);
  return saved.length;
}

export async function deleteActivity(id: string) {
  const r = getDb().activities.find((x) => x.id === id);
  if (!r) return;
  requireRole(getDb(), r.organizationId, 'editor');
  check(await getSupabase().from('emission_activities').delete().eq('id', id), 'Could not delete the record.');
  update((d) => void (d.activities = d.activities.filter((x) => x.id !== id)));
  refreshAuditSoon(r.organizationId);
}

export async function setActivityReview(id: string, status: ActivityRecord['reviewStatus']) {
  const r = getDb().activities.find((x) => x.id === id);
  if (!r) return;
  requireRole(getDb(), r.organizationId, 'admin');
  const row = check(await getSupabase().from('emission_activities').update({ review_status: status }).eq('id', id).select().single(), 'Could not update the review status.');
  update((d) => void (d.activities = d.activities.map((x) => (x.id === id ? toActivity(row) : x))));
  refreshAuditSoon(r.organizationId);
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

// ── Evidence (private "evidence" storage bucket) ───────────────────────────

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** Upload a file and record it. Path: <companyId>/<documentId>/<file name> (enforced by storage policies). */
export async function uploadEvidenceRemote(
  orgId: string,
  file: Blob & { name?: string },
  meta: { facilityId: string | null; reportingPeriodId: string | null; documentType: string; fileName?: string },
  id = uid(),
): Promise<EvidenceDocument> {
  const userId = getDb().session.userId;
  if (!userId) throw new PermissionError('Please log in first.');
  if (file.size > MAX_EVIDENCE_BYTES) throw new Error('Files must be 10 MB or smaller.');
  const sb = getSupabase();
  const fileName = meta.fileName ?? file.name ?? 'document';
  const storagePath = `${orgId}/${id}/${safeFileName(fileName)}`;
  const mimeType = file.type || 'application/octet-stream';
  const up = await sb.storage.from(EVIDENCE_BUCKET).upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (up.error) throw friendly(up.error, 'Could not upload the file.');
  const res = await sb
    .from('evidence_documents')
    .insert({
      id,
      company_id: orgId,
      facility_id: meta.facilityId,
      assessment_id: meta.reportingPeriodId,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: file.size,
      storage_path: storagePath,
      document_type: meta.documentType,
      uploaded_by: userId,
    })
    .select()
    .single();
  if (res.error) {
    await sb.storage.from(EVIDENCE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw friendly(res.error, 'Could not save the document.');
  }
  return toEvidence(res.data);
}

export async function uploadEvidence(
  orgId: string,
  file: File,
  meta: { facilityId: string | null; reportingPeriodId: string | null; documentType: string; attachToActivityId?: string },
): Promise<string> {
  requireRole(getDb(), orgId, 'editor');
  const doc = await uploadEvidenceRemote(orgId, file, meta);
  let attached: ActivityRecord | null = null;
  if (meta.attachToActivityId) {
    const row = check(
      await getSupabase().from('emission_activities').update({ evidence_document_id: doc.id }).eq('id', meta.attachToActivityId).eq('company_id', orgId).select().single(),
      'The file was uploaded but could not be attached to the record.',
    );
    attached = toActivity(row);
  }
  update((d) => {
    d.evidence.push(doc);
    if (attached) d.activities = d.activities.map((x) => (x.id === attached!.id ? attached! : x));
  });
  refreshAuditSoon(orgId);
  return doc.id;
}

export async function deleteEvidence(id: string) {
  const doc = getDb().evidence.find((e) => e.id === id);
  if (!doc) return;
  requireRole(getDb(), doc.organizationId, 'editor');
  const sb = getSupabase();
  // Row first: the database detaches it from activity records (on delete set null).
  check(await sb.from('evidence_documents').delete().eq('id', id), 'Could not delete the document.');
  await sb.storage.from(EVIDENCE_BUCKET).remove([doc.storagePath]).catch(() => undefined);
  update((d) => {
    d.evidence = d.evidence.filter((e) => e.id !== id);
    d.activities.forEach((a) => {
      if (a.evidenceDocumentId === id) a.evidenceDocumentId = null;
    });
  });
  refreshAuditSoon(doc.organizationId);
}

export async function downloadEvidence(storagePath: string): Promise<Blob> {
  const { data, error } = await getSupabase().storage.from(EVIDENCE_BUCKET).download(storagePath);
  if (error || !data) throw friendly(error, 'Could not download the file.');
  return data;
}

// ── Emission factors ───────────────────────────────────────────────────────

export async function addCustomFactor(orgId: string, f: Omit<EmissionFactor, 'id' | 'origin' | 'organizationId'>): Promise<string> {
  requireRole(getDb(), orgId, 'admin');
  const factor: EmissionFactor = { ...f, id: uid(), origin: 'user', organizationId: orgId };
  const row = check(await getSupabase().from('emission_factors').insert(factorRow(factor, orgId)).select().single(), 'Could not add the factor.');
  update((d) => void d.factors.push(toFactor(row)));
  refreshAuditSoon(orgId);
  return factor.id;
}

async function setFactorReviewStatus(id: string, status: EmissionFactor['reviewStatus']) {
  const f = getDb().factors.find((x) => x.id === id);
  if (!f?.organizationId) throw new Error('Factor not found.');
  requireRole(getDb(), f.organizationId, 'admin');
  const row = check(await getSupabase().from('emission_factors').update({ review_status: status }).eq('id', id).select().single(), 'Could not update the factor.');
  update((d) => void (d.factors = d.factors.map((x) => (x.id === id ? toFactor(row) : x))));
  refreshAuditSoon(f.organizationId);
}

/** Factors are never edited in place: retiring keeps history intact for past runs. */
export const retireFactor = (id: string) => setFactorReviewStatus(id, 'retired');
export const setFactorStatus = (id: string, status: 'approved' | 'provisional') => setFactorReviewStatus(id, status);

// ── Calculation runs ───────────────────────────────────────────────────────

/** Pure: compute a run from the cached activities (no side effects). */
export function buildRun(d: DB, orgId: string, periodId: string): CalculationRun {
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
  return {
    id: uid(),
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
}

/** Save a run and all of its results in one database transaction. Returns the server's id and timestamp. */
export async function saveRunRemote(run: CalculationRun): Promise<{ id: string; createdAt: string }> {
  const sb = getSupabase();
  const id = check(await sb.rpc('save_calculation_run', runRpcArgs(run)), 'Could not save the calculation run.') as string;
  const row = check(await sb.from('calculation_runs').select('created_at').eq('id', id).single());
  return { id, createdAt: ts(row.created_at) };
}

export async function createCalculationRun(orgId: string, periodId: string): Promise<string> {
  const run = buildRun(getDb(), orgId, periodId);
  const saved = await saveRunRemote(run);
  // Use the server's timestamp: "results are out of date" compares it with server-side record times.
  update((d) => void d.runs.push({ ...run, ...saved }));
  refreshAuditSoon(orgId);
  return saved.id;
}

// ── Reduction actions ──────────────────────────────────────────────────────

export type ReductionDraft = Omit<ReductionAction, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export async function saveReductionAction(orgId: string, draft: ReductionDraft, id?: string): Promise<string> {
  requireRole(getDb(), orgId, 'editor');
  const sb = getSupabase();
  if (id) {
    const row = check(await sb.from('reduction_actions').update(reductionRow(draft)).eq('id', id).eq('company_id', orgId).select().single(), 'Could not save the scenario.');
    update((d) => void (d.reductionActions = d.reductionActions.map((x) => (x.id === id ? toReduction(row) : x))));
    refreshAuditSoon(orgId);
    return id;
  }
  const row = check(await sb.from('reduction_actions').insert({ company_id: orgId, ...reductionRow(draft) }).select().single(), 'Could not save the scenario.');
  const a = toReduction(row);
  update((d) => void d.reductionActions.push(a));
  refreshAuditSoon(orgId);
  return a.id;
}

export async function deleteReductionAction(id: string) {
  const a = getDb().reductionActions.find((x) => x.id === id);
  if (!a) return;
  requireRole(getDb(), a.organizationId, 'editor');
  check(await getSupabase().from('reduction_actions').delete().eq('id', id), 'Could not delete the scenario.');
  update((d) => void (d.reductionActions = d.reductionActions.filter((x) => x.id !== id)));
  refreshAuditSoon(a.organizationId);
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function recordReport(orgId: string, r: Pick<Report, 'reportingPeriodId' | 'calculationRunId' | 'reportType' | 'fileName'>): Promise<string> {
  const userId = requireRole(getDb(), orgId, 'viewer');
  const row = check(
    await getSupabase()
      .from('reports')
      .insert({
        company_id: orgId,
        assessment_id: r.reportingPeriodId,
        calculation_run_id: r.calculationRunId,
        report_type: r.reportType,
        file_name: r.fileName,
        created_by: userId,
      })
      .select()
      .single(),
    'The report was downloaded but could not be recorded.',
  );
  const rep = toReport(row);
  update((d) => void d.reports.unshift(rep));
  refreshAuditSoon(orgId);
  return rep.id;
}

export async function setReportStatus(id: string, status: Report['status']) {
  const r = getDb().reports.find((x) => x.id === id);
  if (!r) return;
  requireRole(getDb(), r.organizationId, 'admin');
  const row = check(await getSupabase().from('reports').update({ status }).eq('id', id).select().single(), 'Could not update the report.');
  update((d) => void (d.reports = d.reports.map((x) => (x.id === id ? toReport(row) : x))));
  refreshAuditSoon(r.organizationId);
}
