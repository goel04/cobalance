import { ArrowRight, BadgeCheck, Database, FileSearch, FileSpreadsheet, HelpCircle, Layers, Receipt, ShieldAlert, TrendingDown, Users } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { HeroVisual } from '@/components/marketing/HeroVisual';
import { ProcessSteps } from '@/components/marketing/ProcessSteps';
import { CtaBand, FeatureCard, Section, SectionHeading } from '@/components/marketing/sections';
import { PRODUCTS } from '@/components/marketing/nav-data';

const PROBLEMS = [
  { icon: FileSpreadsheet, title: 'Scattered data', text: 'Environmental data sits across electricity bills, fuel invoices, spreadsheets and purchase records.' },
  { icon: HelpCircle, title: 'Specialist knowledge', text: 'Carbon accounting is hard to get right without dedicated sustainability experts on staff.' },
  { icon: Receipt, title: 'Hidden costs', text: 'Wasted energy, fuel and materials quietly increase operating costs month after month.' },
  { icon: Users, title: 'Customer requests', text: 'Buyers and brands increasingly ask suppliers for credible sustainability information.' },
  { icon: TrendingDown, title: 'Plans, not just reports', text: 'Businesses need practical, costed reduction plans — not a number in a PDF.' },
];

const PRODUCT_COPY: Record<string, string> = {
  '/products/carbon-calculator': 'Calculate Scope 1, Scope 2 and selected Scope 3 emissions.',
  '/products/sustainability-dashboard': 'Monitor emissions, resource usage, production intensity and performance trends.',
  '/products/reduction-planner': 'Explore energy efficiency, solar feasibility, waste reduction, potential savings and estimated payback.',
  '/products/reporting': 'Generate downloadable reports containing emissions results, methodology, assumptions and data-quality information.',
};

const TRUST = [
  { icon: Database, title: 'Documented emission factors', text: 'Every factor carries its source, version, geography and validity period.' },
  { icon: Layers, title: 'Inputs and assumptions retained', text: 'Each calculation run keeps a snapshot of the inputs and factors it used.' },
  { icon: FileSearch, title: 'Missing data is flagged', text: 'Gaps are identified explicitly — missing data is never silently treated as zero.' },
  { icon: BadgeCheck, title: 'Estimates are labelled', text: 'Estimated values are clearly distinguished from measured data.' },
  { icon: ShieldAlert, title: 'No carbon-credit claims', text: 'Estimated emissions reductions are not represented as issued carbon credits.' },
];

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="overflow-hidden border-b border-line bg-gradient-to-b from-surface to-canvas">
        <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow">Sustainability intelligence for manufacturers</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              Make sustainability work for your business.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
              Measure your carbon footprint, uncover operational savings, and turn sustainability data into meaningful business decisions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/signup" size="lg">
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/products" size="lg" variant="outline">
                Explore products
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-ink-muted">Built for India's MSME manufacturers · Scope 1, 2 &amp; 3 · Transparent methodology</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* 2. Problem */}
      <Section>
        <SectionHeading
          eyebrow="The challenge"
          title="Sustainability shouldn't be complicated."
          description="Small and medium manufacturers face real pressure to understand their environmental impact — usually without the time, tools or specialists that large companies have."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-xl border border-line bg-surface p-5 shadow-card">
              <p.icon className="h-5 w-5 text-forest" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Products */}
      <Section muted>
        <SectionHeading
          eyebrow="Products"
          title="Everything you need to measure, reduce and report."
          description="Four connected tools that turn your factory's operational data into decisions."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PRODUCTS.map((p) => (
            <FeatureCard key={p.to} icon={p.icon} title={p.label} to={p.to}>
              {PRODUCT_COPY[p.to]}
            </FeatureCard>
          ))}
        </div>
      </Section>

      {/* 4. How it works */}
      <Section>
        <SectionHeading eyebrow="How it works" title="From factory data to a sustainability report in four steps." />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </Section>

      {/* 5. Trust */}
      <Section muted>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading
            eyebrow="Trust & transparency"
            title="Transparent by design."
            description="Cobalance shows its working. Grid electricity uses the Central Electricity Authority's CO₂ Baseline Database; fuel factors use IPCC 2006 defaults with AR5 global warming potentials."
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {TRUST.map((t) => (
              <li key={t.title} className="flex gap-3 rounded-xl border border-line bg-canvas p-5">
                <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 6. Final CTA */}
      <CtaBand
        title="Your sustainability journey starts here."
        description="Start measuring your environmental impact and discover where your business can improve."
        cta="Get started"
        to="/signup"
      />
    </>
  );
}
