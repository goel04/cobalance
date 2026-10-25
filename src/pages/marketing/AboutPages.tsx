import { Compass, Database, FileSearch, Info, Layers, Scale, ShieldAlert, Target, Workflow, BadgeCheck, History } from 'lucide-react';
import { ButtonLink, Card } from '@/components/ui';
import { NAV_GROUPS } from '@/components/marketing/nav-data';
import { ProcessSteps } from '@/components/marketing/ProcessSteps';
import { CheckList, CtaBand, FeatureCard, PageHero, Section, SectionHeading } from '@/components/marketing/sections';

export function AboutPage() {
  const about = NAV_GROUPS[1].items;
  return (
    <>
      <PageHero
        eyebrow="About Cobalance"
        icon={Info}
        title="Sustainability intelligence for the businesses that make things."
        description="Cobalance is an India-first platform helping small and medium manufacturers measure their impact, reduce their costs and build more sustainable businesses."
      />
      <Section>
        <div className="grid gap-5 md:grid-cols-3">
          {about.map((i) => (
            <FeatureCard key={i.to} icon={i.icon} title={i.label} to={i.to}>
              {i.description}
            </FeatureCard>
          ))}
        </div>
      </Section>
      <CtaBand title="Your sustainability journey starts here." description="Start measuring your environmental impact and discover where your business can improve." cta="Get started" to="/signup" />
    </>
  );
}

export function MissionPage() {
  return (
    <>
      <PageHero
        eyebrow="Our mission"
        icon={Target}
        title="Make sustainability practical for every manufacturer."
        description="Large companies have sustainability teams and consultants. Most MSMEs don't. We want every factory owner to understand their footprint and act on it — without needing to become a carbon-accounting expert."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What we believe" title="Measure your impact. Reduce your costs." />
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              For most manufacturers, the biggest sources of emissions — electricity, fuel and materials — are also some of the biggest operating costs. Understanding one helps you manage the other.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Compass, t: 'Practical over perfect', d: 'Start with the data you have, see what is missing and improve over time.' },
              { icon: Scale, t: 'Honest by default', d: 'Estimates are labelled, gaps are flagged and nothing is overstated.' },
              { icon: Layers, t: 'Built for MSMEs', d: 'Plain language, Indian units and factors, and workflows that fit a factory office.' },
              { icon: Target, t: 'Decisions, not just data', d: 'Every number should point towards a cost or emissions decision.' },
            ].map((v) => (
              <Card key={v.t} className="p-5">
                <v.icon className="h-5 w-5 text-forest" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-ink">{v.t}</h3>
                <p className="mt-1 text-sm text-ink-muted">{v.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>
      <CtaBand title="Join us early." description="Cobalance is in early access. Create an account and help shape the platform." cta="Get started" to="/signup" />
    </>
  );
}

export function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How Cobalance works"
        icon={Workflow}
        title="From factory data to a sustainability report."
        description="Cobalance follows a simple, transparent process that any factory team can run."
      />
      <Section>
        <ProcessSteps />
      </Section>
      <Section muted>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Getting started" title="Set up in four short steps." />
            <div className="mt-6">
              <CheckList
                items={[
                  'Organisation profile — your business, sector and location.',
                  'Facility profile — your factory and its production unit.',
                  'Reporting period — a calendar or financial year with exact dates.',
                  'Initial assessment — electricity, fuel and production; the rest can follow later.',
                ]}
              />
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="What you need" title="Documents you probably already have." />
            <div className="mt-6">
              <CheckList
                items={[
                  'Monthly electricity bills (kWh, not just the amount paid)',
                  'Diesel, LPG, PNG or furnace oil purchase invoices',
                  'Refrigerant top-up records from AC or chiller service',
                  'Monthly production figures',
                  'Optional: raw-material purchases, freight, waste and travel records',
                ]}
              />
            </div>
          </div>
        </div>
      </Section>
      <CtaBand title="Ready to begin?" description="Create an account and complete your first assessment." cta="Get started" to="/signup" />
    </>
  );
}

export function TransparencyPage() {
  return (
    <>
      <PageHero
        eyebrow="Transparent carbon accounting"
        icon={Scale}
        title="Transparent by design."
        description="A footprint is only useful if you can trust it. Cobalance shows where every number comes from and what it does not yet cover."
        actions={
          <ButtonLink to="/products/carbon-calculator" variant="outline" size="lg">
            See the methodology
          </ButtonLink>
        }
      />
      <Section>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Database} title="Documented factor library">
            Each emission factor records its code, value, unit, geography, validity period, source, URL, methodology, version and review status. Historical factors are retired, never silently replaced.
          </FeatureCard>
          <FeatureCard icon={History} title="Reproducible calculation runs">
            Every run stores a snapshot of its inputs and the exact factors used, so past results and reports can be reproduced.
          </FeatureCard>
          <FeatureCard icon={FileSearch} title="Gaps are visible">
            Missing activity data is never treated as zero. Activities without an approved factor are marked as awaiting a factor and excluded from totals.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Measured vs. estimated">
            Each record carries a data-quality label, and estimated results are shown separately from calculated ones.
          </FeatureCard>
          <FeatureCard icon={Layers} title="Clear Scope 3 boundary">
            Scope 3 categories are marked calculated, estimated, not yet assessed or excluded — Scope 3 is never presented as complete when it isn't.
          </FeatureCard>
          <FeatureCard icon={ShieldAlert} title="No carbon-credit claims">
            Estimated emissions reductions are planning estimates. They are not issued, verified or tradable carbon credits.
          </FeatureCard>
        </div>
      </Section>
      <Section muted>
        <SectionHeading eyebrow="Sources used today" title="Recognised, published sources." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { t: 'Grid electricity', d: 'Central Electricity Authority (CEA) CO₂ Baseline Database for the Indian Power Sector — weighted average emission factor. Marked provisional until verified against the latest CEA publication.' },
            { t: 'Fuels', d: '2006 IPCC Guidelines for National Greenhouse Gas Inventories, Vol. 2 (Energy) — default net calorific values and CO₂, CH₄, N₂O factors.' },
            { t: 'Global warming potentials', d: 'IPCC Fifth Assessment Report (AR5), 100-year GWPs, used to convert CH₄, N₂O and refrigerants to CO₂e.' },
          ].map((s) => (
            <Card key={s.t} className="p-5">
              <h3 className="text-sm font-semibold text-ink">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.d}</p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Where no recognised default exists — for example coal, whose calorific value varies widely in India, or most Scope 3 materials — you can add a documented, organisation-specific factor with its source.
        </p>
      </Section>
    </>
  );
}
