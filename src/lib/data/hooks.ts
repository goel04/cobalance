import { useMemo } from 'react';
import { useDb } from './store';
import { canAdmin, canEdit, factorsFor, roleOf } from './actions';

export function useAuth() {
  const db = useDb();
  const user = db.users.find((u) => u.id === db.session.userId) ?? null;
  return { db, user };
}

/**
 * Everything the app needs about the active organisation, scoped by membership.
 * Records from organisations the user does not belong to are never returned.
 */
export function useOrg() {
  const db = useDb();
  const { session } = db;
  return useMemo(() => {
    const userId = session.userId;
    const role = roleOf(db, session.organizationId, userId);
    const org = role ? db.organizations.find((o) => o.id === session.organizationId) ?? null : null;
    const orgId = org?.id ?? null;
    const myOrgs = db.organizations.filter((o) => db.memberships.some((m) => m.organizationId === o.id && m.userId === userId));
    const periods = db.periods.filter((p) => p.organizationId === orgId).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const period = periods.find((p) => p.id === session.periodId) ?? periods[0] ?? null;
    const facilities = db.facilities.filter((f) => f.organizationId === orgId);
    const facilityId = facilities.some((f) => f.id === session.facilityId) ? session.facilityId : 'all';
    const activities = db.activities.filter((a) => a.organizationId === orgId);
    const periodActivities = period ? activities.filter((a) => a.reportingPeriodId === period.id) : [];
    const runs = db.runs.filter((r) => r.organizationId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const periodRuns = period ? runs.filter((r) => r.reportingPeriodId === period.id) : [];
    const latestRun = periodRuns[0] ?? null;
    const lastChange = periodActivities.reduce((m, a) => (a.updatedAt > m ? a.updatedAt : m), '');
    const deletedSinceRun = latestRun ? latestRun.inputs.some((i) => !periodActivities.some((a) => a.id === i.id)) : false;
    const runIsStale = !!latestRun && (lastChange > latestRun.createdAt || deletedSinceRun || periodActivities.length !== latestRun.inputs.length);
    return {
      db,
      userId,
      org,
      orgId,
      role,
      canEdit: canEdit(role),
      canAdmin: canAdmin(role),
      myOrgs,
      periods,
      period,
      facilities,
      facilityId,
      activities,
      periodActivities,
      evidence: db.evidence.filter((e) => e.organizationId === orgId),
      runs,
      periodRuns,
      latestRun,
      runIsStale,
      reductionActions: db.reductionActions.filter((a) => a.organizationId === orgId),
      reports: db.reports.filter((r) => r.organizationId === orgId),
      factors: factorsFor(db, orgId),
      customFactors: db.factors.filter((f) => f.organizationId === orgId),
      audit: db.audit.filter((e) => e.organizationId === orgId),
    };
  }, [db, session]);
}

export type OrgContext = ReturnType<typeof useOrg>;
