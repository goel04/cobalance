import { Layers } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PRODUCTS } from '@/components/marketing/nav-data';
import { CtaBand, FeatureCard, PageHero, Section } from '@/components/marketing/sections';

const DETAIL: Record<string, string> = {
  '/products/carbon-calculator': 'Turn fuel, electricity, refrigerant and value-chain activity data into Scope 1, 2 and assessed Scope 3 emissions, with the factor and source behind every number.',
  '/products/sustainability-dashboard': 'See emissions by scope and source, monthly trends, electricity use, emissions per unit of production and how complete your data is.',
  '/products/reduction-planner': 'Model solar, efficient machinery, fuel, waste and material actions with editable assumptions, estimated savings and simple payback.',
  '/products/reporting': 'Download PDF and CSV reports tied to a saved calculation run, including methodology, boundaries, factor versions and data-quality notes.',
};

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Products"
        icon={Layers}
        title="One platform to measure, reduce and report."
        description="Cobalance brings your factory's operational data into one place, calculates emissions transparently and helps you find practical savings."
        actions={
          <>
            <ButtonLink to="/signup" size="lg">
              Get started
            </ButtonLink>
            <ButtonLink to="/about/how-it-works" size="lg" variant="outline">
              How it works
            </ButtonLink>
          </>
        }
      />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2">
          {PRODUCTS.map((p) => (
            <FeatureCard key={p.to} icon={p.icon} title={p.label} to={p.to}>
              {DETAIL[p.to]}
            </FeatureCard>
          ))}
        </div>
      </Section>
      <CtaBand title="Your sustainability journey starts here." description="Start measuring your environmental impact and discover where your business can improve." cta="Get started" to="/signup" />
    </>
  );
}
