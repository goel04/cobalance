import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, FlaskConical } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button, Card, Field, Input, Notice, Select } from '@/components/ui';
import { attempt, toast } from '@/components/ui/toast';
import { FacilityForm, OrganizationForm } from '@/components/app/forms';
import { cn } from '@/lib/cn';
import { monthsBetween, periodPresets } from '@/lib/constants';
import { createFacility, createOrganization, createPeriod, logOut, saveActivity, setOnboardingStep, type ActivityDraft } from '@/lib/data/actions';
import { useAuth, useOrg } from '@/lib/data/hooks';
import { createSampleOrganization } from '@/lib/data/seed';
import { fmtMonth } from '@/lib/format';

const STEPS = ['Organisation', 'Facility', 'Reporting period', 'Initial assessment'];

export default function OnboardingPage() {
  const { user } = useAuth();
  const ctx = useOrg();
  const navigate = useNavigate();
  // A sample org never needs onboarding; start a real one if that is what's active.
  const org = ctx.org && !ctx.org.isSample ? ctx.org : null;
  const step = org ? Math.min(org.onboardingStep, 3) : 0;

  const exploreSample = () => {
    const id = attempt(() => createSampleOrganization());
    if (id) {
      toast('Sample organisation created. All of its data is illustrative.');
      navigate('/app/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" aria-label="Cobalance home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { logOut(); navigate('/'); }}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="container-page max-w-3xl py-8 sm:py-12">
        <p className="eyebrow">Set up Cobalance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Let's set up your organisation</h1>
        <p className="mt-2 text-sm text-ink-muted">Each step is saved as you go — you can leave and come back.</p>

        <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0" aria-current={i === step ? 'step' : undefined}>
              <div className={cn('h-1.5 rounded-full', i < step ? 'bg-forest' : i === step ? 'bg-sage' : 'bg-line')} />
              <p className={cn('mt-2 flex items-center gap-1 truncate text-xs font-medium', i <= step ? 'text-ink' : 'text-ink-muted')}>
                {i < step && <Check className="h-3.5 w-3.5 text-forest" aria-hidden />}
                <span className="truncate">
                  {i + 1}. {s}
                </span>
              </p>
            </li>
          ))}
        </ol>

        <Card className="mt-6 p-5 sm:p-8">
          {step === 0 && (
            <>
              <h2 className="text-lg font-semibold">Organisation profile</h2>
              <p className="mb-6 mt-1 text-sm text-ink-muted">Tell us about your business.</p>
              <OrganizationForm submitLabel="Save and continue" onSubmit={(v) => attempt(() => createOrganization(v), 'Organisation saved')} />
            </>
          )}
          {step === 1 && org && (
            <>
              <h2 className="text-lg font-semibold">Facility profile</h2>
              <p className="mb-6 mt-1 text-sm text-ink-muted">Add your first factory. You can add more later.</p>
              <FacilityForm
                country={org.country}
                defaultValues={{ state: org.state, city: org.city, industry: org.industry }}
                submitLabel="Save and continue"
                onSubmit={(v) =>
                  attempt(() => {
                    createFacility(org.id, v);
                    setOnboardingStep(org.id, 2);
                  }, 'Facility saved')
                }
              />
            </>
          )}
          {step === 2 && org && <PeriodStep orgId={org.id} />}
          {step === 3 && org && <AssessmentStep onDone={() => navigate('/app/dashboard')} />}
        </Card>

        {step === 0 && (
          <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
              <div>
                <p className="font-medium">Just exploring?</p>
                <p className="text-sm text-ink-muted">Open a separate sample organisation with illustrative data. It never mixes with your own records.</p>
              </div>
            </div>
            <Button variant="outline" onClick={exploreSample}>
              Explore sample data
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function PeriodStep({ orgId }: { orgId: string }) {
  const presets = periodPresets();
  const [choice, setChoice] = useState(presets[0].label);
  const [custom, setCustom] = useState({ label: '', startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  const isCustom = choice === 'custom';
  const selected = isCustom ? custom : presets.find((p) => p.label === choice)!;

  const submit = () => {
    setError(null);
    if (!selected.label.trim() || !selected.startDate || !selected.endDate) return setError('Enter a name, start date and end date.');
    try {
      createPeriod(orgId, selected);
      setOnboardingStep(orgId, 3);
      toast('Reporting period saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold">Reporting period</h2>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Choose the period your first footprint covers. Exact start and end dates are stored.</p>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Reporting period</legend>
        {[...presets, { label: 'custom', startDate: '', endDate: '' }].map((p) => (
          <label
            key={p.label}
            className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', choice === p.label ? 'border-forest bg-forest-50' : 'border-line hover:border-sage')}
          >
            <input type="radio" name="period" className="mt-1 accent-forest" checked={choice === p.label} onChange={() => setChoice(p.label)} />
            <span>
              <span className="block text-sm font-medium">{p.label === 'custom' ? 'Custom period' : p.label}</span>
              <span className="block text-xs text-ink-muted">{p.label === 'custom' ? 'Enter your own dates' : `${p.startDate} to ${p.endDate}`}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {isCustom && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Name" required>
            {(p) => <Input placeholder="e.g. FY 2024-25" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} {...p} />}
          </Field>
          <Field label="Start date" required>
            {(p) => <Input type="date" value={custom.startDate} onChange={(e) => setCustom({ ...custom, startDate: e.target.value })} {...p} />}
          </Field>
          <Field label="End date" required>
            {(p) => <Input type="date" value={custom.endDate} onChange={(e) => setCustom({ ...custom, endDate: e.target.value })} {...p} />}
          </Field>
        </div>
      )}
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <Button className="mt-6" onClick={submit}>
        Save and continue
      </Button>
    </>
  );
}

function AssessmentStep({ onDone }: { onDone: () => void }) {
  const { org, period, facilities } = useOrg();
  const months = period ? monthsBetween(period.startDate, period.endDate) : [];
  const [month, setMonth] = useState(months[0] ?? '');
  const [v, setV] = useState({ kwh: '', bill: '', fuel: 'diesel', fuelQty: '', fuelUnit: 'L', vehFuel: 'diesel', vehQty: '', production: '' });
  const [error, setError] = useState<string | null>(null);
  if (!org || !period) return null;
  const facility = facilities[0];

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const save = () => {
    setError(null);
    const entries = [v.kwh, v.bill, v.fuelQty, v.vehQty, v.production].map(num);
    if (entries.some((x) => x !== null && (!Number.isFinite(x) || x < 0))) return setError('Quantities must be zero or positive numbers.');
    if (num(v.bill) !== null && num(v.kwh) === null) return setError('Enter the kWh consumed as well — a bill amount is not a measure of consumption.');
    const base: Omit<ActivityDraft, 'category' | 'subtype' | 'quantity' | 'unit'> = {
      facilityId: facility.id,
      reportingPeriodId: period.id,
      activityDate: month,
      distanceKm: null,
      weightTonnes: null,
      costAmount: null,
      currency: 'INR',
      dataQuality: 'measured',
      dataSource: 'onboarding',
      evidenceDocumentId: null,
      reviewStatus: 'unreviewed',
      notes: '',
    };
    try {
      if (num(v.kwh) !== null) saveActivity(org.id, { ...base, category: 'purchased_electricity', subtype: 'grid', quantity: num(v.kwh), unit: 'kWh', costAmount: num(v.bill) });
      if (num(v.fuelQty) !== null) saveActivity(org.id, { ...base, category: 'stationary_combustion', subtype: v.fuel, quantity: num(v.fuelQty), unit: v.fuelUnit });
      if (num(v.vehQty) !== null) saveActivity(org.id, { ...base, category: 'mobile_combustion', subtype: v.vehFuel, quantity: num(v.vehQty), unit: 'L' });
      if (num(v.production) !== null) saveActivity(org.id, { ...base, category: 'production', subtype: 'output', quantity: num(v.production), unit: facility.productionUnit });
      setOnboardingStep(org.id, 4);
      toast('Setup complete');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const skip = () => {
    try {
      setOnboardingStep(org.id, 4);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const fuelUnits = v.fuel === 'lpg' ? ['kg', 'L'] : v.fuel === 'natural_gas' ? ['scm', 'kg'] : ['L', 'kg'];

  return (
    <>
      <h2 className="text-lg font-semibold">Initial assessment</h2>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        Enter what you have for one month at <span className="font-medium text-ink">{facility?.name}</span>. Leave anything blank — blanks are recorded as missing, never as zero.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Month" className="sm:col-span-2">
          {(p) => (
            <Select value={month} onChange={(e) => setMonth(e.target.value)} {...p}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonth(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Electricity consumed (kWh)" hint="From the units section of your DISCOM bill.">
          {(p) => <Input type="number" min="0" step="any" inputMode="decimal" value={v.kwh} onChange={(e) => setV({ ...v, kwh: e.target.value })} {...p} />}
        </Field>
        <Field label="Electricity bill amount (₹)" hint="Optional — used for cost insights only.">
          {(p) => <Input type="number" min="0" step="any" inputMode="decimal" value={v.bill} onChange={(e) => setV({ ...v, bill: e.target.value })} {...p} />}
        </Field>
        <Field label="Stationary fuel (boilers, DG sets)">
          {(p) => (
            <Select value={v.fuel} onChange={(e) => setV({ ...v, fuel: e.target.value, fuelUnit: e.target.value === 'lpg' ? 'kg' : e.target.value === 'natural_gas' ? 'scm' : 'L' })} {...p}>
              <option value="diesel">Diesel (HSD)</option>
              <option value="lpg">LPG</option>
              <option value="natural_gas">Natural gas (PNG)</option>
              <option value="furnace_oil">Furnace oil</option>
              <option value="petrol">Petrol</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Quantity">
            {(p) => <Input type="number" min="0" step="any" inputMode="decimal" value={v.fuelQty} onChange={(e) => setV({ ...v, fuelQty: e.target.value })} {...p} />}
          </Field>
          <Field label="Unit">
            {(p) => (
              <Select value={v.fuelUnit} onChange={(e) => setV({ ...v, fuelUnit: e.target.value })} {...p}>
                {fuelUnits.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Company vehicle fuel">
          {(p) => (
            <Select value={v.vehFuel} onChange={(e) => setV({ ...v, vehFuel: e.target.value })} {...p}>
              <option value="diesel">Diesel</option>
              <option value="petrol">Petrol</option>
            </Select>
          )}
        </Field>
        <Field label="Vehicle fuel (litres)">
          {(p) => <Input type="number" min="0" step="any" inputMode="decimal" value={v.vehQty} onChange={(e) => setV({ ...v, vehQty: e.target.value })} {...p} />}
        </Field>
        <Field label={`Production quantity (${facility?.productionUnit})`} className="sm:col-span-2">
          {(p) => <Input type="number" min="0" step="any" inputMode="decimal" value={v.production} onChange={(e) => setV({ ...v, production: e.target.value })} {...p} />}
        </Field>
      </div>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={save}>Save and finish</Button>
        <Button variant="ghost" onClick={skip}>
          Skip for now
        </Button>
      </div>
    </>
  );
}
