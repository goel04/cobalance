import type { ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileText,
  Flame,
  Gauge,
  History,
  LayoutDashboard,
  Leaf,
  PiggyBank,
  Recycle,
  Sun,
  Truck,
  Wind,
  Zap,
} from 'lucide-react';
import { ButtonLink, Card } from '@/components/ui';
import { CheckList, CtaBand, FeatureCard, IllustrativeLabel, PageHero, Section, SectionHeading } from '@/components/marketing/sections';
import { cn } from '@/lib/cn';

function EarlyAccessNote() {
  return <p className="mt-6 text-xs text-ink-muted">Early access: data is stored in your browser while our hosted platform is in development.</p>;
}

function Cta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <ButtonLink to={to} size="lg">
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </ButtonLink>
  );
}

// ── Carbon Calculator ─────────────────────────────────────────────────────

const SCOPES = [
  {
    scope: 'Scope 1',
    title: 'Direct emissions',
    icon: Flame,
    text: 'Emissions from sources you own or control.',
    items: ['Stationary combustion — diesel, petrol, LPG, natural gas, furnace oil', 'Mobile combustion — company-controlled vehicles', 'Refrigerant leakage and top-ups (R-410A, R-32, R-134a, R-404A)'],
  },
  {
    scope: 'Scope 2',
    title: 'Purchased energy',
    icon: Zap,
    text: 'Emissions from the electricity and energy you buy.',
    items: ['Grid electricity from monthly bills (kWh)', 'Location-based method using the CEA grid factor', 'Purchased steam, heat or cooling where a factor is available'],
  },
  {
    scope: 'Scope 3',
    title: 'Value-chain emissions',
    icon: Truck,
    text: 'Selected upstream categories, clearly marked as assessed or not.',
    items: ['Purchased goods, raw materials and packaging', 'Upstream freight (tonne-km)', 'Waste, business travel and employee commuting'],
  },
];

export function CarbonCalculatorProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Carbon Calculator"
        icon={Calculator}
        title="Calculate your footprint across Scope 1, 2 and 3."
        description="Enter your factory's activity data and Cobalance calculates emissions using documented, versioned emission factors — showing the source behind every number."
        actions={<Cta to="/app/calculator">Start calculating</Cta>}
      />
      <Section>
        <SectionHeading eyebrow="Scope coverage" title="Aligned with the GHG Protocol's three scopes." />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {SCOPES.map((s) => (
            <Card key={s.scope} className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="eyebrow">{s.scope}</p>
                  <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-muted">{s.text}</p>
              <div className="mt-4">
                <CheckList items={s.items} />
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Scope 3 is reported only for the categories you assess. Categories not yet assessed or excluded from your boundary are shown as such — never as complete.
        </p>
      </Section>
      <Section muted>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Methodology" title="Simple formula, documented inputs." />
            <div className="mt-6 rounded-xl border border-line bg-canvas p-5 font-mono text-sm text-ink">
              <p>Emissions (kg CO₂e) = Activity quantity × Emission factor</p>
              <p className="mt-2 text-ink-muted">tCO₂e = kg CO₂e ÷ 1,000</p>
            </div>
            <div className="mt-6">
              <CheckList
                items={[
                  'Quantities are normalised to the factor’s unit (e.g. litres → kg using a documented density).',
                  'Fuel factors use IPCC 2006 defaults; CO₂, CH₄ and N₂O are converted with IPCC AR5 GWPs.',
                  'Indian grid electricity uses the Central Electricity Authority’s CO₂ Baseline Database.',
                  'Activities without an approved factor are flagged as awaiting a factor, not guessed.',
                  'Every calculation run is saved with its inputs and factor snapshot.',
                ]}
              />
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Why it matters" title="Benefits for manufacturers." />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: Gauge, t: 'Know your baseline', d: 'Understand where emissions come from before deciding what to change.' },
                { icon: ClipboardCheck, t: 'Answer buyer requests', d: 'Respond to customer sustainability questionnaires with traceable numbers.' },
                { icon: PiggyBank, t: 'Find savings', d: 'Emissions hotspots often point to energy and fuel costs you can cut.' },
                { icon: History, t: 'Track progress', d: 'Compare periods and see the effect of the actions you take.' },
              ].map((b) => (
                <div key={b.t} className="rounded-xl border border-line bg-surface p-5">
                  <b.icon className="h-5 w-5 text-forest" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-ink">{b.t}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <EarlyAccessNote />
      </Section>
      <CtaBand title="Measure your footprint with confidence." description="Add your first activity records and see Scope 1, 2 and 3 results with full methodology." cta="Start calculating" to="/app/calculator" />
    </>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────

function DashboardPreview() {
  const bars = [48, 52, 50, 46, 44, 41, 43, 40, 38, 39, 36, 35];
  const months = ['A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F', 'M'];
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Monthly emissions (tCO₂e)</p>
        <IllustrativeLabel />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Total', v: '512 t' },
          { l: 'Intensity', v: '0.38 t/t' },
          { l: 'Electricity', v: '402 MWh' },
          { l: 'Completeness', v: '92%' },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-line bg-canvas p-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">{s.l}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-36 items-end gap-1.5 sm:gap-2" aria-hidden>
        {bars.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t bg-forest" style={{ height: `${(v / 52) * 112}px`, opacity: 0.45 + (i / bars.length) * 0.55 }} />
            <span className="text-[10px] text-ink-muted">{months[i]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Sustainability Dashboard"
        icon={LayoutDashboard}
        title="See your environmental performance at a glance."
        description="Track emissions, energy use, production intensity, waste and data completeness — built from your calculated results, not estimates pulled from thin air."
        actions={<Cta to="/app/dashboard">Explore Cobalance</Cta>}
      />
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <DashboardPreview />
          <div>
            <SectionHeading eyebrow="What you can track" title="The metrics that matter on the factory floor." />
            <div className="mt-6">
              <CheckList
                items={[
                  'Total assessed footprint and Scope 1, 2 and 3 breakdown',
                  'Monthly emissions trends and emissions by activity source',
                  'Emissions per unit of production (intensity) over time',
                  'Electricity consumption and spend from your bills',
                  'Waste quantities by type and treatment',
                  'Data completeness — which months and sources are missing',
                ]}
              />
            </div>
          </div>
        </div>
      </Section>
      <Section muted>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon={BarChart3} title="Filters that fit your operations">
            Filter by reporting period, facility and date range to compare sites and seasons.
          </FeatureCard>
          <FeatureCard icon={Factory} title="Production intensity">
            Normalise emissions by output so growth doesn't hide efficiency gains — or losses.
          </FeatureCard>
          <FeatureCard icon={ClipboardCheck} title="Data completeness">
            See which months and sources have data, and which are still missing, before you report.
          </FeatureCard>
        </div>
        <EarlyAccessNote />
      </Section>
      <CtaBand title="Bring your factory data to life." description="Add activity data and watch your dashboard fill with real, traceable results." cta="Explore Cobalance" to="/app/dashboard" />
    </>
  );
}

// ── Reduction Planner ─────────────────────────────────────────────────────

function PaybackExample() {
  const rows: [string, string][] = [
    ['System size', '50 kWp'],
    ['Assumed generation', '1,400 kWh per kWp per year → 70,000 kWh'],
    ['Assumed electricity tariff', '₹8 per kWh'],
    ['Annual savings', '70,000 × ₹8 = ₹5,60,000'],
    ['Annual operating cost', '₹25,000'],
    ['Net annual savings', '₹5,35,000'],
    ['Initial investment', '₹22,50,000'],
  ];
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Example: rooftop solar</p>
        <IllustrativeLabel>Illustrative calculation</IllustrativeLabel>
      </div>
      <dl className="mt-4 divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="font-medium tabular-nums text-ink sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-lg border border-forest-100 bg-forest-50 p-4">
        <p className="font-mono text-xs text-forest-deep">Simple payback = Initial investment ÷ Net annual savings</p>
        <p className="mt-1.5 text-sm font-semibold text-forest-deep">₹22,50,000 ÷ ₹5,35,000 ≈ 4.2 years</p>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Figures are illustrative, not guaranteed savings. Actual results depend on site conditions, tariffs, financing and equipment performance. Estimated emissions reductions are not carbon credits.
      </p>
    </Card>
  );
}

export function ReductionPlannerProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Cost Savings & Reduction Planner"
        icon={PiggyBank}
        title="Find reductions that pay for themselves."
        description="Assess energy efficiency, solar adoption, fuel reduction and waste opportunities with transparent assumptions, estimated savings and simple payback."
        actions={<Cta to="/app/reduction-planner">Explore savings</Cta>}
      />
      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Opportunities" title="Practical actions for manufacturers." />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: Sun, t: 'Solar feasibility', d: 'Size a rooftop system against your consumption and tariff.' },
                { icon: Zap, t: 'Efficient machinery', d: 'Compare motors, compressors and pumps against current use.' },
                { icon: Gauge, t: 'Electricity optimisation', d: 'Estimate the impact of scheduling, power factor and leak fixes.' },
                { icon: Flame, t: 'Fuel reduction', d: 'Model boiler efficiency, DG-set use and fuel switching.' },
                { icon: Recycle, t: 'Waste & recycling', d: 'Cut disposal costs and divert waste from landfill.' },
                { icon: Wind, t: 'Material efficiency', d: 'Reduce scrap and rework in raw-material use.' },
              ].map((o) => (
                <div key={o.t} className="rounded-xl border border-line bg-surface p-5">
                  <o.icon className="h-5 w-5 text-forest" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-ink">{o.t}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{o.d}</p>
                </div>
              ))}
            </div>
          </div>
          <PaybackExample />
        </div>
      </Section>
      <Section muted>
        <SectionHeading eyebrow="Transparent maths" title="Every estimate shows its working." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ['Annual savings', 'Baseline operating cost − Post-action operating cost'],
            ['Simple payback', 'Initial investment ÷ Annual net savings'],
            ['Emissions reduction', 'Baseline emissions − Projected post-action emissions'],
          ].map(([t, f]) => (
            <div key={t} className="rounded-xl border border-line bg-canvas p-5">
              <h3 className="text-sm font-semibold text-ink">{t}</h3>
              <p className="mt-2 font-mono text-xs leading-relaxed text-ink-muted">{f}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">You can edit every assumption — tariffs, yields, investment and operating costs — to match quotes from your suppliers.</p>
        <EarlyAccessNote />
      </Section>
      <CtaBand title="Turn your footprint into a savings plan." description="Build scenarios from your own baseline data and track each action from proposal to completion." cta="Explore savings" to="/app/reduction-planner" />
    </>
  );
}

// ── Reporting ─────────────────────────────────────────────────────────────

function ReportPreview() {
  const sections = ['Organisation & facility details', 'Reporting period & boundary', 'Scope 1, 2 & included Scope 3', 'Activity-source breakdown', 'Methodology & factor sources', 'Data coverage & exclusions', 'Reduction recommendations'];
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-forest" aria-hidden />
          <p className="text-sm font-semibold text-ink">Sustainability report</p>
        </div>
        <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">Draft</span>
      </div>
      <ol className="mt-5 space-y-2">
        {sections.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm', i === 0 ? 'bg-forest-50' : 'bg-surface')}>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span className="text-ink">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-muted">Report status labels are “Draft” or “Reviewed internally”. Cobalance never implies third-party verification.</p>
    </Card>
  );
}

export function ReportingProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Sustainability Reporting"
        icon={FileText}
        title="Reports your customers can trust."
        description="Generate downloadable PDF and CSV reports with emissions results, methodology, factor sources, assumptions and data-quality information."
        actions={<Cta to="/app/reports">Create a report</Cta>}
      />
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What's inside" title="Transparent from boundary to bottom line." />
            <div className="mt-6">
              <CheckList
                items={[
                  'Downloadable PDF for sharing and CSV for analysis',
                  'Emission-factor sources, versions and units for every line',
                  'Reporting boundary, with Scope 3 categories marked assessed, not assessed or excluded',
                  'Activity-data coverage and supporting-evidence status',
                  'Data-quality limitations and financial assumptions stated plainly',
                ]}
              />
            </div>
          </div>
          <ReportPreview />
        </div>
      </Section>
      <Section muted>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon={History} title="Reproducible by design">
            Each report is linked to a saved calculation run, so its numbers can be reproduced even after data changes.
          </FeatureCard>
          <FeatureCard icon={Leaf} title="Honest labelling">
            Estimates are distinguished from measured data, and reductions are never presented as carbon credits.
          </FeatureCard>
          <FeatureCard icon={ClipboardCheck} title="Calculation history">
            Keep a history of runs and reports to show how your footprint and methodology evolved.
          </FeatureCard>
        </div>
        <EarlyAccessNote />
      </Section>
      <CtaBand title="Share your progress with confidence." description="Generate a report from your latest calculation run in a few clicks." cta="Create a report" to="/app/reports" />
    </>
  );
}
