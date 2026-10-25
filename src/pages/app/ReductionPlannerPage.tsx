import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2, TrendingDown } from 'lucide-react';
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, Notice, PageHeader, Select, Stat, Textarea } from '@/components/ui';
import { attempt } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { deleteReductionAction, saveReductionAction, type ReductionDraft } from '@/lib/data/actions';
import { useOrg, type OrgContext } from '@/lib/data/hooks';
import type { ReductionAction, ReductionStatus } from '@/lib/data/types';
import { factorKgCo2ePerUnit, selectFactor } from '@/lib/engine/calculate';
import { ACTION_TYPES, computeScenario, type ReductionActionType, type ScenarioInputs } from '@/lib/engine/reduction';
import { convert } from '@/lib/engine/units';
import { fmtInr, fmtNumber } from '@/lib/format';

const STATUS: Record<ReductionStatus, { label: string; tone: 'neutral' | 'blue' | 'green' | 'red' }> = {
  proposed: { label: 'Proposed', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

const typeLabel = (t: ReductionActionType) => ACTION_TYPES.find((x) => x.value === t)?.label ?? t;

export default function ReductionPlannerPage() {
  const { org, period, reductionActions, facilityId, canEdit } = useOrg();
  const [editing, setEditing] = useState<ReductionAction | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ReductionAction | null>(null);
  if (!org || !period) return null;

  const actions = reductionActions.filter((a) => a.reportingPeriodId === period.id && (facilityId === 'all' || a.facilityId === facilityId || a.facilityId === null));
  const active = actions.filter((a) => a.status !== 'rejected').map((a) => ({ a, r: computeScenario(a.actionType, a.inputs) }));
  const savings = active.reduce((s, x) => s + x.r.netAnnualSavings, 0);
  const capex = active.reduce((s, x) => s + x.a.inputs.capex, 0);
  const reduction = active.reduce((s, x) => s + (x.r.reductionT ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Reduction planner"
        description="Model practical actions with your own baseline data. All results are estimates based on the assumptions shown — not guaranteed savings and not carbon credits."
        actions={
          canEdit && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> New scenario
            </Button>
          )
        }
      />

      {actions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TrendingDown className="h-6 w-6" />}
            title="No reduction scenarios yet"
            description="Start with solar feasibility, efficient machinery, fuel or waste reduction. Cobalance pre-fills baselines from your activity data — you can change every input."
            action={canEdit && <Button onClick={() => setEditing('new')}>Create a scenario</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Est. net annual savings" value={fmtInr(savings)} sub="Active scenarios (excl. rejected)" />
            <Stat label="Total estimated investment" value={fmtInr(capex)} sub="Upfront capex" />
            <Stat label="Est. annual reduction" value={`${fmtNumber(reduction, 2)} tCO₂e`} sub="Estimated — not carbon credits" />
          </div>
          <div className="space-y-4">
            {actions.map((a) => (
              <ActionCard key={a.id} action={a} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
            ))}
          </div>
        </>
      )}

      {editing !== null && <ScenarioDialog action={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete scenario?"
        description={deleting?.title}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deleting && attempt(() => (deleteReductionAction(deleting.id), setDeleting(null)), 'Scenario deleted')}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Consider marking it Rejected instead to keep a record of the decision.</p>
      </Dialog>
    </>
  );
}

function ActionCard({ action: a, onEdit, onDelete }: { action: ReductionAction; onEdit: () => void; onDelete: () => void }) {
  const { org, canEdit, facilities } = useOrg();
  const [open, setOpen] = useState(false);
  const r = computeScenario(a.actionType, a.inputs);
  const i = a.inputs;
  const u = a.baselineUnit;
  return (
    <Card className={cn('p-5', a.status === 'rejected' && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{a.title}</h2>
            <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
            <Badge tone="sage">{typeLabel(a.actionType)}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {a.description}
            {a.facilityId && ` · ${facilities.find((f) => f.id === a.facilityId)?.name ?? ''}`}
          </p>
        </div>
        {canEdit && org && (
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`st-${a.id}`}>
              Status
            </label>
            <Select
              id={`st-${a.id}`}
              className="h-8 w-36 text-xs"
              value={a.status}
              onChange={(e) => {
                const { id: _i, organizationId: _o, createdAt: _c, updatedAt: _u, ...draft } = a;
                attempt(() => saveReductionAction(org.id, { ...draft, status: e.target.value as ReductionStatus }, a.id), 'Status updated');
              }}
            >
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Button variant="ghost" size="sm" aria-label="Edit scenario" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Delete scenario" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Metric k="Baseline" v={`${fmtNumber(i.baselineQuantity)} ${u}`} />
        <Metric k="Proposed change" v={a.actionType === 'solar' ? `${fmtNumber(i.solar?.capacityKwp)} kWp → ${fmtNumber(r.avoidedQuantity)} ${u}/yr` : `−${fmtNumber(i.reductionPct, 1)}% (${fmtNumber(r.avoidedQuantity)} ${u})`} />
        <Metric k="Investment" v={fmtInr(i.capex)} />
        <Metric k="Net annual savings" v={fmtInr(r.netAnnualSavings)} sub={i.annualOperatingCost ? `after ${fmtInr(i.annualOperatingCost)}/yr O&M` : undefined} />
        <Metric k="Simple payback" v={r.paybackYears !== null ? `${fmtNumber(r.paybackYears, 1)} years` : 'n/a'} />
        <Metric k="Est. reduction" v={r.reductionT !== null ? `${fmtNumber(r.reductionT, 2)} tCO₂e/yr` : 'Not estimated'} />
      </dl>

      <button onClick={() => setOpen((o) => !o)} className="mt-4 flex items-center gap-1 text-sm font-medium text-forest hover:underline" aria-expanded={open}>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /> {open ? 'Hide' : 'Show'} working, assumptions and limitations
      </button>
      {open && (
        <div className="mt-3 grid gap-4 rounded-lg bg-canvas p-4 text-sm lg:grid-cols-2">
          <div className="space-y-1.5 font-mono text-xs text-ink">
            <p>Baseline cost = {fmtNumber(i.baselineQuantity)} {u} × ₹{fmtNumber(i.unitCost, 2)} = {fmtInr(r.baselineCost)}</p>
            <p>Post-action cost = {fmtNumber(i.baselineQuantity - r.avoidedQuantity)} {u} × ₹{fmtNumber(i.unitCost, 2)} = {fmtInr(r.postActionCost)}</p>
            <p>Annual savings = {fmtInr(r.baselineCost)} − {fmtInr(r.postActionCost)} = {fmtInr(r.annualSavings)}</p>
            <p>Net annual savings = {fmtInr(r.annualSavings)} − {fmtInr(i.annualOperatingCost)} = {fmtInr(r.netAnnualSavings)}</p>
            <p>Simple payback = {fmtInr(i.capex)} ÷ {fmtInr(r.netAnnualSavings)} = {r.paybackYears !== null ? `${fmtNumber(r.paybackYears, 2)} yr` : 'n/a'}</p>
            {r.reductionT !== null && (
              <p>
                Reduction = ({fmtNumber(i.baselineQuantity)} − {fmtNumber(i.baselineQuantity - r.avoidedQuantity)}) {u} × {fmtNumber(i.emissionFactorKgPerUnit, 4)} kg/{u} = {fmtNumber(r.reductionT, 3)} t
              </p>
            )}
            {r.notes.map((n) => (
              <p key={n} className="font-sans text-amber-700">
                {n}
              </p>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Assumptions</p>
              <p className="mt-1 whitespace-pre-line">{a.assumptions || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Limitations</p>
              <p className="mt-1 whitespace-pre-line">{a.limitations || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

const Metric = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div>
    <dt className="text-xs text-ink-muted">{k}</dt>
    <dd className="mt-0.5 font-medium">{v}</dd>
    {sub && <dd className="text-xs text-ink-muted">{sub}</dd>}
  </div>
);

/** Baseline suggestion from the period's activity data and the factor library. */
function suggestBaseline(type: ReductionActionType, ctx: OrgContext, facilityId: string | null) {
  const { period, periodActivities, factors } = ctx;
  const recs = periodActivities.filter((a) => !facilityId || a.facilityId === facilityId);
  const geo = ctx.org?.country === 'India' ? 'IN' : 'GLOBAL';
  const date = period?.startDate ?? '2024-04-01';
  const factorFor = (category: 'purchased_electricity' | 'stationary_combustion', subtype: string, unit: string): number | null => {
    const f = selectFactor({ id: '', category, subtype, activityDate: date, quantity: 1, unit, dataQuality: 'measured', geography: geo }, factors);
    if (!f) return null;
    const c = convert(1, unit, f.activityUnit, f.conversions);
    return c.ok ? c.value * factorKgCo2ePerUnit(f) : null;
  };
  if (type === 'solar' || type === 'efficient_machinery' || type === 'electricity_optimization') {
    const el = recs.filter((a) => a.category === 'purchased_electricity' && a.quantity !== null);
    const kwh = el.reduce((s, a) => s + ((convert(a.quantity!, a.unit, 'kWh') as { value?: number }).value ?? 0), 0);
    const priced = el.filter((a) => a.costAmount !== null);
    const pricedKwh = priced.reduce((s, a) => s + ((convert(a.quantity!, a.unit, 'kWh') as { value?: number }).value ?? 0), 0);
    const tariff = pricedKwh ? priced.reduce((s, a) => s + a.costAmount!, 0) / pricedKwh : 0;
    return {
      label: 'Annual grid electricity',
      unit: 'kWh',
      quantity: Math.round(kwh),
      unitCost: Number(tariff.toFixed(2)),
      factor: factorFor('purchased_electricity', 'grid', 'kWh'),
      note: `${el.length} electricity records in ${period?.label}${priced.length ? `; tariff = bill amounts ÷ kWh on ${priced.length} bills` : '; no bill amounts — enter your tariff'}.`,
    };
  }
  if (type === 'fuel_reduction') {
    const fu = recs.filter((a) => a.category === 'stationary_combustion' && a.subtype === 'diesel' && a.quantity !== null);
    const dieselFactor = factors.find((f) => f.category === 'stationary_combustion' && f.subtype === 'diesel');
    const litres = fu.reduce((s, a) => s + ((convert(a.quantity!, a.unit, 'L', dieselFactor?.conversions) as { value?: number }).value ?? 0), 0);
    const cost = fu.filter((a) => a.costAmount !== null);
    const costL = cost.reduce((s, a) => s + ((convert(a.quantity!, a.unit, 'L', dieselFactor?.conversions) as { value?: number }).value ?? 0), 0);
    return {
      label: 'Annual diesel (stationary)',
      unit: 'L',
      quantity: Math.round(litres),
      unitCost: costL ? Number((cost.reduce((s, a) => s + a.costAmount!, 0) / costL).toFixed(2)) : 0,
      factor: factorFor('stationary_combustion', 'diesel', 'L'),
      note: `${fu.length} diesel records in ${period?.label}.`,
    };
  }
  const cat = type === 'waste_reduction' ? 'waste' : 'purchased_goods';
  const rs = recs.filter((a) => a.category === cat && a.quantity !== null);
  const t = rs.reduce((s, a) => s + ((convert(a.quantity!, a.unit, 't') as { value?: number }).value ?? 0), 0);
  return {
    label: type === 'waste_reduction' ? 'Annual waste sent off site' : 'Annual raw material purchased',
    unit: 't',
    quantity: Number(t.toFixed(2)),
    unitCost: 0,
    factor: null as number | null,
    note: `${rs.length} records in ${period?.label}. Enter a cost per tonne and, if you have a documented factor, kg CO₂e per tonne.`,
  };
}

type Form = {
  actionType: ReductionActionType;
  title: string;
  description: string;
  facilityId: string;
  baselineLabel: string;
  baselineUnit: string;
  baselineQuantity: string;
  unitCost: string;
  factor: string;
  reductionPct: string;
  capex: string;
  opex: string;
  kwp: string;
  yieldKwh: string;
  assumptions: string;
  limitations: string;
  status: ReductionStatus;
};

function suggestedForm(type: ReductionActionType, facilityId: string, ctx: OrgContext): Form {
  const s = suggestBaseline(type, ctx, facilityId || null);
  const def = ACTION_TYPES.find((t) => t.value === type)!;
  return {
    actionType: type,
    title: def.label,
    description: '',
    facilityId,
    baselineLabel: s.label,
    baselineUnit: s.unit,
    baselineQuantity: String(s.quantity),
    unitCost: s.unitCost ? String(s.unitCost) : '',
    factor: s.factor !== null ? String(Number(s.factor.toFixed(4))) : '',
    reductionPct: String(def.defaultPct),
    capex: '',
    opex: '0',
    kwp: '',
    yieldKwh: '1400',
    assumptions: '',
    limitations: '',
    status: 'proposed',
  };
}

function ScenarioDialog({ action, onClose }: { action: ReductionAction | null; onClose: () => void }) {
  const ctx = useOrg();
  const { org, period, facilities } = ctx;
  const [note, setNote] = useState<string | null>(() => (action ? null : suggestBaseline('solar', ctx, ctx.facilityId !== 'all' ? ctx.facilityId : null).note));
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Form>(() =>
    action
      ? {
          actionType: action.actionType,
          title: action.title,
          description: action.description,
          facilityId: action.facilityId ?? '',
          baselineLabel: action.baselineLabel,
          baselineUnit: action.baselineUnit,
          baselineQuantity: String(action.inputs.baselineQuantity),
          unitCost: String(action.inputs.unitCost),
          factor: action.inputs.emissionFactorKgPerUnit === null ? '' : String(action.inputs.emissionFactorKgPerUnit),
          reductionPct: String(action.inputs.reductionPct),
          capex: String(action.inputs.capex),
          opex: String(action.inputs.annualOperatingCost),
          kwp: String(action.inputs.solar?.capacityKwp ?? ''),
          yieldKwh: String(action.inputs.solar?.yieldKwhPerKwpYear ?? ''),
          assumptions: action.assumptions,
          limitations: action.limitations,
          status: action.status,
        }
      : suggestedForm('solar', ctx.facilityId !== 'all' ? ctx.facilityId : '', ctx),
  );

  const applySuggestion = (type: ReductionActionType, facilityId: string) => {
    const s = suggestBaseline(type, ctx, facilityId || null);
    const def = ACTION_TYPES.find((t) => t.value === type)!;
    setF((cur) => ({
      ...cur,
      actionType: type,
      title: cur.title || def.label,
      baselineLabel: s.label,
      baselineUnit: s.unit,
      baselineQuantity: String(s.quantity),
      unitCost: s.unitCost ? String(s.unitCost) : cur.unitCost,
      factor: s.factor !== null ? String(Number(s.factor.toFixed(4))) : '',
      reductionPct: String(def.defaultPct),
      yieldKwh: type === 'solar' ? cur.yieldKwh || '1400' : cur.yieldKwh,
    }));
    setNote(s.note);
  };

  const n = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const inputs: ScenarioInputs | null = useMemo(() => {
    const v = {
      baselineQuantity: n(f.baselineQuantity),
      unitCost: n(f.unitCost),
      emissionFactorKgPerUnit: f.factor.trim() === '' ? null : n(f.factor),
      reductionPct: n(f.reductionPct),
      capex: n(f.capex),
      annualOperatingCost: n(f.opex),
      solar: f.actionType === 'solar' ? { capacityKwp: n(f.kwp), yieldKwhPerKwpYear: n(f.yieldKwh) } : undefined,
    };
    const nums = [v.baselineQuantity, v.unitCost, v.reductionPct, v.capex, v.annualOperatingCost, ...(v.solar ? [v.solar.capacityKwp, v.solar.yieldKwhPerKwpYear] : []), ...(v.emissionFactorKgPerUnit === null ? [] : [v.emissionFactorKgPerUnit])];
    return nums.every((x) => Number.isFinite(x) && x >= 0) ? v : null;
  }, [f]);
  const preview = inputs ? computeScenario(f.actionType, inputs) : null;

  if (!org || !period) return null;
  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setF((cur) => ({ ...cur, [k]: value }));
  };

  const save = () => {
    setError(null);
    if (!f.title.trim()) return setError('Give the scenario a title.');
    if (!inputs) return setError('All scenario inputs must be zero or positive numbers.');
    if (f.actionType !== 'solar' && inputs.reductionPct > 100) return setError('Reduction cannot exceed 100%.');
    const draft: ReductionDraft = {
      facilityId: f.facilityId || null,
      reportingPeriodId: period.id,
      actionType: f.actionType,
      title: f.title.trim(),
      description: f.description.trim(),
      baselineLabel: f.baselineLabel,
      baselineUnit: f.baselineUnit,
      inputs,
      assumptions: f.assumptions.trim(),
      limitations: f.limitations.trim(),
      status: f.status,
    };
    if (attempt(() => saveReductionAction(org.id, draft, action?.id), action ? 'Scenario updated' : 'Scenario saved')) onClose();
  };

  const u = f.baselineUnit;
  const numProps = { type: 'number', min: '0', step: 'any', inputMode: 'decimal' as const };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={action ? 'Edit scenario' : 'New reduction scenario'}
      description="Inputs are pre-filled from your data where possible. Change anything that doesn't match your site."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{action ? 'Save changes' : 'Save scenario'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Action type" required>
          {(p) => (
            <Select {...p} value={f.actionType} onChange={(e) => applySuggestion(e.target.value as ReductionActionType, f.facilityId)}>
              {ACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Facility">
          {(p) => (
            <Select
              {...p}
              value={f.facilityId}
              onChange={(e) => {
                const facilityId = e.target.value;
                setF((cur) => ({ ...cur, facilityId }));
                applySuggestion(f.actionType, facilityId);
              }}
            >
              <option value="">All facilities</option>
              {facilities.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Title" required className="sm:col-span-2">
          {(p) => <Input {...p} value={f.title} onChange={set('title')} />}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(p) => <Input {...p} value={f.description} onChange={set('description')} placeholder="What will change on site?" />}
        </Field>

        <div className="rounded-lg bg-canvas p-3 text-xs text-ink-muted sm:col-span-2">{note ?? 'Baseline from your activity data.'}</div>
        <Field label={`${f.baselineLabel || 'Baseline'} (${u})`} required>
          {(p) => <Input {...p} {...numProps} value={f.baselineQuantity} onChange={set('baselineQuantity')} />}
        </Field>
        <Field label={`Cost per ${u} (₹)`} required>
          {(p) => <Input {...p} {...numProps} value={f.unitCost} onChange={set('unitCost')} />}
        </Field>
        <Field label={`Emission factor (kg CO₂e per ${u})`} hint="Leave blank if no documented factor — the reduction won't be estimated.">
          {(p) => <Input {...p} {...numProps} value={f.factor} onChange={set('factor')} />}
        </Field>
        {f.actionType === 'solar' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="System size (kWp)" required>
              {(p) => <Input {...p} {...numProps} value={f.kwp} onChange={set('kwp')} />}
            </Field>
            <Field label="Yield (kWh/kWp/yr)" required hint="Site-specific; ask your installer.">
              {(p) => <Input {...p} {...numProps} value={f.yieldKwh} onChange={set('yieldKwh')} />}
            </Field>
          </div>
        ) : (
          <Field label="Reduction in baseline (%)" required>
            {(p) => <Input {...p} {...numProps} max="100" value={f.reductionPct} onChange={set('reductionPct')} />}
          </Field>
        )}
        <Field label="Initial investment (₹)" required>
          {(p) => <Input {...p} {...numProps} value={f.capex} onChange={set('capex')} />}
        </Field>
        <Field label="Additional annual operating cost (₹/yr)" hint="e.g. O&M, cleaning, maintenance contracts.">
          {(p) => <Input {...p} {...numProps} value={f.opex} onChange={set('opex')} />}
        </Field>
        <Field label="Assumptions" className="sm:col-span-2">
          {(p) => <Textarea {...p} value={f.assumptions} onChange={set('assumptions')} placeholder="Sources of costs, yields and reduction percentages." />}
        </Field>
        <Field label="Limitations" className="sm:col-span-2">
          {(p) => <Textarea {...p} value={f.limitations} onChange={set('limitations')} placeholder="What this estimate ignores (degradation, tariff changes, downtime…)." />}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select {...p} value={f.status} onChange={set('status')}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-5 rounded-lg border border-line p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Live estimate</p>
        {preview ? (
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric k="Annual savings" v={fmtInr(preview.annualSavings)} />
            <Metric k="Net of operating cost" v={fmtInr(preview.netAnnualSavings)} />
            <Metric k="Simple payback" v={preview.paybackYears !== null ? `${fmtNumber(preview.paybackYears, 1)} yr` : 'n/a'} />
            <Metric k="Reduction" v={preview.reductionT !== null ? `${fmtNumber(preview.reductionT, 2)} t/yr` : 'Not estimated'} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Fill in all required inputs to see the estimate.</p>
        )}
        {preview?.notes.map((x) => (
          <p key={x} className="mt-2 text-xs text-amber-700">
            {x}
          </p>
        ))}
      </div>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Dialog>
  );
}
