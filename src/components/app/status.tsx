import { Badge } from '@/components/ui';
import type { ResultStatus } from '@/lib/engine/types';
import type { ActivityRecord, CalculationRun } from '@/lib/data/types';
import type { Scope3Status } from '@/lib/data/analytics';
import { SCOPE3_STATUS_LABEL } from '@/lib/data/analytics';

export type RecordCalcStatus = ResultStatus | 'pending';

/** Calculation status of a record relative to the latest run (pending = added or changed since). */
export function recordCalcStatus(record: ActivityRecord, run: CalculationRun | null): { status: RecordCalcStatus; warnings: string[]; kg: number | null } {
  if (!run || record.updatedAt > run.createdAt) return { status: 'pending', warnings: [], kg: null };
  const r = run.results.find((x) => x.activityId === record.id);
  if (!r) return { status: 'pending', warnings: [], kg: null };
  return { status: r.status, warnings: r.warnings, kg: r.emissionsKgCo2e };
}

const CALC: Record<RecordCalcStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' | 'blue' | 'sage' }> = {
  calculated: { label: 'Calculated', tone: 'green' },
  estimated: { label: 'Estimated', tone: 'sage' },
  awaiting_factor: { label: 'Awaiting factor', tone: 'amber' },
  invalid: { label: 'Invalid', tone: 'red' },
  not_applicable: { label: 'Intensity input', tone: 'neutral' },
  pending: { label: 'Not calculated', tone: 'blue' },
};

export function CalcStatusBadge({ status }: { status: RecordCalcStatus }) {
  return <Badge tone={CALC[status].tone}>{CALC[status].label}</Badge>;
}

export function EvidenceBadge({ attached }: { attached: boolean }) {
  return attached ? <Badge tone="green">Attached</Badge> : <Badge tone="neutral">Missing</Badge>;
}

export function QualityBadge({ quality }: { quality: ActivityRecord['dataQuality'] }) {
  return <Badge tone={quality === 'measured' ? 'green' : quality === 'calculated' ? 'sage' : 'amber'}>{quality[0].toUpperCase() + quality.slice(1)}</Badge>;
}

export function FactorStatusBadge({ status, origin }: { status: string; origin?: string }) {
  if (origin === 'sample') return <Badge tone="blue">Sample (illustrative)</Badge>;
  if (status === 'approved') return <Badge tone="green">Approved</Badge>;
  if (status === 'provisional') return <Badge tone="amber">Provisional</Badge>;
  return <Badge tone="neutral">Retired</Badge>;
}

const S3_TONE: Record<Scope3Status, 'green' | 'sage' | 'amber' | 'neutral' | 'blue'> = {
  calculated: 'green',
  estimated: 'sage',
  awaiting_factor: 'amber',
  not_assessed: 'neutral',
  excluded: 'blue',
};

export function Scope3StatusBadge({ status }: { status: Scope3Status }) {
  return <Badge tone={S3_TONE[status]}>{SCOPE3_STATUS_LABEL[status]}</Badge>;
}

export function ScopeBadge({ scope }: { scope: 1 | 2 | 3 | null }) {
  if (!scope) return <Badge tone="neutral">Intensity</Badge>;
  return <Badge tone={scope === 1 ? 'green' : scope === 2 ? 'sage' : 'neutral'}>Scope {scope}</Badge>;
}

// Validated categorical palette (dataviz validator: CVD + lightness + chroma pass on light surface).
export const SCOPE_COLORS = { 1: '#2F7D4E', 2: '#3A7FC0', 3: '#C98A2B' } as const;
