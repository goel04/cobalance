import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Dialog, Field, Input, Notice, PageHeader, Select, Tabs, Textarea, td, th } from '@/components/ui';
import { attempt, toast } from '@/components/ui/toast';
import { OrganizationForm } from '@/components/app/forms';
import { FactorStatusBadge } from '@/components/app/status';
import { CATEGORIES, CATEGORY_BY_VALUE, categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { factorKgCo2ePerUnit } from '@/lib/engine/calculate';
import { GWP_AR5, GWP_REFERENCE } from '@/lib/engine/factors';
import type { ActivityCategory, EmissionFactor } from '@/lib/engine/types';
import { addCustomFactor, createPeriod, resetAllDemoData, retireFactor, setFactorStatus, switchOrganization, updateOrganization } from '@/lib/data/actions';
import { createSampleOrganization } from '@/lib/data/seed';
import { useOrg } from '@/lib/data/hooks';
import { downloadText } from '@/lib/csv-import';
import { periodPresets } from '@/lib/constants';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';

type Tab = 'org' | 'periods' | 'factors' | 'members' | 'audit' | 'data';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('org');
  return (
    <>
      <PageHeader title="Settings" description="Organisation, reporting periods, emission factors, members and data." />
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'org', label: 'Organisation' },
          { value: 'periods', label: 'Reporting periods' },
          { value: 'factors', label: 'Emission factors' },
          { value: 'members', label: 'Members' },
          { value: 'audit', label: 'Audit history' },
          { value: 'data', label: 'Data' },
        ]}
      />
      {tab === 'org' && <OrgTab />}
      {tab === 'periods' && <PeriodsTab />}
      {tab === 'factors' && <FactorsTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'data' && <DataTab />}
    </>
  );
}

function OrgTab() {
  const { org, canAdmin } = useOrg();
  if (!org) return null;
  return (
    <Card>
      <CardHeader title="Organisation profile" description={canAdmin ? undefined : 'Only admins and owners can edit the profile.'} />
      <div className="p-5">
        <OrganizationForm key={org.id} defaultValues={org} disabled={!canAdmin} submitLabel="Save changes" onSubmit={(v) => attempt(() => updateOrganization(org.id, v), 'Organisation updated')} />
      </div>
    </Card>
  );
}

function PeriodsTab() {
  const { org, periods, canAdmin } = useOrg();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ label: '', startDate: '', endDate: '' });
  if (!org) return null;
  return (
    <Card>
      <CardHeader
        title="Reporting periods"
        description="Each period stores exact start and end dates and the methodology version used."
        action={
          canAdmin && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add period
            </Button>
          )
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-line bg-canvas/60">
            <tr>
              <th className={th}>Period</th>
              <th className={th}>Start</th>
              <th className={th}>End</th>
              <th className={th}>Methodology</th>
              <th className={th}>Scope 3 exclusions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {periods.map((p) => (
              <tr key={p.id}>
                <td className={`${td} font-medium`}>{p.label}</td>
                <td className={td}>{fmtDate(p.startDate)}</td>
                <td className={td}>{fmtDate(p.endDate)}</td>
                <td className={`${td} text-xs`}>{p.methodologyVersion}</td>
                <td className={`${td} text-xs`}>{p.scope3Exclusions.map((x) => categoryLabel(x.category)).join(', ') || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add reporting period"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!v.label.trim() || !v.startDate || !v.endDate) return toast('Enter a name, start date and end date.', 'error');
                if (attempt(() => createPeriod(org.id, v), 'Reporting period added')) {
                  setOpen(false);
                  setV({ label: '', startDate: '', endDate: '' });
                }
              }}
            >
              Add period
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {periodPresets().map((p) => (
            <Button key={p.label} size="sm" variant="secondary" onClick={() => setV(p)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" required>
            {(p) => <Input {...p} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />}
          </Field>
          <Field label="Start date" required>
            {(p) => <Input type="date" {...p} value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />}
          </Field>
          <Field label="End date" required>
            {(p) => <Input type="date" {...p} value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}

function FactorsTab() {
  const { factors, canAdmin } = useOrg();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const list = factors.filter((f) => filter === 'all' || f.reviewStatus !== 'retired');
  return (
    <div className="space-y-6">
      <Notice tone="info" title="How factors are chosen">
        For each activity, Cobalance selects a non-retired factor matching the source, geography (India first, then global) and the activity date, preferring approved over provisional. If none
        exists, the activity is flagged “Awaiting factor” and excluded from totals — values are never invented. Factors are never edited in place: retire a factor and add a new version, so
        past calculation runs keep the exact factor they used. GWPs: {GWP_REFERENCE} (CH₄ {GWP_AR5.CH4}, N₂O {GWP_AR5.N2O}).
      </Notice>
      <Card>
        <CardHeader
          title="Emission factor library"
          description={`${list.length} factors`}
          action={
            <div className="flex gap-2">
              <Select aria-label="Show factors" className="h-8 w-36 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as 'active' | 'all')}>
                <option value="active">Active only</option>
                <option value="all">Include retired</option>
              </Select>
              {canAdmin && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Add factor
                </Button>
              )}
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Applies to</th>
                <th className={`${th} text-right`}>kg CO₂e / unit</th>
                <th className={th}>Gases</th>
                <th className={th}>Geography · validity</th>
                <th className={th}>Source · version</th>
                <th className={th}>Status</th>
                {canAdmin && <th className={th} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className={`${td} text-xs font-medium`}>{f.factorCode}</td>
                  <td className={`${td} text-xs`}>
                    {subtypeLabel(f.category, f.subtype)}
                    <p className="text-ink-muted">{categoryLabel(f.category)}</p>
                  </td>
                  <td className={`${td} text-right text-xs tabular-nums`}>
                    {fmtNumber(factorKgCo2ePerUnit(f), 4)} / {f.activityUnit}
                    {f.conversions?.densityKgPerL && <p className="text-ink-muted">density {f.conversions.densityKgPerL} kg/L</p>}
                    {f.conversions?.densityKgPerScm && <p className="text-ink-muted">density {f.conversions.densityKgPerScm} kg/scm</p>}
                  </td>
                  <td className={`${td} text-xs`}>{f.components.map((c) => c.gas).join(', ')}</td>
                  <td className={`${td} text-xs`}>
                    {f.geography} · from {f.validFrom}
                    {f.validTo ? ` to ${f.validTo}` : ''}
                  </td>
                  <td className={`${td} max-w-xs text-xs`}>
                    <p>{f.sourceName}</p>
                    <p className="text-ink-muted">
                      {f.version} · {f.publicationYear}
                    </p>
                    {f.sourceUrl && (
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-forest hover:underline">
                        Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {f.notes && <p className="mt-1 text-ink-muted">{f.notes}</p>}
                  </td>
                  <td className={td}>
                    <FactorStatusBadge status={f.reviewStatus} origin={f.origin} />
                    {f.origin === 'user' && <p className="mt-1 text-xs text-ink-muted">User-supplied</p>}
                  </td>
                  {canAdmin && (
                    <td className={`${td} whitespace-nowrap`}>
                      {f.origin !== 'library' && f.reviewStatus !== 'retired' && (
                        <>
                          {f.origin === 'user' && (
                            <Button variant="ghost" size="sm" onClick={() => attempt(() => setFactorStatus(f.id, f.reviewStatus === 'approved' ? 'provisional' : 'approved'), 'Factor status updated')}>
                              {f.reviewStatus === 'approved' ? 'Mark provisional' : 'Approve'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => attempt(() => retireFactor(f.id), 'Factor retired')}>
                            Retire
                          </Button>
                        </>
                      )}
                      {f.origin === 'library' && <span className="text-xs text-ink-muted">Built-in</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {adding && <AddFactorDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddFactorDialog({ onClose }: { onClose: () => void }) {
  const { org } = useOrg();
  const emissionCats = CATEGORIES.filter((c) => c.scope !== null);
  const [v, setV] = useState({
    factorCode: '',
    category: 'stationary_combustion' as ActivityCategory,
    subtype: 'coal',
    activityUnit: 'kg',
    value: '',
    geography: 'IN',
    validFrom: '2020-01-01',
    validTo: '',
    publicationYear: String(new Date().getFullYear()),
    sourceName: '',
    sourceUrl: '',
    methodology: '',
    version: 'v1',
    reviewStatus: 'provisional' as 'provisional' | 'approved',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  if (!org) return null;
  const cat = CATEGORY_BY_VALUE[v.category];
  const sub = cat.subtypes.find((s) => s.value === v.subtype) ?? cat.subtypes[0];
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = () => {
    setError(null);
    const value = Number(v.value);
    if (!v.factorCode.trim()) return setError('Enter a factor code.');
    if (!Number.isFinite(value) || value < 0 || v.value.trim() === '') return setError('Enter a non-negative factor value.');
    if (!v.sourceName.trim()) return setError('A documented source is required. Cobalance does not accept factors without a source.');
    if (v.validTo && v.validTo < v.validFrom) return setError('Valid-to must be after valid-from.');
    const f: Omit<EmissionFactor, 'id' | 'origin' | 'organizationId'> = {
      factorCode: v.factorCode.trim(),
      category: v.category,
      subtype: sub.value,
      activityUnit: v.activityUnit,
      components: [{ gas: 'CO2e', kgPerUnit: value }],
      factorUnit: `kg CO2e / ${v.activityUnit}`,
      geography: v.geography,
      validFrom: v.validFrom,
      validTo: v.validTo || null,
      publicationYear: Number(v.publicationYear) || new Date().getFullYear(),
      sourceName: v.sourceName.trim(),
      sourceUrl: v.sourceUrl.trim(),
      methodology: v.methodology.trim() || 'User-supplied CO2e factor',
      version: v.version.trim() || 'v1',
      gwpReference: 'n/a',
      reviewStatus: v.reviewStatus,
      notes: v.notes.trim(),
    };
    if (attempt(() => addCustomFactor(org.id, f), 'Factor added — recalculate to apply it')) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Add a documented emission factor"
      description="For sources without a built-in factor (e.g. coal with supplier GCV, Scope 3 materials, freight). The factor is stored as kg CO₂e per activity unit."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Add factor</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Factor code" required>
          {(p) => <Input {...p} placeholder="e.g. SUPPLIER-COAL-2024" value={v.factorCode} onChange={set('factorCode')} />}
        </Field>
        <Field label="Version" required>
          {(p) => <Input {...p} value={v.version} onChange={set('version')} />}
        </Field>
        <Field label="Category" required>
          {(p) => (
            <Select
              {...p}
              value={v.category}
              onChange={(e) => {
                const c = CATEGORY_BY_VALUE[e.target.value as ActivityCategory];
                setV({ ...v, category: c.value, subtype: c.subtypes[0].value, activityUnit: c.subtypes[0].units[0] });
              }}
            >
              {emissionCats.map((c) => (
                <option key={c.value} value={c.value}>
                  Scope {c.scope} · {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Source">
          {(p) => (
            <Select {...p} value={sub.value} onChange={(e) => setV({ ...v, subtype: e.target.value, activityUnit: cat.subtypes.find((s) => s.value === e.target.value)!.units[0] })}>
              {cat.subtypes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="kg CO₂e per unit" required>
            {(p) => <Input {...p} type="number" min="0" step="any" value={v.value} onChange={set('value')} />}
          </Field>
          <Field label="Unit">
            {(p) => (
              <Select {...p} value={v.activityUnit} onChange={set('activityUnit')}>
                {sub.units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Geography">
          {(p) => (
            <Select {...p} value={v.geography} onChange={set('geography')}>
              <option value="IN">India (IN)</option>
              <option value="GLOBAL">Global</option>
            </Select>
          )}
        </Field>
        <Field label="Valid from" required>
          {(p) => <Input {...p} type="date" value={v.validFrom} onChange={set('validFrom')} />}
        </Field>
        <Field label="Valid to" hint="Optional">
          {(p) => <Input {...p} type="date" value={v.validTo} onChange={set('validTo')} />}
        </Field>
        <Field label="Source name" required className="sm:col-span-2" hint="Publication, supplier certificate or study the value comes from.">
          {(p) => <Input {...p} value={v.sourceName} onChange={set('sourceName')} />}
        </Field>
        <Field label="Source URL">
          {(p) => <Input {...p} type="url" value={v.sourceUrl} onChange={set('sourceUrl')} />}
        </Field>
        <Field label="Publication year">
          {(p) => <Input {...p} type="number" value={v.publicationYear} onChange={set('publicationYear')} />}
        </Field>
        <Field label="Methodology" className="sm:col-span-2">
          {(p) => <Input {...p} value={v.methodology} onChange={set('methodology')} placeholder="How the value was derived" />}
        </Field>
        <Field label="Review status">
          {(p) => (
            <Select {...p} value={v.reviewStatus} onChange={set('reviewStatus')}>
              <option value="provisional">Provisional</option>
              <option value="approved">Approved</option>
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={v.notes} onChange={set('notes')} />}
        </Field>
      </div>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Dialog>
  );
}

function MembersTab() {
  const { db, orgId, role } = useOrg();
  const members = db.memberships.filter((m) => m.organizationId === orgId);
  return (
    <Card>
      <CardHeader title="Members and roles" description={`Your role: ${role}`} />
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const u = db.users.find((x) => x.id === m.userId);
          return (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{u?.name}</p>
                <p className="text-xs text-ink-muted">{u?.email}</p>
              </div>
              <Badge tone="green">{m.role}</Badge>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-5">
        <Notice tone="info" title="Inviting teammates needs the hosted backend">
          Roles are enforced on every change (owner and admin manage settings, factors and reviews; editor adds data; viewer reads only). Email invitations will be available once Cobalance is
          connected to its server; in demo mode each browser holds its own accounts.
        </Notice>
      </div>
    </Card>
  );
}

function AuditTab() {
  const { audit, db } = useOrg();
  return (
    <Card>
      <CardHeader title="Audit history" description="Important changes in this organisation, newest first." />
      {audit.length === 0 ? (
        <p className="p-5 text-sm text-ink-muted">No events yet.</p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
          {audit.slice(0, 300).map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
              <span className="w-40 shrink-0 text-xs text-ink-muted">{fmtDateTime(e.createdAt)}</span>
              <Badge>{e.action}</Badge>
              <span className="min-w-0 flex-1">{e.summary}</span>
              <span className="text-xs text-ink-muted">{db.users.find((u) => u.id === e.userId)?.name ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DataTab() {
  const { org, db, orgId, canAdmin, myOrgs } = useOrg();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!org) return null;
  const sample = myOrgs.find((o) => o.isSample);
  const exportJson = () => {
    const scoped = {
      exportedAt: new Date().toISOString(),
      organization: org,
      facilities: db.facilities.filter((x) => x.organizationId === orgId),
      reportingPeriods: db.periods.filter((x) => x.organizationId === orgId),
      activityRecords: db.activities.filter((x) => x.organizationId === orgId),
      evidenceDocuments: db.evidence.filter((x) => x.organizationId === orgId),
      emissionFactors: db.factors.filter((x) => x.organizationId === orgId),
      calculationRuns: db.runs.filter((x) => x.organizationId === orgId),
      reductionActions: db.reductionActions.filter((x) => x.organizationId === orgId),
      reports: db.reports.filter((x) => x.organizationId === orgId),
      auditEvents: db.audit.filter((x) => x.organizationId === orgId),
    };
    downloadText(`cobalance-${org.name.replace(/\W+/g, '-').toLowerCase()}-export.json`, JSON.stringify(scoped, null, 2), 'application/json');
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Export organisation data" description="Download every record for this organisation as JSON (evidence files are not included)." />
        <div className="p-5">
          <Button variant="outline" onClick={exportJson}>
            Export JSON
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sample organisation" description="Explore Cobalance with illustrative data in a separate organisation that never mixes with your records." />
        <div className="p-5">
          {sample ? (
            <Button variant="outline" onClick={() => { switchOrganization(sample.id); navigate('/app/dashboard'); }} disabled={sample.id === orgId}>
              {sample.id === orgId ? 'You are viewing the sample' : 'Switch to sample organisation'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                if (attempt(() => createSampleOrganization(), 'Sample organisation created — all of its data is illustrative')) navigate('/app/dashboard');
              }}
            >
              Open sample organisation
            </Button>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Demo storage" description="All data lives in this browser's localStorage and IndexedDB." />
        <div className="space-y-3 p-5">
          <p className="text-sm text-ink-muted">Resetting deletes every account, organisation, record and uploaded document stored by Cobalance in this browser. It cannot be undone.</p>
          <Button variant="danger" onClick={() => setConfirm(true)} disabled={!canAdmin}>
            Reset all demo data
          </Button>
        </div>
      </Card>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all demo data?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetAllDemoData();
                navigate('/');
                toast('Demo data reset');
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm">This removes all Cobalance data from this browser, including other accounts.</p>
      </Dialog>
    </div>
  );
}
