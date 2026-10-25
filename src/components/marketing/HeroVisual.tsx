import { Droplets, Flame, Sun, Zap } from 'lucide-react';
import { IllustrativeLabel } from './sections';

// Every figure here is invented for illustration and is labelled as such.
const SCOPES = [
  { label: 'Scope 1', sub: 'Fuel & refrigerants', value: 182, color: '#174A32' },
  { label: 'Scope 2', sub: 'Purchased electricity', value: 341, color: '#236B45' },
  { label: 'Scope 3', sub: 'Assessed categories', value: 96, color: '#A7C4A0' },
];
const MONTHS = [62, 58, 64, 55, 52, 49];

export function HeroVisual() {
  const total = SCOPES.reduce((s, x) => s + x.value, 0);
  // Donut geometry
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Annual footprint</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {total} <span className="text-base font-medium text-ink-muted">tCO₂e</span>
            </p>
          </div>
          <IllustrativeLabel />
        </div>

        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[140px_1fr]">
          <svg viewBox="0 0 120 120" className="mx-auto h-32 w-32 -rotate-90" role="img" aria-label="Illustrative donut chart of emissions by scope">
            <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF5F0" strokeWidth="16" />
            {SCOPES.map((s) => {
              const len = (s.value / total) * c;
              const el = <circle key={s.label} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
          </svg>
          <ul className="space-y-2.5">
            {SCOPES.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{s.label}</span> <span className="text-ink-muted">· {s.sub}</span>
                </span>
                <span className="font-medium tabular-nums text-ink">{s.value} t</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Zap, label: 'Electricity', value: '468 MWh' },
            { icon: Flame, label: 'Diesel', value: '41 kL' },
            { icon: Droplets, label: 'Intensity', value: '0.42 t/t' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-line bg-canvas p-2.5">
              <m.icon className="h-4 w-4 text-forest" aria-hidden />
              <p className="mt-1.5 text-[11px] text-ink-muted">{m.label}</p>
              <p className="text-sm font-semibold tabular-nums text-ink">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-ink-muted">Monthly emissions (tCO₂e)</p>
          <div className="mt-2 flex h-16 items-end gap-2" aria-hidden>
            {MONTHS.map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-sage" style={{ height: `${(v / 64) * 100}%`, opacity: 0.55 + i * 0.08 }} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative -mt-4 ml-auto w-[88%] rounded-xl border border-forest-100 bg-forest-50 p-4 shadow-card sm:-mr-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest text-white">
            <Sun className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-forest-deep">Reduction opportunity: rooftop solar</p>
            <p className="mt-0.5 text-xs leading-relaxed text-forest-deep/80">
              Est. 51 tCO₂e/yr avoided · ₹5.4 L/yr savings · ~4.2 yr simple payback
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
