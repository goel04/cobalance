import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Notice, PageHeader, Select, td, th } from '@/components/ui';
import { attempt, toast } from '@/components/ui/toast';
import { recordReport, setReportStatus } from '@/lib/data/actions';
import { useOrg } from '@/lib/data/hooks';
import type { CalculationRun, Report } from '@/lib/data/types';
import { buildReport } from '@/lib/reports/build';
import { downloadText, toCsv } from '@/lib/csv-import';
import { fmtDateTime, fmtNumber } from '@/lib/format';

const STATUS_LABEL: Record<Report['status'], string> = { draft: 'Draft', reviewed_internally: 'Reviewed internally' };

export default function ReportsPage() {
  const { org, period, periodRuns, reports, facilities, reductionActions, runs, periods, canAdmin, runIsStale } = useOrg();
  const [runId, setRunId] = useState('');
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  if (!org || !period) return null;
  const run = periodRuns.find((r) => r.id === runId) ?? periodRuns[0] ?? null;

  /** Regenerates the file from the run's saved snapshot, so re-downloads are reproducible. */
  const produce = async (r: CalculationRun, type: 'pdf' | 'csv', status: Report['status'], generatedAt: string, fileName: string) => {
    const p = periods.find((x) => x.id === r.reportingPeriodId)!;
    const model = buildReport(r, { org, period: p, facilities, reductionActions, statusLabel: STATUS_LABEL[status], generatedAt });
    if (type === 'csv') {
      downloadText(fileName, toCsv(model.rows));
    } else {
      const { renderPdf } = await import('@/lib/reports/pdf');
      renderPdf(model).save(fileName);
    }
  };

  const generate = async (type: 'pdf' | 'csv') => {
    if (!run) return;
    setBusy(type);
    try {
      const stamp = new Date().toISOString();
      const fileName = `cobalance-${period.label.replace(/\s+/g, '-')}-${stamp.slice(0, 10)}.${type}`;
      await produce(run, type, 'draft', stamp, fileName);
      attempt(() => recordReport(org.id, { reportingPeriodId: period.id, calculationRunId: run.id, reportType: type, fileName }));
      toast(`${type.toUpperCase()} report downloaded`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not generate the report.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const redownload = async (rep: Report) => {
    const r = runs.find((x) => x.id === rep.calculationRunId);
    if (!r) return toast('The calculation run for this report no longer exists.', 'error');
    try {
      await produce(r, rep.reportType, rep.status, rep.generatedAt, rep.fileName);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not regenerate the report.', 'error');
    }
  };

  const periodReports = reports.filter((r) => r.reportingPeriodId === period.id);

  return (
    <>
      <PageHeader title="Reports" description="Downloadable sustainability reports, each tied to a saved calculation run so results stay reproducible." />

      {!run ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Calculate your footprint first"
            description="Reports are generated from a saved calculation run. Run a calculation in the Carbon Calculator, then come back here."
            action={<ButtonLink to="/app/calculator">Go to calculator</ButtonLink>}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Create a report" description={`${period.label} · includes methodology, factor sources and versions, coverage, evidence status, limitations and reduction scenarios.`} />
          <div className="space-y-4 p-5">
            {runIsStale && run.id === periodRuns[0]?.id && (
              <Notice tone="warning">Activity data has changed since this run. The report will reflect the run, not the latest edits — recalculate first if you want them included.</Notice>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="rep-run" className="mb-1 block text-xs font-medium text-ink-muted">
                  Calculation run
                </label>
                <Select id="rep-run" className="h-10 w-72" value={run.id} onChange={(e) => setRunId(e.target.value)}>
                  {periodRuns.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      {i === 0 ? 'Latest · ' : ''}
                      {fmtDateTime(r.createdAt)} · {fmtNumber(r.summary.totalKg / 1000, 2)} tCO₂e
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={() => generate('pdf')} loading={busy === 'pdf'}>
                <FileText className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" onClick={() => generate('csv')} loading={busy === 'csv'}>
                <FileSpreadsheet className="h-4 w-4" /> Download CSV
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              New reports are labelled <strong>Draft</strong>. An admin can mark them <strong>Reviewed internally</strong>. Cobalance never labels a report as third-party verified.
            </p>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Report history" description="Re-downloading regenerates the file from the same calculation run." />
        {periodReports.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">No reports generated for {period.label} yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className={th}>Generated</th>
                  <th className={th}>Type</th>
                  <th className={th}>Calculation run</th>
                  <th className={th}>Status</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {periodReports.map((rep) => {
                  const r = runs.find((x) => x.id === rep.calculationRunId);
                  return (
                    <tr key={rep.id}>
                      <td className={td}>{fmtDateTime(rep.generatedAt)}</td>
                      <td className={td}>
                        <Badge>{rep.reportType.toUpperCase()}</Badge>
                      </td>
                      <td className={`${td} text-xs text-ink-muted`}>{r ? `${fmtDateTime(r.createdAt)} · ${fmtNumber(r.summary.totalKg / 1000, 2)} t` : 'Run deleted'}</td>
                      <td className={td}>
                        {canAdmin ? (
                          <Select
                            aria-label="Report status"
                            className="h-8 w-48 text-xs"
                            value={rep.status}
                            onChange={(e) => attempt(() => setReportStatus(rep.id, e.target.value as Report['status']), 'Report status updated')}
                          >
                            <option value="draft">Draft</option>
                            <option value="reviewed_internally">Reviewed internally</option>
                          </Select>
                        ) : (
                          <Badge tone={rep.status === 'draft' ? 'neutral' : 'green'}>{STATUS_LABEL[rep.status]}</Badge>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <Button variant="ghost" size="sm" onClick={() => redownload(rep)} disabled={!r}>
                          <Download className="h-4 w-4" /> Download
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
