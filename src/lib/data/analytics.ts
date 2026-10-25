import { SCOPE3_CATEGORIES, categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { convert } from '@/lib/engine/units';
import type { ActivityCategory, CalculationResult, Scope } from '@/lib/engine/types';
import { monthsBetween } from '@/lib/constants';
import type { ActivityRecord, CalculationRun, Facility, ReportingPeriod } from './types';

// Derived figures for the dashboard, insights and reports. Emissions always come
// from a saved calculation run (never recomputed here), so totals reconcile.

export interface Filter {
  facilityId: string; // 'all' or id
  fromMonth?: string; // 'YYYY-MM'
  toMonth?: string;
}

export interface JoinedResult extends CalculationResult {
  record: ActivityRecord;
}

const inMonthRange = (date: string, f: Filter) => {
  const m = date.slice(0, 7);
  return (!f.fromMonth || m >= f.fromMonth) && (!f.toMonth || m <= f.toMonth);
};

/** Results of a run joined with the input snapshot they came from, filtered and excluding out-of-boundary categories. */
export function runResults(run: CalculationRun, f: Filter): JoinedResult[] {
  const byId = new Map(run.inputs.map((r) => [r.id, r]));
  const excluded = new Set(run.scope3Exclusions.map((x) => x.category));
  const out: JoinedResult[] = [];
  for (const r of run.results) {
    const record = byId.get(r.activityId);
    if (!record) continue;
    if (excluded.has(r.category)) continue;
    if (f.facilityId !== 'all' && record.facilityId !== f.facilityId) continue;
    if (!inMonthRange(record.activityDate, f)) continue;
    out.push({ ...r, record });
  }
  return out;
}

export function totals(results: JoinedResult[]) {
  const byScope: Record<Scope, number> = { 1: 0, 2: 0, 3: 0 };
  for (const r of results) if (r.emissionsKgCo2e !== null && r.scope) byScope[r.scope] += r.emissionsKgCo2e;
  return { byScope, total: byScope[1] + byScope[2] + byScope[3] };
}

export function bySource(results: JoinedResult[]) {
  const m = new Map<string, { key: string; label: string; scope: Scope; kg: number }>();
  for (const r of results) {
    if (r.emissionsKgCo2e === null || !r.scope) continue;
    const key = `${r.category}:${r.subtype}`;
    const cur = m.get(key) ?? { key, label: `${subtypeLabel(r.category, r.subtype)} · ${categoryLabel(r.category)}`, scope: r.scope, kg: 0 };
    cur.kg += r.emissionsKgCo2e;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.kg - a.kg);
}

export function periodMonths(period: ReportingPeriod, f: Filter) {
  return monthsBetween(period.startDate, period.endDate).filter((m) => inMonthRange(m, f));
}

export function monthlyEmissions(results: JoinedResult[], months: string[]) {
  const rows = months.map((m) => ({ month: m, s1: 0, s2: 0, s3: 0, total: 0 }));
  const idx = new Map(rows.map((r, i) => [r.month.slice(0, 7), i]));
  for (const r of results) {
    if (r.emissionsKgCo2e === null || !r.scope) continue;
    const i = idx.get(r.record.activityDate.slice(0, 7));
    if (i === undefined) continue;
    const t = r.emissionsKgCo2e / 1000;
    rows[i][`s${r.scope}` as 's1' | 's2' | 's3'] += t;
    rows[i].total += t;
  }
  return rows;
}

function scopedActivities(activities: ActivityRecord[], f: Filter, periodId: string) {
  return activities.filter((a) => a.reportingPeriodId === periodId && (f.facilityId === 'all' || a.facilityId === f.facilityId) && inMonthRange(a.activityDate, f));
}

/** Monthly electricity (kWh) and spend (₹) from activity records. Bill amounts are never used as consumption. */
export function electricitySeries(activities: ActivityRecord[], periodId: string, months: string[], f: Filter) {
  const rows = months.map((m) => ({ month: m, kwh: null as number | null, cost: null as number | null }));
  const idx = new Map(rows.map((r, i) => [r.month.slice(0, 7), i]));
  for (const a of scopedActivities(activities, f, periodId)) {
    if (a.category !== 'purchased_electricity' || a.quantity === null) continue;
    const i = idx.get(a.activityDate.slice(0, 7));
    if (i === undefined) continue;
    const c = convert(a.quantity, a.unit, 'kWh');
    if (c.ok) rows[i].kwh = (rows[i].kwh ?? 0) + c.value;
    if (a.costAmount !== null) rows[i].cost = (rows[i].cost ?? 0) + a.costAmount;
  }
  return rows;
}

/**
 * Production totals per month. Intensity is only meaningful within one unit, so
 * when facilities use different units the series is reported as mixed.
 */
export function productionSeries(activities: ActivityRecord[], periodId: string, months: string[], f: Filter, facilities: Facility[]) {
  const recs = scopedActivities(activities, f, periodId).filter((a) => a.category === 'production' && a.quantity !== null);
  const units = new Set(recs.map((r) => r.unit));
  const unit = units.size === 1 ? [...units][0] : units.size === 0 ? (facilities.find((x) => x.id === f.facilityId)?.productionUnit ?? null) : null;
  const rows = months.map((m) => ({ month: m, qty: null as number | null }));
  const idx = new Map(rows.map((r, i) => [r.month.slice(0, 7), i]));
  if (units.size <= 1) {
    for (const r of recs) {
      const i = idx.get(r.activityDate.slice(0, 7));
      if (i !== undefined) rows[i].qty = (rows[i].qty ?? 0) + (r.quantity ?? 0);
    }
  }
  return { rows, unit, mixedUnits: units.size > 1 };
}

export interface Completeness {
  expected: number;
  present: number;
  pct: number;
  missing: { facility: string; month: string; category: ActivityCategory }[];
}

/** Core monthly data coverage: grid electricity and production for every facility × month. */
export function completeness(activities: ActivityRecord[], period: ReportingPeriod, facilities: Facility[], f: Filter): Completeness {
  const months = periodMonths(period, f);
  const fs = facilities.filter((x) => f.facilityId === 'all' || x.id === f.facilityId);
  const core: ActivityCategory[] = ['purchased_electricity', 'production'];
  const have = new Set(
    activities
      .filter((a) => a.reportingPeriodId === period.id && a.quantity !== null)
      .map((a) => `${a.facilityId}|${a.activityDate.slice(0, 7)}|${a.category}`),
  );
  const missing: Completeness['missing'] = [];
  let expected = 0;
  for (const fac of fs)
    for (const m of months)
      for (const c of core) {
        expected += 1;
        if (!have.has(`${fac.id}|${m.slice(0, 7)}|${c}`)) missing.push({ facility: fac.name, month: m, category: c });
      }
  const present = expected - missing.length;
  return { expected, present, pct: expected ? (present / expected) * 100 : 0, missing };
}

export type Scope3Status = 'calculated' | 'estimated' | 'awaiting_factor' | 'not_assessed' | 'excluded';

export function scope3Status(run: CalculationRun | null, period: ReportingPeriod, activities: ActivityRecord[]) {
  const exclusions = run ? run.scope3Exclusions : period.scope3Exclusions;
  return SCOPE3_CATEGORIES.map((c) => {
    const ex = exclusions.find((x) => x.category === c.value);
    if (ex) return { category: c, status: 'excluded' as Scope3Status, reason: ex.reason, kg: 0 };
    const res = run ? run.results.filter((r) => r.category === c.value) : [];
    const kg = res.reduce((s, r) => s + (r.emissionsKgCo2e ?? 0), 0);
    const hasRecords = activities.some((a) => a.reportingPeriodId === period.id && a.category === c.value);
    let status: Scope3Status = 'not_assessed';
    if (res.some((r) => r.status === 'awaiting_factor') && !res.some((r) => r.emissionsKgCo2e !== null)) status = 'awaiting_factor';
    else if (res.some((r) => r.status === 'estimated')) status = 'estimated';
    else if (res.some((r) => r.status === 'calculated')) status = 'calculated';
    else if (hasRecords) status = 'not_assessed';
    return { category: c, status, reason: '', kg, partialAwaiting: res.some((r) => r.status === 'awaiting_factor') };
  });
}

export const SCOPE3_STATUS_LABEL: Record<Scope3Status, string> = {
  calculated: 'Calculated',
  estimated: 'Estimated',
  awaiting_factor: 'Awaiting factor',
  not_assessed: 'Not yet assessed',
  excluded: 'Excluded from boundary',
};
