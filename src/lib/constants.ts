export const INDUSTRIES = [
  'Textiles & apparel',
  'Food & beverage processing',
  'Engineering & fabricated metals',
  'Auto components',
  'Chemicals & dyes',
  'Plastics & polymers',
  'Pharmaceuticals',
  'Paper & packaging',
  'Ceramics & glass',
  'Leather & footwear',
  'Electrical & electronics',
  'Foundry & forging',
  'Other manufacturing',
];

export const COMPANY_SIZES = ['1–10 employees', '11–50 employees', '51–200 employees', '201–500 employees', '500+ employees'];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const FACILITY_TYPES = ['Manufacturing plant', 'Assembly unit', 'Processing unit', 'Warehouse', 'Office', 'Other'];

export const PRODUCTION_UNITS = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 't', label: 'Tonnes (t)' },
  { value: 'units', label: 'Units / pieces' },
  { value: 'L', label: 'Litres (L)' },
];

export const DOCUMENT_TYPES = ['Electricity bill', 'Fuel invoice', 'Purchase invoice', 'Weighbridge slip', 'Waste manifest', 'Service report', 'Other'];

/** Suggested reporting periods; users can always enter exact custom dates. */
export function periodPresets(today = new Date()) {
  const y = today.getFullYear();
  const fyStart = today.getMonth() >= 3 ? y : y - 1;
  const fy = (s: number) => ({ label: `FY ${s}-${String((s + 1) % 100).padStart(2, '0')}`, startDate: `${s}-04-01`, endDate: `${s + 1}-03-31` });
  const cy = (s: number) => ({ label: `CY ${s}`, startDate: `${s}-01-01`, endDate: `${s}-12-31` });
  return [fy(fyStart - 1), fy(fyStart), cy(y - 1), cy(y)];
}

/** First day of each month in [start, end]. */
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const last = end.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= last && out.length < 120) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
