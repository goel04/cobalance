// Reduction scenario maths. Pure functions — every output is derived from the
// inputs shown to the user, so the planner can display its working.

export type ReductionActionType =
  | 'solar'
  | 'efficient_machinery'
  | 'electricity_optimization'
  | 'fuel_reduction'
  | 'waste_reduction'
  | 'material_efficiency';

export interface ScenarioInputs {
  /** Baseline annual activity quantity (e.g. kWh, litres, tonnes). */
  baselineQuantity: number;
  /** Cost per unit of baseline activity (₹ / unit). */
  unitCost: number;
  /** kg CO2e per unit, or null when no factor is available. */
  emissionFactorKgPerUnit: number | null;
  /** Percentage of baseline activity avoided by the action (0–100). Ignored for solar. */
  reductionPct: number;
  /** Initial investment (₹). */
  capex: number;
  /** Additional annual operating cost of the action (₹/yr). */
  annualOperatingCost: number;
  /** Solar-only inputs. */
  solar?: { capacityKwp: number; yieldKwhPerKwpYear: number };
}

export interface ScenarioResult {
  avoidedQuantity: number;
  baselineCost: number;
  postActionCost: number;
  annualSavings: number;
  netAnnualSavings: number;
  paybackYears: number | null;
  baselineEmissionsT: number | null;
  postActionEmissionsT: number | null;
  reductionT: number | null;
  notes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeScenario(type: ReductionActionType, i: ScenarioInputs): ScenarioResult {
  const notes: string[] = [];
  let avoided: number;
  if (type === 'solar') {
    const gen = (i.solar?.capacityKwp ?? 0) * (i.solar?.yieldKwhPerKwpYear ?? 0);
    avoided = Math.min(gen, i.baselineQuantity);
    if (gen > i.baselineQuantity) {
      notes.push('Estimated generation exceeds baseline consumption; savings are capped at baseline (export credit not assumed).');
    }
  } else {
    avoided = i.baselineQuantity * (clamp(i.reductionPct, 0, 100) / 100);
  }

  const baselineCost = i.baselineQuantity * i.unitCost;
  const postActionCost = (i.baselineQuantity - avoided) * i.unitCost;
  const annualSavings = baselineCost - postActionCost;
  const netAnnualSavings = annualSavings - i.annualOperatingCost;
  const paybackYears = netAnnualSavings > 0 && i.capex >= 0 ? i.capex / netAnnualSavings : null;
  if (netAnnualSavings <= 0) notes.push('Net annual savings are zero or negative, so simple payback cannot be calculated.');

  let baselineEmissionsT: number | null = null;
  let postActionEmissionsT: number | null = null;
  let reductionT: number | null = null;
  if (i.emissionFactorKgPerUnit !== null) {
    baselineEmissionsT = (i.baselineQuantity * i.emissionFactorKgPerUnit) / 1000;
    postActionEmissionsT = ((i.baselineQuantity - avoided) * i.emissionFactorKgPerUnit) / 1000;
    reductionT = baselineEmissionsT - postActionEmissionsT;
  } else {
    notes.push('No emission factor is available for this baseline, so the emissions reduction is not estimated.');
  }

  return { avoidedQuantity: avoided, baselineCost, postActionCost, annualSavings, netAnnualSavings, paybackYears, baselineEmissionsT, postActionEmissionsT, reductionT, notes };
}

export const ACTION_TYPES: { value: ReductionActionType; label: string; baselineHint: string; defaultPct: number }[] = [
  { value: 'solar', label: 'Rooftop solar feasibility', baselineHint: 'Annual grid electricity (kWh)', defaultPct: 0 },
  { value: 'efficient_machinery', label: 'Efficient machinery', baselineHint: 'Annual electricity of targeted equipment (kWh)', defaultPct: 15 },
  { value: 'electricity_optimization', label: 'Electricity-use optimisation', baselineHint: 'Annual grid electricity (kWh)', defaultPct: 5 },
  { value: 'fuel_reduction', label: 'Fuel reduction', baselineHint: 'Annual fuel use', defaultPct: 10 },
  { value: 'waste_reduction', label: 'Waste reduction & recycling', baselineHint: 'Annual waste (t)', defaultPct: 20 },
  { value: 'material_efficiency', label: 'Material efficiency', baselineHint: 'Annual material purchased (t)', defaultPct: 3 },
];
