// Domain types shared by the calculation engine and the data layer.
// Field names mirror the planned Supabase schema (snake_case columns ↔ camelCase here).

export type Scope = 1 | 2 | 3;

export type Gas = 'CO2' | 'CH4' | 'N2O' | 'HFC-134a' | 'HFC-32' | 'R-410A' | 'R-404A' | 'HCFC-22' | 'CO2e';

export type FactorReviewStatus = 'approved' | 'provisional' | 'retired';

export type DataQuality = 'measured' | 'calculated' | 'estimated';

export type ActivityCategory =
  | 'stationary_combustion'
  | 'mobile_combustion'
  | 'refrigerants'
  | 'purchased_electricity'
  | 'purchased_heat_steam'
  | 'purchased_goods'
  | 'purchased_packaging'
  | 'upstream_transport'
  | 'waste'
  | 'business_travel'
  | 'employee_commuting'
  | 'production';

export interface FactorComponent {
  gas: Gas;
  /** kg of this gas emitted per one `activityUnit` of activity. */
  kgPerUnit: number;
}

export interface EmissionFactor {
  id: string;
  factorCode: string;
  category: ActivityCategory;
  /** Sub-type the factor applies to, e.g. 'diesel', 'R-410A', 'steel'. */
  subtype: string;
  /** Unit the activity quantity must be expressed in before applying the factor. */
  activityUnit: string;
  components: FactorComponent[];
  /** Display string for the composite factor unit, e.g. 'kg CO2e / kWh'. */
  factorUnit: string;
  geography: string; // ISO country code or 'GLOBAL'
  validFrom: string; // ISO date
  validTo: string | null;
  publicationYear: number;
  sourceName: string;
  sourceUrl: string;
  methodology: string;
  version: string;
  gwpReference: 'AR5' | 'AR6' | 'n/a';
  reviewStatus: FactorReviewStatus;
  /** Conversion assumptions, e.g. fuel density, used to normalise units. */
  conversions?: { densityKgPerL?: number; densityKgPerScm?: number };
  notes?: string;
  /** User-supplied factors are flagged so reports can disclose them. */
  origin: 'library' | 'user' | 'sample';
  organizationId?: string | null;
}

export interface ActivityInput {
  id: string;
  category: ActivityCategory;
  subtype: string;
  activityDate: string; // ISO date (first day of reporting month)
  quantity: number | null;
  unit: string;
  dataQuality: DataQuality;
  geography: string;
  /** Freight: distance (km) and transported weight (tonnes) when unit is tkm-derived. */
  distanceKm?: number | null;
  weightTonnes?: number | null;
}

export type ResultStatus = 'calculated' | 'estimated' | 'awaiting_factor' | 'invalid' | 'not_applicable';

export interface FactorSnapshot {
  factorId: string;
  factorCode: string;
  kgCo2ePerUnit: number;
  activityUnit: string;
  factorUnit: string;
  sourceName: string;
  sourceUrl: string;
  version: string;
  publicationYear: number;
  geography: string;
  gwpReference: string;
  reviewStatus: FactorReviewStatus;
  origin: EmissionFactor['origin'];
  components: FactorComponent[];
  conversions?: EmissionFactor['conversions'];
}

export interface GasResult {
  gas: Gas;
  kgGas: number;
  gwp: number;
  kgCo2e: number;
}

export interface CalculationResult {
  activityId: string;
  scope: Scope | null;
  category: ActivityCategory;
  subtype: string;
  status: ResultStatus;
  inputQuantity: number | null;
  inputUnit: string;
  normalizedQuantity: number | null;
  normalizedUnit: string | null;
  emissionsKgCo2e: number | null;
  gases: GasResult[];
  factor: FactorSnapshot | null;
  warnings: string[];
}
