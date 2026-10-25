import { CATEGORY_BY_VALUE, scopeOf } from './catalog';
import { GWP_AR5 } from './factors';
import { convert } from './units';
import type {
  ActivityCategory,
  ActivityInput,
  CalculationResult,
  EmissionFactor,
  FactorSnapshot,
  GasResult,
  Scope,
} from './types';

export const ENGINE_VERSION = '1.0.0';
export const METHODOLOGY_VERSION = 'GHGP-CORP-2015/IPCC2006/AR5';

const STATUS_RANK = { approved: 0, provisional: 1, retired: 9 } as const;

/**
 * Select the factor for an activity: same category and subtype, not retired,
 * valid on the activity date, for the activity's geography or GLOBAL.
 * Preference: exact geography → approved over provisional → most recent validity → most recent publication.
 */
export function selectFactor(activity: ActivityInput, factors: EmissionFactor[]): EmissionFactor | null {
  const date = activity.activityDate;
  const candidates = factors.filter(
    (f) =>
      f.category === activity.category &&
      f.subtype === activity.subtype &&
      f.reviewStatus !== 'retired' &&
      (f.geography === activity.geography || f.geography === 'GLOBAL') &&
      f.validFrom <= date &&
      (f.validTo === null || date <= f.validTo),
  );
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      Number(b.geography === activity.geography) - Number(a.geography === activity.geography) ||
      STATUS_RANK[a.reviewStatus] - STATUS_RANK[b.reviewStatus] ||
      b.validFrom.localeCompare(a.validFrom) ||
      b.publicationYear - a.publicationYear,
  );
  return candidates[0];
}

export function factorKgCo2ePerUnit(f: Pick<EmissionFactor, 'components'>): number {
  return f.components.reduce((sum, c) => sum + c.kgPerUnit * (GWP_AR5[c.gas] ?? NaN), 0);
}

export function snapshotFactor(f: EmissionFactor): FactorSnapshot {
  return {
    factorId: f.id,
    factorCode: f.factorCode,
    kgCo2ePerUnit: factorKgCo2ePerUnit(f),
    activityUnit: f.activityUnit,
    factorUnit: f.factorUnit,
    sourceName: f.sourceName,
    sourceUrl: f.sourceUrl,
    version: f.version,
    publicationYear: f.publicationYear,
    geography: f.geography,
    gwpReference: f.gwpReference,
    reviewStatus: f.reviewStatus,
    origin: f.origin,
    components: f.components.map((c) => ({ ...c })),
    conversions: f.conversions ? { ...f.conversions } : undefined,
  };
}

function base(activity: ActivityInput): CalculationResult {
  return {
    activityId: activity.id,
    scope: scopeOf(activity.category),
    category: activity.category,
    subtype: activity.subtype,
    status: 'invalid',
    inputQuantity: activity.quantity,
    inputUnit: activity.unit,
    normalizedQuantity: null,
    normalizedUnit: null,
    emissionsKgCo2e: null,
    gases: [],
    factor: null,
    warnings: [],
  };
}

/** Resolve the activity quantity, deriving tonne-km for freight where distance and weight are given. */
function effectiveQuantity(activity: ActivityInput, warnings: string[]): number | null {
  const def = CATEGORY_BY_VALUE[activity.category];
  if (def?.freight && activity.distanceKm != null && activity.weightTonnes != null) {
    const tkm = activity.distanceKm * activity.weightTonnes;
    if (activity.quantity != null && Math.abs(activity.quantity - tkm) > Math.max(1e-9, Math.abs(tkm) * 0.005)) {
      warnings.push(`Entered quantity (${activity.quantity} tkm) differs from distance × weight (${tkm} tkm); distance × weight was used.`);
    }
    return tkm;
  }
  return activity.quantity;
}

export function calculateActivity(activity: ActivityInput, factors: EmissionFactor[]): CalculationResult {
  const r = base(activity);
  const def = CATEGORY_BY_VALUE[activity.category];

  if (!def) {
    r.warnings.push(`Unsupported activity category "${activity.category}".`);
    return r;
  }
  if (def.scope === null) {
    r.status = 'not_applicable';
    return r;
  }
  const subtypeDef = def.subtypes.find((s) => s.value === activity.subtype);
  if (!subtypeDef) {
    r.warnings.push(`Unsupported source "${activity.subtype}" for ${def.label}.`);
    return r;
  }
  if (!subtypeDef.units.includes(activity.unit)) {
    r.warnings.push(`Unit "${activity.unit}" is not valid for ${subtypeDef.label}. Allowed: ${subtypeDef.units.join(', ')}.`);
    return r;
  }

  const qty = effectiveQuantity(activity, r.warnings);
  if (qty === null || qty === undefined || !Number.isFinite(qty)) {
    r.warnings.push('Quantity is missing. Missing activity data is not treated as zero.');
    return r;
  }
  if (qty < 0) {
    r.warnings.push('Quantity cannot be negative.');
    return r;
  }

  const factor = selectFactor(activity, factors);
  if (!factor) {
    r.status = 'awaiting_factor';
    r.warnings.push(
      `No approved or provisional emission factor is available for ${subtypeDef.label} (${activity.geography}, ${activity.activityDate}). ` +
        'This activity is excluded from totals until a documented factor is added to the library.',
    );
    return r;
  }

  const conv = convert(qty, activity.unit, factor.activityUnit, factor.conversions);
  if (!conv.ok) {
    r.warnings.push(conv.reason);
    r.factor = snapshotFactor(factor);
    return r;
  }
  if (conv.note) r.warnings.push(`Converted ${activity.unit} → ${factor.activityUnit} using ${conv.note} (assumption from factor library).`);

  const gases: GasResult[] = [];
  for (const c of factor.components) {
    const gwp = GWP_AR5[c.gas];
    if (gwp === undefined) {
      r.warnings.push(`No GWP available for ${c.gas}.`);
      r.factor = snapshotFactor(factor);
      return r;
    }
    const kgGas = conv.value * c.kgPerUnit;
    gases.push({ gas: c.gas, kgGas, gwp, kgCo2e: kgGas * gwp });
  }

  if (factor.reviewStatus === 'provisional') r.warnings.push(`Factor ${factor.factorCode} is provisional and pending source verification.`);
  if (factor.origin === 'sample') r.warnings.push('Uses an illustrative SAMPLE factor — not a validated factor; do not disclose.');
  if (factor.origin === 'user') r.warnings.push('Uses a user-supplied factor; confirm its source before disclosure.');

  r.normalizedQuantity = conv.value;
  r.normalizedUnit = factor.activityUnit;
  r.gases = gases;
  r.emissionsKgCo2e = gases.reduce((s, g) => s + g.kgCo2e, 0);
  r.factor = snapshotFactor(factor);
  r.status = activity.dataQuality === 'estimated' || factor.origin === 'sample' ? 'estimated' : 'calculated';
  return r;
}

export interface RunSummary {
  totalKg: number;
  byScope: Record<Scope, number>;
  byCategory: Partial<Record<ActivityCategory, number>>;
  counts: Record<CalculationResult['status'], number>;
  warningsCount: number;
}

export function summarize(results: CalculationResult[]): RunSummary {
  const byScope: Record<Scope, number> = { 1: 0, 2: 0, 3: 0 };
  const byCategory: Partial<Record<ActivityCategory, number>> = {};
  const counts: RunSummary['counts'] = { calculated: 0, estimated: 0, awaiting_factor: 0, invalid: 0, not_applicable: 0 };
  let warningsCount = 0;
  for (const r of results) {
    counts[r.status] += 1;
    warningsCount += r.warnings.length;
    if (r.emissionsKgCo2e === null || r.scope === null) continue;
    byScope[r.scope] += r.emissionsKgCo2e;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.emissionsKgCo2e;
  }
  return { totalKg: byScope[1] + byScope[2] + byScope[3], byScope, byCategory, counts, warningsCount };
}

export function calculateAll(activities: ActivityInput[], factors: EmissionFactor[]) {
  const results = activities.map((a) => calculateActivity(a, factors));
  return { results, summary: summarize(results) };
}

export const kgToTonnes = (kg: number) => kg / 1000;
