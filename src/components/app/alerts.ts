import { useMemo } from 'react';
import { completeness } from '@/lib/data/analytics';
import { useOrg } from '@/lib/data/hooks';

export interface Alert {
  id: string;
  title: string;
  detail: string;
  to: string;
}

/** Real, data-derived alerts for the active period — never placeholder notifications. */
export function useAlerts(): Alert[] {
  const { period, periodActivities, latestRun, runIsStale, facilities, facilityId } = useOrg();
  return useMemo(() => {
    if (!period) return [];
    const out: Alert[] = [];
    if (periodActivities.length > 0 && !latestRun) {
      out.push({ id: 'norun', title: 'Footprint not calculated yet', detail: `${periodActivities.length} records are waiting for a calculation run.`, to: '/app/calculator' });
    }
    if (runIsStale) {
      out.push({ id: 'stale', title: 'Results are out of date', detail: 'Activity data changed after the last calculation run. Recalculate to update.', to: '/app/calculator' });
    }
    if (latestRun) {
      const awaiting = latestRun.summary.counts.awaiting_factor;
      if (awaiting) out.push({ id: 'awaiting', title: `${awaiting} record${awaiting > 1 ? 's' : ''} awaiting an emission factor`, detail: 'These are excluded from totals until a documented factor is added.', to: '/app/calculator' });
      const invalid = latestRun.summary.counts.invalid;
      if (invalid) out.push({ id: 'invalid', title: `${invalid} record${invalid > 1 ? 's' : ''} could not be calculated`, detail: 'Check units and quantities.', to: '/app/activity-data' });
    }
    const c = completeness(periodActivities, period, facilities, { facilityId });
    if (c.missing.length) out.push({ id: 'missing', title: `${c.missing.length} missing monthly entries`, detail: 'Electricity or production data is missing for some months.', to: '/app/activity-data' });
    return out;
  }, [period, periodActivities, latestRun, runIsStale, facilities, facilityId]);
}
