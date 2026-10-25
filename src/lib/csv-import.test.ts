import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseCsv, validateRows } from './csv-import';
import type { Facility, ReportingPeriod } from '@/lib/data/types';

const facility = { id: 'f1', name: 'Main Plant' } as Facility;
const period = { id: 'p1', label: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31' } as ReportingPeriod;

describe('CSV import validation', () => {
  it('accepts the template rows and derives tonne-km for freight', () => {
    const { rows, error } = parseCsv(CSV_TEMPLATE);
    expect(error).toBeNull();
    const parsed = validateRows(rows, { facilities: [facility], period, existing: [] });
    expect(parsed.every((p) => p.errors.length === 0)).toBe(true);
    const freight = parsed.find((p) => p.draft?.category === 'upstream_transport')!;
    expect(freight.draft?.quantity).toBe(420 * 33);
    expect(freight.draft?.unit).toBe('tkm');
  });

  it('rejects missing quantity, bad units, out-of-period months and unknown facilities', () => {
    const csv = [
      'facility,month,category,source,quantity,unit,cost_inr',
      'Main Plant,2024-05,purchased_electricity,grid,,kWh,5000',
      'Main Plant,2024-05,stationary_combustion,diesel,10,kWh,',
      'Main Plant,2023-05,purchased_electricity,grid,100,kWh,',
      'Other,2024-05,purchased_electricity,grid,100,kWh,',
    ].join('\n');
    const parsed = validateRows(parseCsv(csv).rows, { facilities: [facility], period, existing: [] });
    expect(parsed[0].errors.join()).toMatch(/bill amount is not electricity consumption/);
    expect(parsed[1].errors.join()).toMatch(/Unit "kWh" not allowed/);
    expect(parsed[2].errors.join()).toMatch(/outside FY 2024-25/);
    expect(parsed[3].errors.join()).toMatch(/Unknown facility/);
  });

  it('warns on duplicates within the file', () => {
    const csv = ['facility,month,category,source,quantity,unit', 'Main Plant,2024-05,purchased_electricity,grid,1,kWh', 'Main Plant,2024-05,purchased_electricity,grid,2,kWh'].join('\n');
    const parsed = validateRows(parseCsv(csv).rows, { facilities: [facility], period, existing: [] });
    expect(parsed[1].warnings.join()).toMatch(/Duplicate/);
  });

  it('reports missing required columns', () => {
    expect(parseCsv('foo,bar\n1,2').error).toMatch(/Missing required column/);
  });
});
