import { describe, expect, it } from 'vitest';
import { calculateActivity, calculateAll, selectFactor } from './calculate';
import { DEFAULT_FACTORS } from './factors';
import { computeScenario } from './reduction';
import { convert } from './units';
import type { ActivityInput, EmissionFactor } from './types';

// Expected values below are worked by hand from the published IPCC 2006 / AR5 /
// CEA parameters, independently of the engine code.

const act = (over: Partial<ActivityInput>): ActivityInput => ({
  id: 'a1',
  category: 'stationary_combustion',
  subtype: 'diesel',
  activityDate: '2024-06-01',
  quantity: 1000,
  unit: 'L',
  dataQuality: 'measured',
  geography: 'IN',
  ...over,
});

describe('unit conversion', () => {
  it('converts within a dimension', () => {
    expect(convert(1.5, 'MWh', 'kWh')).toEqual({ ok: true, value: 1500 });
    expect(convert(2500, 'g', 'kg')).toEqual({ ok: true, value: 2.5 });
    expect(convert(3.6, 'GJ', 'kWh').ok && (convert(3.6, 'GJ', 'kWh') as { value: number }).value).toBeCloseTo(1000, 9);
  });
  it('refuses volume → mass without a density', () => {
    expect(convert(10, 'L', 'kg').ok).toBe(false);
  });
});

describe('Scope 1 — stationary combustion', () => {
  it('diesel 1000 L (density 0.835) → 2669.285415 kg CO2e', () => {
    // 835 kg × 43.0 MJ/kg = 0.035905 TJ
    // CO2 0.035905×74100 = 2660.5605; CH4 0.035905×3×28 = 3.01602; N2O 0.035905×0.6×265 = 5.708895
    const r = calculateActivity(act({}), DEFAULT_FACTORS);
    expect(r.status).toBe('calculated');
    expect(r.scope).toBe(1);
    expect(r.normalizedQuantity).toBeCloseTo(835, 9);
    expect(r.emissionsKgCo2e).toBeCloseTo(2669.285415, 6);
    expect(r.gases.map((g) => g.gas)).toEqual(['CO2', 'CH4', 'N2O']);
    expect(r.factor?.factorCode).toBe('IPCC06-S1-STAT-DIESEL');
  });

  it('LPG 190 kg → 567.5694915 kg CO2e', () => {
    const r = calculateActivity(act({ subtype: 'lpg', quantity: 190, unit: 'kg' }), DEFAULT_FACTORS);
    expect(r.emissionsKgCo2e).toBeCloseTo(567.5694915, 6);
  });

  it('coal has no default factor and is flagged, not zeroed', () => {
    const r = calculateActivity(act({ subtype: 'coal', quantity: 5, unit: 't' }), DEFAULT_FACTORS);
    expect(r.status).toBe('awaiting_factor');
    expect(r.emissionsKgCo2e).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/No approved or provisional emission factor/);
  });
});

describe('Scope 1 — refrigerants', () => {
  it('R-410A 2500 g → 2.5 kg × 1924 = 4810 kg CO2e', () => {
    const r = calculateActivity(act({ category: 'refrigerants', subtype: 'R-410A', quantity: 2500, unit: 'g' }), DEFAULT_FACTORS);
    expect(r.emissionsKgCo2e).toBeCloseTo(4810, 9);
  });
});

describe('Scope 2 — electricity', () => {
  it('12 MWh × 0.727 = 8724 kg CO2, flagged provisional', () => {
    const r = calculateActivity(act({ category: 'purchased_electricity', subtype: 'grid', quantity: 12, unit: 'MWh' }), DEFAULT_FACTORS);
    expect(r.scope).toBe(2);
    expect(r.emissionsKgCo2e).toBeCloseTo(8724, 9);
    expect(r.factor?.reviewStatus).toBe('provisional');
    expect(r.warnings.some((w) => w.includes('provisional'))).toBe(true);
  });
});

describe('Scope 3 — freight', () => {
  const tkmFactor: EmissionFactor = {
    ...DEFAULT_FACTORS[0],
    id: 'u1',
    factorCode: 'USER-TRUCK',
    category: 'upstream_transport',
    subtype: 'road_truck',
    activityUnit: 'tkm',
    components: [{ gas: 'CO2e', kgPerUnit: 0.1 }],
    conversions: undefined,
    origin: 'user',
    reviewStatus: 'provisional',
  };
  it('awaits a factor when the library has none', () => {
    const r = calculateActivity(
      act({ category: 'upstream_transport', subtype: 'road_truck', unit: 'tkm', quantity: null, distanceKm: 300, weightTonnes: 10 }),
      DEFAULT_FACTORS,
    );
    expect(r.status).toBe('awaiting_factor');
  });
  it('300 km × 10 t × 0.1 = 300 kg CO2e', () => {
    const r = calculateActivity(
      act({ category: 'upstream_transport', subtype: 'road_truck', unit: 'tkm', quantity: null, distanceKm: 300, weightTonnes: 10 }),
      [...DEFAULT_FACTORS, tkmFactor],
    );
    expect(r.scope).toBe(3);
    expect(r.emissionsKgCo2e).toBeCloseTo(300, 9);
  });
});

describe('validation', () => {
  it('missing quantity is invalid, never zero', () => {
    const r = calculateActivity(act({ quantity: null }), DEFAULT_FACTORS);
    expect(r.status).toBe('invalid');
    expect(r.emissionsKgCo2e).toBeNull();
  });
  it('rejects a unit not allowed for the source', () => {
    expect(calculateActivity(act({ unit: 'kWh' }), DEFAULT_FACTORS).status).toBe('invalid');
  });
  it('rejects negative quantities', () => {
    expect(calculateActivity(act({ quantity: -5 }), DEFAULT_FACTORS).status).toBe('invalid');
  });
  it('production records are not emissions', () => {
    const r = calculateActivity(act({ category: 'production', subtype: 'output', unit: 'units' }), DEFAULT_FACTORS);
    expect(r.status).toBe('not_applicable');
    expect(r.scope).toBeNull();
  });
});

describe('factor selection', () => {
  const grid = DEFAULT_FACTORS.find((f) => f.subtype === 'grid')!;
  it('skips retired factors and factors outside their validity window', () => {
    const retired = { ...grid, id: 'r', reviewStatus: 'retired' as const };
    const expired = { ...grid, id: 'e', validFrom: '2020-04-01', validTo: '2021-03-31' };
    const a = act({ category: 'purchased_electricity', subtype: 'grid', unit: 'kWh' });
    expect(selectFactor(a, [retired, expired])).toBeNull();
    expect(selectFactor(a, [retired, expired, grid])?.id).toBe(grid.id);
  });
  it('prefers approved over provisional, and exact geography over GLOBAL', () => {
    const approvedGlobal = { ...grid, id: 'g', geography: 'GLOBAL', reviewStatus: 'approved' as const };
    const approvedIn = { ...grid, id: 'i', reviewStatus: 'approved' as const };
    const a = act({ category: 'purchased_electricity', subtype: 'grid', unit: 'kWh' });
    expect(selectFactor(a, [grid, approvedGlobal])?.id).toBe(grid.id); // geography wins
    expect(selectFactor(a, [grid, approvedIn])?.id).toBe('i');
  });
});

describe('reconciliation', () => {
  it('scope totals equal the sum of individual results', () => {
    const { results, summary } = calculateAll(
      [
        act({ id: '1' }),
        act({ id: '2', category: 'purchased_electricity', subtype: 'grid', quantity: 10000, unit: 'kWh' }),
        act({ id: '3', subtype: 'coal', quantity: 1, unit: 't' }),
      ],
      DEFAULT_FACTORS,
    );
    const sum = results.reduce((s, r) => s + (r.emissionsKgCo2e ?? 0), 0);
    expect(summary.totalKg).toBeCloseTo(sum, 9);
    expect(summary.byScope[1]).toBeCloseTo(2669.285415, 6);
    expect(summary.byScope[2]).toBeCloseTo(7270, 9);
    expect(summary.counts.awaiting_factor).toBe(1);
  });
});

describe('reduction scenarios', () => {
  it('solar: 50 kWp × 1400 kWh/kWp on 200,000 kWh at ₹8', () => {
    const r = computeScenario('solar', {
      baselineQuantity: 200000,
      unitCost: 8,
      emissionFactorKgPerUnit: 0.727,
      reductionPct: 0,
      capex: 2250000,
      annualOperatingCost: 25000,
      solar: { capacityKwp: 50, yieldKwhPerKwpYear: 1400 },
    });
    expect(r.avoidedQuantity).toBe(70000);
    expect(r.annualSavings).toBe(560000);
    expect(r.netAnnualSavings).toBe(535000);
    expect(r.paybackYears).toBeCloseTo(2250000 / 535000, 9);
    expect(r.reductionT).toBeCloseTo(50.89, 9);
  });
  it('no payback when net savings are not positive; no reduction without a factor', () => {
    const r = computeScenario('waste_reduction', {
      baselineQuantity: 10, unitCost: 1000, emissionFactorKgPerUnit: null, reductionPct: 10, capex: 50000, annualOperatingCost: 5000,
    });
    expect(r.annualSavings).toBe(1000);
    expect(r.paybackYears).toBeNull();
    expect(r.reductionT).toBeNull();
  });
});
