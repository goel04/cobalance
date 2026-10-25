const nf = (max: number, min = 0) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: max, minimumFractionDigits: min });

export const fmtNumber = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? '—' : nf(digits).format(v));
export const fmtTonnes = (kg: number | null | undefined, digits = 2) => (kg == null ? '—' : `${nf(digits, digits).format(kg / 1000)} tCO₂e`);
export const fmtKg = (kg: number | null | undefined) => (kg == null ? '—' : `${nf(1).format(kg)} kg CO₂e`);
export const fmtInr = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtMonth = (iso: string) => new Date(iso.slice(0, 7) + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
