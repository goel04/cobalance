import { useMemo, useState } from 'react';
import { Calculator, ExternalLink, Plus, Settings2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Input, Notice, PageHeader, Select, Stat, Tabs, td, th } from '@/components/ui';
import { attempt } from '@/components/ui/toast';
import { ActivityFormDialog } from '@/components/app/ActivityForm';
import { CalcStatusBadge, EvidenceBadge, FactorStatusBadge, Scope3StatusBadge, recordCalcStatus } from '@/components/app/status';
import { CATEGORIES, SCOPE3_CATEGORIES, categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { UNIT_LABELS } from '@/lib/engine/units';
import type { ActivityCategory, Scope } from '@/lib/engine/types';
import { createCalculationRun, setScope3Exclusions } from '@/lib/data/actions';
import { bySource, runResults, scope3Status } from '@/lib/data/analytics';
import { useOrg } from '@/lib/data/hooks';
import type { CalculationRun, Scope3Exclusion } from '@/lib/data/types';
import { fmtDateTime, fmtMonth, fmtNumber } from '@/lib/format';

type Tab = 'summary' | '1' | '2' | '3';

export default function CalculatorPage() {
  const { org, period, periodActivities, periodRuns, latestRun, runIsStale, canEdit, facilityId } = useOrg();
  const [tab, setTab] = useState<Tab>('summary');
  const [runId, setRunId] = useState<string>('latest');
  const [adding, setAdding] = useState<{ scope: Scope; category?: ActivityCategory } | null>(null);
  const run = runId === 'latest' ? latestRun : periodRuns.find((r) => r.id === runId) ?? latestRun;

  if (!org || !period) return null;

  const calculate = () => {
    const id = attempt(() => createCalculationRun(org.id, period.id), 'Calculation run saved');
    if (id) setRunId('latest');
  };

  return (
    <>
      <PageHeader
        title="Carbon calculator"
        description="Scope 1, 2 and 3 emissions calculated from your activity records and a documented, versioned emission-factor library."
        actions={
          canEdit && (
            <Button onClick={calculate} disabled={periodActivities.length === 0}>
              <Calculator className="h-4 w-4" /> Calculate footprint
            </Button>
          )
        }
      />

      {latestRun && runIsStale && (
        <Notice tone="warning" className="mb-4" title="Activity data changed since the last run">
          Records marked “Not calculated” are not in any saved run yet. Click “Calculate footprint” to create a new run — earlier runs are kept unchanged.
        </Notice>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'summary', label: 'Summary' },
            { value: '1', label: 'Scope 1 · Direct' },
            { value: '2', label: 'Scope 2 · Energy' },
            { value: '3', label: 'Scope 3 · Value chain' },
          ]}
        />
        {periodRuns.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="run-select" className="text-xs font-medium text-ink-muted">
              Calculation run
            </label>
            <Select id="run-select" className="h-9 w-64" value={runId} onChange={(e) => setRunId(e.target.value)}>
              <option value="latest">Latest ({fmtDateTime(periodRuns[0].createdAt)})</option>
              {periodRuns.slice(1).map((r) => (
                <option key={r.id} value={r.id}>
                  {fmtDateTime(r.createdAt)} · {fmtNumber(r.summary.totalKg / 1000, 2)} t
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {tab === 'summary' ? (
        <Summary run={run} facilityId={facilityId} onCalculate={canEdit ? calculate : undefined} hasRecords={periodActivities.length > 0} />
      ) : (
        <ScopeTab scope={Number(tab) as Scope} run={run} onAdd={(category) => setAdding({ scope: Number(tab) as Scope, category })} />
      )}

      <ActivityFormDialog open={adding !== null} onClose={() => setAdding(null)} scope={adding?.scope} defaultCategory={adding?.category} />
    </>
  );
}

function Summary({ run, facilityId, onCalculate, hasRecords }: { run: CalculationRun | null; facilityId: string; onCalculate?: () => void; hasRecords: boolean }) {
  const { period, periodActivities } = useOrg();
  if (!run || !period) {
    return (
      <Card>
        <EmptyState
          icon={<Calculator className="h-6 w-6" />}
          title="No calculation runs yet"
          description={hasRecords ? 'Run a calculation to turn your activity records into a saved, reproducible footprint.' : 'Add activity data first, then calculate your footprint.'}
          action={hasRecords && onCalculate ? <Button onClick={onCalculate}>Calculate footprint</Button> : undefined}
        />
      </Card>
    );
  }
  const results = runResults(run, { facilityId });
  const sources = bySource(results);
  const sumResults = results.reduce((s, r) => s + (r.emissionsKgCo2e ?? 0), 0);
  const byScope = { 1: 0, 2: 0, 3: 0 } as Record<Scope, number>;
  results.forEach((r) => r.scope && r.emissionsKgCo2e !== null && (byScope[r.scope] += r.emissionsKgCo2e));
  const total = byScope[1] + byScope[2] + byScope[3];
  const reconciles = Math.abs(total - sumResults) < 1e-6;
  const s3 = scope3Status(run, period, periodActivities);
  const s3Assessed = s3.filter((x) => x.status === 'calculated' || x.status === 'estimated').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total assessed" value={`${fmtNumber(total / 1000, 2)} t`} sub={`${fmtNumber(total, 0)} kg CO₂e`} />
        <Stat label="Scope 1" value={`${fmtNumber(byScope[1] / 1000, 2)} t`} sub={`${fmtNumber(byScope[1], 0)} kg CO₂e`} />
        <Stat label="Scope 2 (location-based)" value={`${fmtNumber(byScope[2] / 1000, 2)} t`} sub={`${fmtNumber(byScope[2], 0)} kg CO₂e`} />
        <Stat label="Scope 3 (assessed only)" value={`${fmtNumber(byScope[3] / 1000, 2)} t`} sub={`${s3Assessed} of ${SCOPE3_CATEGORIES.length} categories assessed`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Source breakdown" description="Emissions by activity source in this run" />
          {sources.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">No sources could be calculated in this run.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>Source</th>
                    <th className={th}>Scope</th>
                    <th className={`${th} text-right`}>kg CO₂e</th>
                    <th className={`${th} text-right`}>tCO₂e</th>
                    <th className={`${th} text-right`}>Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sources.map((s) => (
                    <tr key={s.key}>
                      <td className={td}>{s.label}</td>
                      <td className={td}>{s.scope}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtNumber(s.kg, 1)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtNumber(s.kg / 1000, 3)}</td>
                      <td className={`${td} text-right tabular-nums`}>{total ? `${fmtNumber((s.kg / total) * 100, 1)}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-canvas/60 font-medium">
                    <td className={td}>Total</td>
                    <td className={td} />
                    <td className={`${td} text-right tabular-nums`}>{fmtNumber(total, 1)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtNumber(total / 1000, 3)}</td>
                    <td className={`${td} text-right`}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Run details" />
          <dl className="space-y-3 p-5 text-sm">
            <Row k="Created" v={fmtDateTime(run.createdAt)} />
            <Row k="Status" v={run.status === 'completed' ? <Badge tone="green">Completed</Badge> : <Badge tone="amber">Completed with warnings</Badge>} />
            <Row k="Engine version" v={run.engineVersion} />
            <Row k="Methodology" v={run.methodologyVersion} />
            <Row k="Records in run" v={run.inputs.length} />
            <Row k="Calculated" v={run.summary.counts.calculated} />
            <Row k="Estimated" v={run.summary.counts.estimated} />
            <Row k="Awaiting factor" v={run.summary.counts.awaiting_factor} />
            <Row k="Invalid" v={run.summary.counts.invalid} />
            <Row k="Totals reconcile" v={reconciles ? <Badge tone="green">Yes — scope totals = Σ results</Badge> : <Badge tone="red">No</Badge>} />
          </dl>
        </Card>
      </div>

      <Notice tone="info" title="Scope 3 is not complete">
        Only the categories marked Calculated or Estimated are included. Categories not yet assessed or excluded from the boundary are not counted — see the Scope 3 tab.
      </Notice>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-ink-muted">{k}</dt>
    <dd className="text-right font-medium">{v}</dd>
  </div>
);

function ScopeTab({ scope, run, onAdd }: { scope: Scope; run: CalculationRun | null; onAdd: (c?: ActivityCategory) => void }) {
  const { period, periodActivities, facilityId, facilities, canEdit, canAdmin } = useOrg();
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const cats = CATEGORIES.filter((c) => c.scope === scope);
  const records = useMemo(
    () => periodActivities.filter((a) => cats.some((c) => c.value === a.category) && (facilityId === 'all' || a.facilityId === facilityId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodActivities, scope, facilityId],
  );
  if (!period) return null;
  const s3 = scope === 3 ? scope3Status(run, period, periodActivities) : [];
  const excluded = new Set((run?.scope3Exclusions ?? period.scope3Exclusions).map((x) => x.category));

  return (
    <div className="space-y-6">
      {scope === 2 && (
        <Notice tone="info" title="Location-based method">
          Scope 2 uses the Indian grid average emission factor from the CEA CO₂ Baseline Database. Market-based accounting (RECs, green tariffs, PPAs) is not yet supported and is not
          reported.
        </Notice>
      )}
      {scope === 3 && (
        <Card>
          <CardHeader
            title="Scope 3 category coverage"
            description="Scope 3 is reported only for the categories assessed. It is not a complete value-chain inventory."
            action={
              canAdmin && (
                <Button variant="outline" size="sm" onClick={() => setBoundaryOpen(true)}>
                  <Settings2 className="h-4 w-4" /> Edit boundary
                </Button>
              )
            }
          />
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {s3.map((x) => (
              <li key={x.category.value} className="bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{x.category.label}</p>
                    <p className="text-xs text-ink-muted">GHG Protocol category {x.category.scope3Category}</p>
                  </div>
                  <Scope3StatusBadge status={x.status} />
                </div>
                {x.status === 'excluded' && <p className="mt-2 text-xs text-ink-muted">Reason: {x.reason}</p>}
                {(x.status === 'calculated' || x.status === 'estimated') && <p className="mt-2 text-sm font-medium">{fmtNumber(x.kg / 1000, 2)} tCO₂e</p>}
                {x.status === 'awaiting_factor' && <p className="mt-2 text-xs text-amber-700">Records exist but no documented factor is available yet.</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {cats.map((c) => {
        const recs = records.filter((r) => r.category === c.value).sort((a, b) => a.activityDate.localeCompare(b.activityDate));
        const kg = recs.reduce((s, r) => s + (recordCalcStatus(r, run).kg ?? 0), 0);
        return (
          <Card key={c.value}>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {c.label}
                  {excluded.has(c.value) && <Badge tone="blue">Excluded from boundary</Badge>}
                </span>
              }
              description={c.description}
              action={
                <div className="flex items-center gap-3">
                  {recs.length > 0 && (
                    <span className="text-sm font-medium tabular-nums">
                      {fmtNumber(kg / 1000, 3)} tCO₂e <span className="font-normal text-ink-muted">({fmtNumber(kg, 0)} kg)</span>
                    </span>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => onAdd(c.value)}>
                      <Plus className="h-4 w-4" /> Add activity
                    </Button>
                  )}
                </div>
              }
            />
            {recs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-muted">No records for this period — this source has not been assessed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="border-b border-line bg-canvas/60">
                    <tr>
                      <th className={th}>Month</th>
                      <th className={th}>Source</th>
                      {facilities.length > 1 && <th className={th}>Facility</th>}
                      <th className={`${th} text-right`}>Activity</th>
                      <th className={th}>Evidence</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>kg CO₂e</th>
                      <th className={`${th} text-right`}>tCO₂e</th>
                      <th className={th}>Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {recs.map((r) => {
                      const calc = recordCalcStatus(r, run);
                      const res = run?.results.find((x) => x.activityId === r.id && calc.status !== 'pending');
                      return (
                        <tr key={r.id} className="align-top">
                          <td className={td}>{fmtMonth(r.activityDate)}</td>
                          <td className={td}>{subtypeLabel(r.category, r.subtype)}</td>
                          {facilities.length > 1 && <td className={td}>{facilities.find((f) => f.id === r.facilityId)?.name}</td>}
                          <td className={`${td} text-right tabular-nums`}>
                            {r.quantity === null ? '—' : `${fmtNumber(r.quantity, 2)} ${UNIT_LABELS[r.unit] ?? r.unit}`}
                            {res?.normalizedQuantity != null && res.normalizedUnit !== r.unit && (
                              <p className="text-xs text-ink-muted">
                                = {fmtNumber(res.normalizedQuantity, 2)} {res.normalizedUnit}
                              </p>
                            )}
                          </td>
                          <td className={td}>
                            <EvidenceBadge attached={!!r.evidenceDocumentId} />
                          </td>
                          <td className={td}>
                            <CalcStatusBadge status={calc.status} />
                            {calc.warnings.map((w) => (
                              <p key={w} className="mt-1 max-w-xs text-xs text-amber-700">
                                {w}
                              </p>
                            ))}
                          </td>
                          <td className={`${td} text-right tabular-nums`}>{calc.kg !== null ? fmtNumber(calc.kg, 1) : '—'}</td>
                          <td className={`${td} text-right tabular-nums`}>{calc.kg !== null ? fmtNumber(calc.kg / 1000, 3) : '—'}</td>
                          <td className={`${td} text-xs`}>
                            {res?.factor ? (
                              <div className="space-y-1">
                                <p className="font-medium">{res.factor.factorCode}</p>
                                <p className="text-ink-muted">
                                  {fmtNumber(res.factor.kgCo2ePerUnit, 4)} kg CO₂e/{res.factor.activityUnit} · {res.factor.version}
                                </p>
                                <FactorStatusBadge status={res.factor.reviewStatus} origin={res.factor.origin} />
                                {res.factor.sourceUrl && (
                                  <a href={res.factor.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-forest hover:underline">
                                    Source <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {res.gases.length > 1 && (
                                  <p className="text-ink-muted">
                                    {res.gases.map((g) => `${g.gas} ${fmtNumber(g.kgGas, 3)} kg × ${g.gwp}`).join(' · ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {scope === 3 && boundaryOpen && <BoundaryDialog open onClose={() => setBoundaryOpen(false)} />}
    </div>
  );
}

function BoundaryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { period } = useOrg();
  const [draft, setDraft] = useState<Scope3Exclusion[]>(period?.scope3Exclusions ?? []);
  const [error, setError] = useState<string | null>(null);
  if (!period) return null;
  const toggle = (c: ActivityCategory, on: boolean) => setDraft((d) => (on ? [...d, { category: c, reason: '' }] : d.filter((x) => x.category !== c)));
  const save = () => {
    if (draft.some((x) => !x.reason.trim())) return setError('Give a reason for every excluded category — reports disclose it.');
    if (attempt(() => (setScope3Exclusions(period.id, draft), true), 'Reporting boundary updated')) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Scope 3 reporting boundary"
      description="Excluded categories are disclosed with their reason and left out of totals. Recalculate after changing the boundary."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save boundary</Button>
        </>
      }
    >
      <ul className="space-y-3">
        {SCOPE3_CATEGORIES.map((c) => {
          const ex = draft.find((x) => x.category === c.value);
          return (
            <li key={c.value} className="rounded-lg border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="accent-forest" checked={!!ex} onChange={(e) => toggle(c.value, e.target.checked)} />
                Exclude {categoryLabel(c.value)}
              </label>
              {ex && (
                <Input
                  className="mt-2"
                  placeholder="Reason for exclusion"
                  aria-label={`Reason for excluding ${c.label}`}
                  value={ex.reason}
                  onChange={(e) => setDraft((d) => d.map((x) => (x.category === c.value ? { ...x, reason: e.target.value } : x)))}
                />
              )}
            </li>
          );
        })}
      </ul>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Dialog>
  );
}
