import { SCOPE3_CATEGORIES, categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { GWP_REFERENCE } from '@/lib/engine/factors';
import { computeScenario, ACTION_TYPES } from '@/lib/engine/reduction';
import type { FactorSnapshot, Scope } from '@/lib/engine/types';
import { bySource, completeness, productionSeries, runResults, scope3Status, SCOPE3_STATUS_LABEL, totals } from '@/lib/data/analytics';
import type { CalculationRun, Facility, Organization, ReductionAction, ReportingPeriod } from '@/lib/data/types';
import { monthsBetween } from '@/lib/constants';

export interface ReportModel {
  title: string;
  statusLabel: string;
  generatedAt: string;
  org: Organization;
  period: ReportingPeriod;
  facilities: Facility[];
  run: CalculationRun;
  totalsKg: { total: number; byScope: Record<Scope, number> };
  sources: { label: string; scope: Scope; kg: number }[];
  intensity: { value: number; unit: string } | null;
  scope3: { label: string; status: string; kg: number; reason: string }[];
  factors: (FactorSnapshot & { uses: number })[];
  coverage: { completenessPct: number; missing: number; awaiting: { label: string; count: number }[]; invalid: number; estimated: number };
  evidence: { attached: number; total: number };
  limitations: string[];
  reductions: { title: string; type: string; status: string; capex: number; netSavings: number; payback: number | null; reductionT: number | null; assumptions: string; limitations: string }[];
  rows: Record<string, string | number | null>[];
}

export function buildReport(
  run: CalculationRun,
  ctx: { org: Organization; period: ReportingPeriod; facilities: Facility[]; reductionActions: ReductionAction[]; statusLabel: string; generatedAt?: string },
): ReportModel {
  const results = runResults(run, { facilityId: 'all' });
  const t = totals(results);
  const months = monthsBetween(ctx.period.startDate, ctx.period.endDate);
  const prod = productionSeries(run.inputs, ctx.period.id, months, { facilityId: 'all' }, ctx.facilities);
  const prodTotal = prod.rows.reduce((s, r) => s + (r.qty ?? 0), 0);
  const comp = completeness(run.inputs, ctx.period, ctx.facilities, { facilityId: 'all' });

  const factorMap = new Map<string, FactorSnapshot & { uses: number }>();
  for (const r of run.results) {
    if (!r.factor || r.emissionsKgCo2e === null) continue;
    const cur = factorMap.get(r.factor.factorId);
    if (cur) cur.uses += 1;
    else factorMap.set(r.factor.factorId, { ...r.factor, uses: 1 });
  }

  const awaitingMap = new Map<string, number>();
  run.results.filter((r) => r.status === 'awaiting_factor').forEach((r) => {
    const k = subtypeLabel(r.category, r.subtype);
    awaitingMap.set(k, (awaitingMap.get(k) ?? 0) + 1);
  });

  const emissionInputs = run.inputs.filter((i) => i.category !== 'production');
  const estimated = run.results.filter((r) => r.status === 'estimated').length;
  const factors = [...factorMap.values()];

  const limitations = [
    'Scope 2 is reported using the location-based method only; market-based Scope 2 is not reported.',
    `Scope 3 covers only the categories marked Calculated or Estimated (${SCOPE3_CATEGORIES.length} categories tracked in Cobalance; the GHG Protocol defines 15). It is not a complete value-chain inventory.`,
    'Estimated reductions are planning estimates. They are not verified emission reductions and are not carbon credits.',
    'This report has not been verified by a third party.',
  ];
  if (factors.some((f) => f.reviewStatus === 'provisional' && f.origin === 'library')) limitations.push('One or more library factors are provisional (pending verification against the source publication).');
  if (factors.some((f) => f.origin === 'sample')) limitations.push('ILLUSTRATIVE SAMPLE FACTORS were used. Results that depend on them must not be disclosed.');
  if (factors.some((f) => f.origin === 'user')) limitations.push('User-supplied factors were used; their sources are listed but have not been independently reviewed.');
  if (awaitingMap.size) limitations.push('Some activity records are excluded from totals because no documented emission factor was available.');
  if (comp.missing.length) limitations.push(`${comp.missing.length} monthly electricity/production entries are missing; totals are not gap-filled.`);
  if (estimated) limitations.push(`${estimated} results are based on estimated activity data or illustrative factors.`);
  if (factors.some((f) => f.conversions)) limitations.push('Fuel volumes were converted to mass using typical densities recorded with each factor.');

  const reductions = ctx.reductionActions
    .filter((a) => a.reportingPeriodId === ctx.period.id)
    .map((a) => {
      const r = computeScenario(a.actionType, a.inputs);
      return {
        title: a.title,
        type: ACTION_TYPES.find((x) => x.value === a.actionType)?.label ?? a.actionType,
        status: a.status.replace('_', ' '),
        capex: a.inputs.capex,
        netSavings: r.netAnnualSavings,
        payback: r.paybackYears,
        reductionT: r.reductionT,
        assumptions: a.assumptions,
        limitations: a.limitations,
      };
    });

  const facilityName = (id: string) => ctx.facilities.find((f) => f.id === id)?.name ?? id;
  const inputById = new Map(run.inputs.map((i) => [i.id, i]));
  const excluded = new Set(run.scope3Exclusions.map((x) => x.category));
  const rows = run.results.map((r) => {
    const i = inputById.get(r.activityId)!;
    return {
      run_id: run.id,
      facility: facilityName(i.facilityId),
      month: i.activityDate.slice(0, 7),
      scope: r.scope,
      category: categoryLabel(r.category),
      source: subtypeLabel(r.category, r.subtype),
      quantity: i.quantity,
      unit: i.unit,
      normalized_quantity: r.normalizedQuantity,
      normalized_unit: r.normalizedUnit,
      data_quality: i.dataQuality,
      evidence: i.evidenceDocumentId ? 'attached' : 'missing',
      status: r.status,
      in_boundary: excluded.has(r.category) ? 'no (excluded)' : 'yes',
      emissions_kg_co2e: r.emissionsKgCo2e,
      emissions_t_co2e: r.emissionsKgCo2e === null ? null : r.emissionsKgCo2e / 1000,
      factor_code: r.factor?.factorCode ?? null,
      factor_kg_co2e_per_unit: r.factor?.kgCo2ePerUnit ?? null,
      factor_unit: r.factor ? `kg CO2e / ${r.factor.activityUnit}` : null,
      factor_version: r.factor?.version ?? null,
      factor_source: r.factor?.sourceName ?? null,
      factor_status: r.factor ? (r.factor.origin === 'sample' ? 'sample (illustrative)' : r.factor.reviewStatus) : null,
      gwp: r.factor?.gwpReference === 'AR5' ? GWP_REFERENCE : r.factor?.gwpReference ?? null,
      warnings: r.warnings.join(' | '),
    };
  });

  return {
    title: `${ctx.org.name} — Sustainability Report ${ctx.period.label}`,
    statusLabel: ctx.statusLabel,
    generatedAt: ctx.generatedAt ?? new Date().toISOString(),
    org: ctx.org,
    period: ctx.period,
    facilities: ctx.facilities,
    run,
    totalsKg: { total: t.total, byScope: t.byScope },
    sources: bySource(results),
    intensity: prodTotal > 0 && !prod.mixedUnits && prod.unit ? { value: t.total / prodTotal, unit: prod.unit } : null,
    scope3: scope3Status(run, ctx.period, run.inputs).map((x) => ({ label: x.category.label, status: SCOPE3_STATUS_LABEL[x.status], kg: x.kg, reason: x.reason })),
    factors,
    coverage: { completenessPct: comp.pct, missing: comp.missing.length, awaiting: [...awaitingMap].map(([label, count]) => ({ label, count })), invalid: run.summary.counts.invalid, estimated },
    evidence: { attached: emissionInputs.filter((i) => i.evidenceDocumentId).length, total: emissionInputs.length },
    limitations,
    reductions,
    rows,
  };
}
