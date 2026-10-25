import type { EmissionFactor, FactorComponent, Gas } from './types';

/**
 * IPCC AR5 100-year global warming potentials (without climate-carbon feedback),
 * as used by the GHG Protocol and most national inventories through 2024.
 * Blends (R-410A, R-404A) are mass-weighted from their constituents.
 */
export const GWP_AR5: Record<Gas, number> = {
  CO2: 1,
  CH4: 28,
  N2O: 265,
  'HFC-134a': 1300,
  'HFC-32': 677,
  'R-410A': 1924, // 50% HFC-32 (677) + 50% HFC-125 (3170)
  'R-404A': 3943, // 44% HFC-125 + 52% HFC-143a + 4% HFC-134a
  'HCFC-22': 1760,
  CO2e: 1,
};

export const GWP_REFERENCE = 'IPCC AR5, 100-year GWP';

const IPCC_2006_URL = 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html';
const IPCC_AR5_URL = 'https://www.ipcc.ch/report/ar5/wg1/';
const CEA_URL = 'https://cea.nic.in/cdm-co2-baseline-database/?lang=en';

/**
 * Per-kg-of-fuel gas factors from IPCC 2006 defaults:
 * kg gas / kg fuel = NCV (TJ/Gg = MJ/kg) × EF (kg/TJ) × 1e-6.
 */
function ipccFuelPerKg(ncvMjPerKg: number, co2KgPerTj: number, ch4KgPerTj: number, n2oKgPerTj: number): FactorComponent[] {
  return [
    { gas: 'CO2', kgPerUnit: ncvMjPerKg * co2KgPerTj * 1e-6 },
    { gas: 'CH4', kgPerUnit: ncvMjPerKg * ch4KgPerTj * 1e-6 },
    { gas: 'N2O', kgPerUnit: ncvMjPerKg * n2oKgPerTj * 1e-6 },
  ];
}

const ipccBase = {
  geography: 'GLOBAL',
  validFrom: '2006-01-01',
  validTo: null,
  publicationYear: 2006,
  sourceName: '2006 IPCC Guidelines for National GHG Inventories, Vol. 2 (Energy)',
  sourceUrl: IPCC_2006_URL,
  gwpReference: 'AR5' as const,
  reviewStatus: 'approved' as const,
  origin: 'library' as const,
  activityUnit: 'kg',
  factorUnit: 'kg gas / kg fuel',
};

const densityNote =
  'Litre inputs are converted to kg using the stated typical density. Replace with your supplier\'s density for higher accuracy.';

export const DEFAULT_FACTORS: EmissionFactor[] = [
  // ── Scope 1: stationary combustion (IPCC Vol.2 Ch.2, Tables 1.2, 1.4, 2.3 — manufacturing industries)
  {
    ...ipccBase,
    id: 'f-ipcc-stat-diesel-1',
    factorCode: 'IPCC06-S1-STAT-DIESEL',
    category: 'stationary_combustion',
    subtype: 'diesel',
    components: ipccFuelPerKg(43.0, 74100, 3, 0.6),
    methodology: 'Tier 1 fuel-based: NCV 43.0 TJ/Gg; CO2 74,100, CH4 3, N2O 0.6 kg/TJ (gas/diesel oil).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.835 },
    notes: densityNote,
  },
  {
    ...ipccBase,
    id: 'f-ipcc-stat-petrol-1',
    factorCode: 'IPCC06-S1-STAT-PETROL',
    category: 'stationary_combustion',
    subtype: 'petrol',
    components: ipccFuelPerKg(44.3, 69300, 3, 0.6),
    methodology: 'Tier 1 fuel-based: NCV 44.3 TJ/Gg; CO2 69,300, CH4 3, N2O 0.6 kg/TJ (motor gasoline).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.745 },
    notes: densityNote,
  },
  {
    ...ipccBase,
    id: 'f-ipcc-stat-lpg-1',
    factorCode: 'IPCC06-S1-STAT-LPG',
    category: 'stationary_combustion',
    subtype: 'lpg',
    components: ipccFuelPerKg(47.3, 63100, 1, 0.1),
    methodology: 'Tier 1 fuel-based: NCV 47.3 TJ/Gg; CO2 63,100, CH4 1, N2O 0.1 kg/TJ (LPG).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.51 },
    notes: 'LPG is normally purchased by weight (e.g. 19 kg commercial cylinders); prefer kg inputs.',
  },
  {
    ...ipccBase,
    id: 'f-ipcc-stat-ng-1',
    factorCode: 'IPCC06-S1-STAT-NG',
    category: 'stationary_combustion',
    subtype: 'natural_gas',
    components: ipccFuelPerKg(48.0, 56100, 1, 0.1),
    methodology: 'Tier 1 fuel-based: NCV 48.0 TJ/Gg; CO2 56,100, CH4 1, N2O 0.1 kg/TJ (natural gas).',
    version: '2006-v1',
    conversions: { densityKgPerScm: 0.75 },
    notes: 'scm inputs use an assumed density of 0.75 kg/scm. Gas composition varies by supplier; use the GCV/density on your PNG bill where available.',
  },
  {
    ...ipccBase,
    id: 'f-ipcc-stat-fo-1',
    factorCode: 'IPCC06-S1-STAT-FO',
    category: 'stationary_combustion',
    subtype: 'furnace_oil',
    components: ipccFuelPerKg(40.4, 77400, 3, 0.6),
    methodology: 'Tier 1 fuel-based: NCV 40.4 TJ/Gg; CO2 77,400, CH4 3, N2O 0.6 kg/TJ (residual fuel oil).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.95 },
    notes: densityNote,
  },
  // Coal is deliberately absent: Indian coal NCV differs widely from IPCC defaults,
  // so it requires a site-specific factor (GCV from supplier test certificates).

  // ── Scope 1: mobile combustion (IPCC Vol.2 Ch.3, Tables 3.2.1, 3.2.2 — road transport)
  {
    ...ipccBase,
    id: 'f-ipcc-mob-diesel-1',
    factorCode: 'IPCC06-S1-MOB-DIESEL',
    category: 'mobile_combustion',
    subtype: 'diesel',
    components: ipccFuelPerKg(43.0, 74100, 3.9, 3.9),
    methodology: 'Tier 1 road transport: NCV 43.0 TJ/Gg; CO2 74,100, CH4 3.9, N2O 3.9 kg/TJ (diesel).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.835 },
    notes: densityNote,
  },
  {
    ...ipccBase,
    id: 'f-ipcc-mob-petrol-1',
    factorCode: 'IPCC06-S1-MOB-PETROL',
    category: 'mobile_combustion',
    subtype: 'petrol',
    components: ipccFuelPerKg(44.3, 69300, 33, 3.2),
    methodology: 'Tier 1 road transport: NCV 44.3 TJ/Gg; CO2 69,300, CH4 33, N2O 3.2 kg/TJ (motor gasoline, uncontrolled).',
    version: '2006-v1',
    conversions: { densityKgPerL: 0.745 },
    notes: densityNote,
  },

  // ── Scope 1: refrigerants (mass leaked/replenished × GWP)
  ...(
    [
      ['R-410A', 'R-410A'],
      ['R-32', 'HFC-32'],
      ['R-134a', 'HFC-134a'],
      ['R-404A', 'R-404A'],
    ] as const
  ).map(
    ([subtype, gas]): EmissionFactor => ({
      id: `f-ar5-ref-${subtype.toLowerCase()}-1`,
      factorCode: `AR5-S1-REF-${subtype}`,
      category: 'refrigerants',
      subtype,
      activityUnit: 'kg',
      components: [{ gas, kgPerUnit: 1 }],
      factorUnit: 'kg CO2e / kg refrigerant',
      geography: 'GLOBAL',
      validFrom: '2014-01-01',
      validTo: null,
      publicationYear: 2014,
      sourceName: 'IPCC Fifth Assessment Report (AR5), WG1 Ch.8, Table 8.A.1',
      sourceUrl: IPCC_AR5_URL,
      methodology: 'Mass-balance / top-up method: refrigerant replenished is assumed equal to refrigerant leaked.',
      version: 'AR5-v1',
      gwpReference: 'AR5',
      reviewStatus: 'approved',
      origin: 'library',
    }),
  ),

  // ── Scope 2: Indian grid electricity, location-based
  {
    id: 'f-cea-grid-v20',
    factorCode: 'CEA-S2-GRID-IN-FY2024',
    category: 'purchased_electricity',
    subtype: 'grid',
    activityUnit: 'kWh',
    components: [{ gas: 'CO2', kgPerUnit: 0.727 }],
    factorUnit: 'kg CO2 / kWh',
    geography: 'IN',
    validFrom: '2023-04-01',
    validTo: null,
    publicationYear: 2024,
    sourceName: 'CEA CO2 Baseline Database for the Indian Power Sector, v20.0 — weighted average emission factor, FY 2023-24',
    sourceUrl: CEA_URL,
    methodology:
      'Location-based Scope 2 (GHG Protocol Scope 2 Guidance). Weighted average CO2 emission rate of the integrated Indian grid, adjusted for renewable generation.',
    version: 'v20.0',
    gwpReference: 'n/a',
    reviewStatus: 'provisional',
    origin: 'library',
    notes:
      'Provisional: 0.727 tCO2/MWh is taken from secondary reporting of CEA v20.0 and must be confirmed against the CEA user guide before external disclosure. CEA v22.0 (2026) revised earlier years for captive data; check for an updated factor. CO2 only — CH4/N2O are not published by CEA.',
  },
];
