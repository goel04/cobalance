import type { ActivityCategory, Scope } from './types';

export interface SubtypeDef {
  value: string;
  label: string;
  /** Units a user may enter for this subtype. The first is the default. */
  units: string[];
}

export interface CategoryDef {
  value: ActivityCategory;
  label: string;
  scope: Scope | null;
  /** GHG Protocol Scope 3 category number, where applicable. */
  scope3Category?: number;
  description: string;
  subtypes: SubtypeDef[];
  /** Freight-style input: distance × weight. */
  freight?: boolean;
}

const fuelUnitsLiquid = ['L', 'kL', 'kg', 't'];

export const CATEGORIES: CategoryDef[] = [
  {
    value: 'stationary_combustion',
    label: 'Stationary combustion',
    scope: 1,
    description: 'Fuel burned on site in boilers, furnaces, DG sets and ovens.',
    subtypes: [
      { value: 'diesel', label: 'Diesel (HSD)', units: fuelUnitsLiquid },
      { value: 'petrol', label: 'Petrol', units: fuelUnitsLiquid },
      { value: 'lpg', label: 'LPG', units: ['kg', 't', 'L'] },
      { value: 'natural_gas', label: 'Natural gas (PNG)', units: ['scm', 'kg', 't'] },
      { value: 'furnace_oil', label: 'Furnace oil', units: fuelUnitsLiquid },
      { value: 'coal', label: 'Coal', units: ['kg', 't'] },
    ],
  },
  {
    value: 'mobile_combustion',
    label: 'Mobile combustion',
    scope: 1,
    description: 'Fuel used in company-owned or controlled vehicles and forklifts.',
    subtypes: [
      { value: 'diesel', label: 'Diesel', units: fuelUnitsLiquid },
      { value: 'petrol', label: 'Petrol', units: fuelUnitsLiquid },
    ],
  },
  {
    value: 'refrigerants',
    label: 'Refrigerants',
    scope: 1,
    description: 'Refrigerant leaked or topped up in AC, chillers and cold rooms.',
    subtypes: [
      { value: 'R-410A', label: 'R-410A', units: ['kg', 'g'] },
      { value: 'R-32', label: 'R-32 (HFC-32)', units: ['kg', 'g'] },
      { value: 'R-134a', label: 'R-134a (HFC-134a)', units: ['kg', 'g'] },
      { value: 'R-404A', label: 'R-404A', units: ['kg', 'g'] },
    ],
  },
  {
    value: 'purchased_electricity',
    label: 'Purchased electricity',
    scope: 2,
    description: 'Grid electricity from DISCOM bills (location-based).',
    subtypes: [{ value: 'grid', label: 'Grid electricity', units: ['kWh', 'MWh'] }],
  },
  {
    value: 'purchased_heat_steam',
    label: 'Purchased steam / heat / cooling',
    scope: 2,
    description: 'Steam, heat or chilled water bought from a third party.',
    subtypes: [{ value: 'steam', label: 'Purchased steam', units: ['GJ', 'MWh', 'kWh'] }],
  },
  {
    value: 'purchased_goods',
    label: 'Purchased goods & raw materials',
    scope: 3,
    scope3Category: 1,
    description: 'Raw materials and components bought for production.',
    subtypes: [
      { value: 'steel', label: 'Steel', units: ['t', 'kg'] },
      { value: 'aluminium', label: 'Aluminium', units: ['t', 'kg'] },
      { value: 'plastic', label: 'Plastic resin', units: ['t', 'kg'] },
      { value: 'cement', label: 'Cement', units: ['t', 'kg'] },
      { value: 'cotton_yarn', label: 'Cotton yarn', units: ['t', 'kg'] },
      { value: 'other_material', label: 'Other material', units: ['t', 'kg'] },
    ],
  },
  {
    value: 'purchased_packaging',
    label: 'Purchased packaging',
    scope: 3,
    scope3Category: 1,
    description: 'Cartons, films and other packaging bought for products.',
    subtypes: [
      { value: 'corrugated_board', label: 'Corrugated board', units: ['t', 'kg'] },
      { value: 'plastic_film', label: 'Plastic film', units: ['t', 'kg'] },
    ],
  },
  {
    value: 'upstream_transport',
    label: 'Upstream transportation',
    scope: 3,
    scope3Category: 4,
    freight: true,
    description: 'Inbound freight paid for by your business (tonne-km).',
    subtypes: [
      { value: 'road_truck', label: 'Road — truck', units: ['tkm'] },
      { value: 'rail', label: 'Rail freight', units: ['tkm'] },
    ],
  },
  {
    value: 'waste',
    label: 'Waste generated in operations',
    scope: 3,
    scope3Category: 5,
    description: 'Waste sent off site, by type and treatment method.',
    subtypes: [
      { value: 'mixed_landfill', label: 'Mixed waste — landfill', units: ['t', 'kg'] },
      { value: 'paper_recycling', label: 'Paper/cardboard — recycling', units: ['t', 'kg'] },
      { value: 'plastic_recycling', label: 'Plastic — recycling', units: ['t', 'kg'] },
      { value: 'metal_recycling', label: 'Metal scrap — recycling', units: ['t', 'kg'] },
      { value: 'hazardous_incineration', label: 'Hazardous — incineration', units: ['t', 'kg'] },
    ],
  },
  {
    value: 'business_travel',
    label: 'Business travel',
    scope: 3,
    scope3Category: 6,
    description: 'Employee travel for work in vehicles you do not own.',
    subtypes: [
      { value: 'air_domestic', label: 'Air — domestic', units: ['pkm'] },
      { value: 'rail', label: 'Rail', units: ['pkm'] },
      { value: 'car_taxi', label: 'Car / taxi', units: ['pkm', 'km'] },
    ],
  },
  {
    value: 'employee_commuting',
    label: 'Employee commuting',
    scope: 3,
    scope3Category: 7,
    description: 'Staff travel between home and the factory.',
    subtypes: [
      { value: 'two_wheeler', label: 'Two-wheeler', units: ['pkm'] },
      { value: 'bus', label: 'Bus', units: ['pkm'] },
      { value: 'car', label: 'Car', units: ['pkm'] },
    ],
  },
  {
    value: 'production',
    label: 'Production output',
    scope: null,
    description: 'Units produced — used for emissions intensity, not emissions.',
    subtypes: [{ value: 'output', label: 'Production output', units: ['units', 'kg', 't', 'L'] }],
  },
];

export const CATEGORY_BY_VALUE: Record<ActivityCategory, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c]),
) as Record<ActivityCategory, CategoryDef>;

export function categoryLabel(c: ActivityCategory): string {
  return CATEGORY_BY_VALUE[c]?.label ?? c;
}

export function subtypeLabel(c: ActivityCategory, s: string): string {
  return CATEGORY_BY_VALUE[c]?.subtypes.find((x) => x.value === s)?.label ?? s;
}

export function scopeOf(c: ActivityCategory): Scope | null {
  return CATEGORY_BY_VALUE[c]?.scope ?? null;
}

export const SCOPE3_CATEGORIES = CATEGORIES.filter((c) => c.scope === 3);
