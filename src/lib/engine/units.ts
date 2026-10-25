// Unit normalisation. Each unit belongs to one dimension and has a multiplier
// to that dimension's base unit. Cross-dimension conversions (e.g. litres of
// fuel → kg) need a factor-specific density and are handled in convert().

type Dimension = 'mass' | 'volume' | 'energy' | 'gas_volume' | 'freight' | 'passenger' | 'distance' | 'count';

interface UnitDef {
  dimension: Dimension;
  toBase: number;
}

const UNITS: Record<string, UnitDef> = {
  g: { dimension: 'mass', toBase: 0.001 },
  kg: { dimension: 'mass', toBase: 1 },
  t: { dimension: 'mass', toBase: 1000 },
  L: { dimension: 'volume', toBase: 1 },
  kL: { dimension: 'volume', toBase: 1000 },
  m3: { dimension: 'volume', toBase: 1000 },
  kWh: { dimension: 'energy', toBase: 1 },
  MWh: { dimension: 'energy', toBase: 1000 },
  GJ: { dimension: 'energy', toBase: 1000 / 3.6 },
  scm: { dimension: 'gas_volume', toBase: 1 },
  tkm: { dimension: 'freight', toBase: 1 },
  pkm: { dimension: 'passenger', toBase: 1 },
  km: { dimension: 'distance', toBase: 1 },
  units: { dimension: 'count', toBase: 1 },
};

export const UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  t: 'tonnes',
  L: 'litres',
  kL: 'kilolitres',
  m3: 'm³',
  kWh: 'kWh',
  MWh: 'MWh',
  GJ: 'GJ',
  scm: 'scm',
  tkm: 'tonne-km',
  pkm: 'passenger-km',
  km: 'vehicle-km',
  units: 'units',
};

export function isKnownUnit(unit: string): boolean {
  return unit in UNITS;
}

export interface Conversions {
  densityKgPerL?: number;
  densityKgPerScm?: number;
}

export type ConvertResult = { ok: true; value: number; note?: string } | { ok: false; reason: string };

/** Convert `value` from `from` unit to `to` unit, using densities where dimensions differ. */
export function convert(value: number, from: string, to: string, conversions: Conversions = {}): ConvertResult {
  const f = UNITS[from];
  const t = UNITS[to];
  if (!f) return { ok: false, reason: `Unknown unit "${from}".` };
  if (!t) return { ok: false, reason: `Unknown unit "${to}".` };
  if (f.dimension === t.dimension) {
    return { ok: true, value: (value * f.toBase) / t.toBase };
  }
  // Volume/gas-volume → mass via density, then onwards.
  const toMassKg = (): ConvertResult => {
    if (f.dimension === 'mass') return { ok: true, value: value * f.toBase };
    if (f.dimension === 'volume' && conversions.densityKgPerL) {
      return { ok: true, value: value * f.toBase * conversions.densityKgPerL, note: `density ${conversions.densityKgPerL} kg/L` };
    }
    if (f.dimension === 'gas_volume' && conversions.densityKgPerScm) {
      return { ok: true, value: value * f.toBase * conversions.densityKgPerScm, note: `density ${conversions.densityKgPerScm} kg/scm` };
    }
    return { ok: false, reason: `Cannot convert ${from} to ${to} without a documented density.` };
  };
  const mass = toMassKg();
  if (!mass.ok) return mass;
  if (t.dimension === 'mass') return { ok: true, value: mass.value / t.toBase, note: mass.note };
  if (t.dimension === 'volume' && conversions.densityKgPerL) {
    return { ok: true, value: mass.value / conversions.densityKgPerL / t.toBase, note: `density ${conversions.densityKgPerL} kg/L` };
  }
  if (t.dimension === 'gas_volume' && conversions.densityKgPerScm) {
    return { ok: true, value: mass.value / conversions.densityKgPerScm / t.toBase, note: `density ${conversions.densityKgPerScm} kg/scm` };
  }
  return { ok: false, reason: `Cannot convert ${from} to ${to}.` };
}
