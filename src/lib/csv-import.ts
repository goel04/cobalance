import Papa from 'papaparse';
import { CATEGORY_BY_VALUE } from '@/lib/engine/catalog';
import type { ActivityCategory, DataQuality } from '@/lib/engine/types';
import type { ActivityDraft } from '@/lib/data/actions';
import type { ActivityRecord, Facility, ReportingPeriod } from '@/lib/data/types';

export const CSV_COLUMNS = ['facility', 'month', 'category', 'source', 'quantity', 'unit', 'distance_km', 'weight_tonnes', 'cost_inr', 'data_quality', 'notes'] as const;

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(',') +
  '\n' +
  [
    'Main Plant,2024-04,purchased_electricity,grid,42000,kWh,,,352800,measured,April DISCOM bill',
    'Main Plant,2024-04,stationary_combustion,diesel,800,L,,,73600,measured,DG set',
    'Main Plant,2024-04,upstream_transport,road_truck,,tkm,420,33,,estimated,Yarn delivery',
    'Main Plant,2024-04,production,output,50000,kg,,,,measured,',
  ].join('\n') +
  '\n';

export interface ParsedRow {
  line: number;
  raw: Record<string, string>;
  draft: ActivityDraft | null;
  errors: string[];
  warnings: string[];
}

const QUALITIES: DataQuality[] = ['measured', 'calculated', 'estimated'];

function num(v: string | undefined): number | null | 'bad' {
  const s = (v ?? '').trim().replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : 'bad';
}

/** Validate CSV rows against the catalogue, facilities, period and existing records. Pure: no writes. */
export function validateRows(
  rows: Record<string, string>[],
  ctx: { facilities: Facility[]; period: ReportingPeriod; existing: ActivityRecord[] },
): ParsedRow[] {
  const seen = new Set<string>();
  const start = ctx.period.startDate.slice(0, 7);
  const end = ctx.period.endDate.slice(0, 7);
  return rows.map((raw, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const get = (k: string) => (raw[k] ?? '').trim();

    const facility = ctx.facilities.find((f) => f.name.toLowerCase() === get('facility').toLowerCase());
    if (!facility) errors.push(`Unknown facility "${get('facility')}".`);

    const month = get('month');
    if (!/^\d{4}-\d{2}$/.test(month)) errors.push('Month must be YYYY-MM.');
    else if (month < start || month > end) errors.push(`Month ${month} is outside ${ctx.period.label}.`);

    const category = get('category') as ActivityCategory;
    const cat = CATEGORY_BY_VALUE[category];
    if (!cat) errors.push(`Unknown category "${get('category')}".`);
    const sub = cat?.subtypes.find((s) => s.value === get('source'));
    if (cat && !sub) errors.push(`Unknown source "${get('source')}" for ${cat.label}. Use one of: ${cat.subtypes.map((s) => s.value).join(', ')}.`);

    const unit = get('unit');
    if (sub && !sub.units.includes(unit)) errors.push(`Unit "${unit}" not allowed for ${sub.label}. Use: ${sub.units.join(', ')}.`);

    const qty = num(raw.quantity);
    const dist = num(raw.distance_km);
    const wt = num(raw.weight_tonnes);
    const cost = num(raw.cost_inr);
    for (const [k, v] of [['quantity', qty], ['distance_km', dist], ['weight_tonnes', wt], ['cost_inr', cost]] as const) {
      if (v === 'bad') errors.push(`${k} is not a number.`);
      else if (v !== null && v < 0) errors.push(`${k} cannot be negative.`);
    }
    let quantity = qty === 'bad' ? null : qty;
    if (cat?.freight) {
      if (typeof dist === 'number' && typeof wt === 'number') quantity = dist * wt;
      else if (quantity === null) errors.push('Freight rows need distance_km and weight_tonnes, or quantity in tkm.');
    } else if (quantity === null && qty !== 'bad') {
      errors.push('Quantity is missing. Missing data is never imported as zero.');
    }

    const quality = (get('data_quality') || 'measured').toLowerCase() as DataQuality;
    if (!QUALITIES.includes(quality)) errors.push('data_quality must be measured, calculated or estimated.');

    if (category === 'purchased_electricity' && quantity === null && typeof cost === 'number') {
      errors.push('A bill amount is not electricity consumption — enter kWh.');
    }

    let draft: ActivityDraft | null = null;
    if (errors.length === 0 && facility && cat && sub) {
      const activityDate = `${month}-01`;
      const key = `${facility.id}|${category}|${sub.value}|${month}`;
      if (seen.has(key)) warnings.push('Duplicate of an earlier row in this file.');
      seen.add(key);
      if (ctx.existing.some((a) => a.facilityId === facility.id && a.category === category && a.subtype === sub.value && a.activityDate.slice(0, 7) === month && a.reportingPeriodId === ctx.period.id)) {
        warnings.push('A record for this facility, source and month already exists.');
      }
      draft = {
        facilityId: facility.id,
        reportingPeriodId: ctx.period.id,
        category,
        subtype: sub.value,
        activityDate,
        quantity,
        unit: cat.freight ? 'tkm' : unit,
        distanceKm: cat.freight && typeof dist === 'number' ? dist : null,
        weightTonnes: cat.freight && typeof wt === 'number' ? wt : null,
        costAmount: typeof cost === 'number' ? cost : null,
        currency: 'INR',
        dataQuality: quality,
        dataSource: 'csv',
        evidenceDocumentId: null,
        reviewStatus: 'unreviewed',
        notes: get('notes'),
      };
    }
    return { line: i + 2, raw, draft, errors, warnings };
  });
}

export function parseCsv(text: string): { rows: Record<string, string>[]; error: string | null } {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim().toLowerCase() });
  const missing = ['facility', 'month', 'category', 'source', 'unit'].filter((c) => !res.meta.fields?.includes(c));
  if (missing.length) return { rows: [], error: `Missing required column(s): ${missing.join(', ')}. Download the template for the expected format.` };
  return { rows: res.data, error: null };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows);
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
