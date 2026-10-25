import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui';

export const CHART_INK = '#6B756E';
export const CHART_GRID = '#E3E9E2';
export const SINGLE_SERIES = '#236B45';
export const axisProps = { tick: { fill: CHART_INK, fontSize: 12 }, axisLine: false, tickLine: false } as const;

export function ChartCard({ title, description, children, action, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} action={action} />
      <div className="p-4">{children}</div>
    </Card>
  );
}

interface TooltipRow {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

/** Tooltip in text tokens; the colour swatch carries series identity. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TooltipRow[]; label?: string | number; format: (v: number) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === 'number');
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1 font-medium text-ink">{labelFormat ? labelFormat(String(label)) : label}</p>}
      {rows.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium text-ink">{format(p.value as number)}</span>
        </p>
      ))}
      {rows.length > 1 && (
        <p className="mt-1 flex justify-between border-t border-line pt-1 font-medium text-ink">
          <span>Total</span>
          <span>{format(rows.reduce((s, p) => s + (p.value as number), 0))}</span>
        </p>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="flex h-56 items-center justify-center rounded-lg bg-canvas px-6 text-center text-sm text-ink-muted">{children}</div>;
}
