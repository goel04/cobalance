// Writes a whole organisation (facilities, periods, factors, evidence, records,
// scenarios, runs, reports) into Supabase as a new company owned by the caller.
// Used for the sample organisation and for importing data saved in this browser
// by the earlier demo version.
//
// Every id is replaced with a fresh one, so importing the same data twice (or
// from two accounts) never collides. If any step fails, the new company is
// deleted again (cascading to all of its rows) and uploaded files are removed:
// an import either completes or leaves nothing behind.

import type { EmissionFactor } from '@/lib/engine/types';
import { getSupabase } from '@/lib/supabase';
import { createCompanyRemote, saveRunRemote, uid, uploadEvidenceRemote, type OrgInput } from './actions';
import { check, EVIDENCE_BUCKET, factorRow, facilityRow, insertChunked, periodRow, reductionRow, activityRow } from './remote';
import { getDb } from './store';
import type { ActivityRecord, CalculationRun, EvidenceDocument, Facility, ReductionAction, Report, ReportingPeriod } from './types';

export interface Bundle {
  org: OrgInput & { onboardingStep: number };
  facilities: Facility[];
  periods: ReportingPeriod[];
  factors: EmissionFactor[];
  /** `blob` is the file content; documents without one are skipped (and reported). */
  evidence: (EvidenceDocument & { blob?: Blob | null })[];
  activities: ActivityRecord[];
  reductionActions: ReductionAction[];
  runs: CalculationRun[];
  reports: Report[];
}

export interface ImportResult {
  orgId: string;
  counts: { facilities: number; periods: number; activities: number; documents: number; scenarios: number; runs: number; reports: number };
  /** File names whose content was not found, so the document was not imported. */
  missingFiles: string[];
}

export async function importBundle(b: Bundle, opts: { isSample?: boolean; onProgress?: (step: string) => void } = {}): Promise<ImportResult> {
  const sb = getSupabase();
  const userId = getDb().session.userId;
  if (!userId) throw new Error('Please log in first.');
  const progress = opts.onProgress ?? (() => undefined);

  const ids = new Map<string, string>();
  const remap = (old: string) => {
    let n = ids.get(old);
    if (!n) ids.set(old, (n = uid()));
    return n;
  };
  const maybe = (old: string | null | undefined) => (old ? (ids.has(old) ? ids.get(old)! : null) : null);

  progress('Creating organisation');
  const orgId = await createCompanyRemote(b.org, !!opts.isSample);
  const uploaded: string[] = [];
  const missingFiles: string[] = [];

  try {
    progress('Facilities');
    await insertChunked(sb, 'facilities', b.facilities.map((f) => ({ id: remap(f.id), company_id: orgId, ...facilityRow(f) })));

    progress('Reporting periods');
    await insertChunked(sb, 'carbon_assessments', b.periods.map((p) => ({ id: remap(p.id), company_id: orgId, ...periodRow(p) })));

    progress('Emission factors');
    // Only company factors travel with an organisation; the shared library is already in the database.
    // Sample companies carry their illustrative 'sample' factors; real ones only user-supplied factors.
    const factors = b.factors.filter((f) => f.origin === (opts.isSample ? 'sample' : 'user'));
    await insertChunked(sb, 'emission_factors', factors.map((f) => factorRow({ ...f, id: remap(f.id) }, orgId)));

    progress('Supporting documents');
    for (const doc of b.evidence) {
      if (!doc.blob) {
        missingFiles.push(doc.fileName);
        continue;
      }
      const saved = await uploadEvidenceRemote(
        orgId,
        doc.blob,
        { facilityId: maybe(doc.facilityId), reportingPeriodId: maybe(doc.reportingPeriodId), documentType: doc.documentType, fileName: doc.fileName },
        remap(doc.id),
      );
      uploaded.push(saved.storagePath);
      if (doc.reviewStatus === 'reviewed') {
        check(await sb.from('evidence_documents').update({ review_status: 'reviewed' }).eq('id', saved.id));
      }
    }

    progress('Activity records');
    const activities = b.activities.filter((a) => ids.has(a.facilityId) && ids.has(a.reportingPeriodId));
    await insertChunked(
      sb,
      'emission_activities',
      activities.map((a) => ({
        id: remap(a.id),
        company_id: orgId,
        // RLS requires the importing user as creator.
        created_by: userId,
        ...activityRow({
          ...a,
          facilityId: ids.get(a.facilityId)!,
          reportingPeriodId: ids.get(a.reportingPeriodId)!,
          evidenceDocumentId: maybe(a.evidenceDocumentId),
        }),
      })),
    );

    progress('Reduction scenarios');
    const reductions = b.reductionActions.filter((a) => ids.has(a.reportingPeriodId));
    await insertChunked(
      sb,
      'reduction_actions',
      reductions.map((a) => ({ id: remap(a.id), company_id: orgId, ...reductionRow({ ...a, facilityId: maybe(a.facilityId), reportingPeriodId: ids.get(a.reportingPeriodId)! }) })),
    );

    progress('Calculation history');
    const runs = b.runs.filter((r) => ids.has(r.reportingPeriodId)).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    for (const run of runs) {
      const saved = await saveRunRemote({
        ...run,
        organizationId: orgId,
        reportingPeriodId: ids.get(run.reportingPeriodId)!,
        // Keep the snapshot faithful, but point it at the new ids.
        inputs: run.inputs.map((i) => ({
          ...i,
          id: ids.get(i.id) ?? i.id,
          organizationId: orgId,
          facilityId: ids.get(i.facilityId) ?? i.facilityId,
          reportingPeriodId: ids.get(i.reportingPeriodId) ?? i.reportingPeriodId,
          evidenceDocumentId: maybe(i.evidenceDocumentId),
        })),
        results: run.results.map((r) => ({ ...r, activityId: ids.get(r.activityId) ?? r.activityId })),
      });
      ids.set(run.id, saved.id);
    }

    progress('Reports');
    const reports = b.reports.filter((r) => ids.has(r.calculationRunId) && ids.has(r.reportingPeriodId));
    for (const r of reports) {
      const row = check(
        await sb
          .from('reports')
          .insert({
            company_id: orgId,
            assessment_id: ids.get(r.reportingPeriodId),
            calculation_run_id: ids.get(r.calculationRunId),
            report_type: r.reportType,
            file_name: r.fileName,
            created_by: userId,
          })
          .select('id')
          .single(),
      );
      // New reports always start as drafts (RLS); restore the reviewed state afterwards.
      if (r.status === 'reviewed_internally') check(await sb.from('reports').update({ status: r.status }).eq('id', row.id));
    }

    if (b.org.onboardingStep > (opts.isSample ? 4 : 1)) {
      check(await sb.from('companies').update({ onboarding_step: Math.min(4, b.org.onboardingStep) }).eq('id', orgId));
    }

    return {
      orgId,
      missingFiles,
      counts: {
        facilities: b.facilities.length,
        periods: b.periods.length,
        activities: activities.length,
        documents: b.evidence.length - missingFiles.length,
        scenarios: reductions.length,
        runs: runs.length,
        reports: reports.length,
      },
    };
  } catch (e) {
    // Roll back: deleting the company cascades to every row created above.
    await sb.from('companies').delete().eq('id', orgId);
    if (uploaded.length) await sb.storage.from(EVIDENCE_BUCKET).remove(uploaded).catch(() => undefined);
    throw e;
  }
}
