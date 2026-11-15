import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Database,
  FileSearch,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Receipt,
  Scale,
  ShieldAlert,
  Sun,
  TrendingDown,
  Upload,
  Users,
} from 'lucide-react';
import { PlanetCanvas } from '@/components/marketing/planet/PlanetCanvas';
import { ProcessSteps } from '@/components/marketing/ProcessSteps';
import { CtaBand, FeatureCard } from '@/components/marketing/sections';
import { PRODUCTS } from '@/components/marketing/nav-data';
import { rd } from '@/components/marketing/space';

const METHODOLOGY = ['GHG Protocol', 'CEA CO₂ Baseline', 'IPCC 2006', 'AR5 GWPs', 'Scope 1 · 2 · 3', 'Made for MSMEs'];

const PROBLEMS = [
  { icon: FileSpreadsheet, title: 'Scattered data', text: 'Environmental data sits across electricity bills, fuel invoices, spreadsheets and purchase records.' },
  { icon: HelpCircle, title: 'Specialist knowledge', text: 'Carbon accounting is hard to get right without dedicated sustainability experts on staff.' },
  { icon: Receipt, title: 'Hidden costs', text: 'Wasted energy, fuel and materials quietly increase operating costs month after month.' },
  { icon: Users, title: 'Customer requests', text: 'Buyers and brands increasingly ask suppliers for credible sustainability information.' },
  { icon: TrendingDown, title: 'Plans, not just reports', text: 'Businesses need practical, costed reduction plans — not a number in a PDF.' },
];

const PRODUCT_COPY: Record<string, string> = {
  '/products/carbon-calculator': 'Calculate Scope 1, Scope 2 and selected Scope 3 emissions from your activity data.',
  '/products/sustainability-dashboard': 'Monitor emissions, resource usage, production intensity and performance trends.',
  '/products/reduction-planner': 'Explore energy efficiency, solar feasibility, waste reduction, potential savings and estimated payback.',
  '/products/reporting': 'Generate downloadable reports with emissions results, methodology, assumptions and data quality.',
};

const EXTRA_FEATURES = [
  { icon: Upload, title: 'Bills in, evidence kept', text: 'Enter data by hand or import a CSV, and attach the bill or invoice behind every record.', to: '/about/how-it-works', label: 'How it works' },
  { icon: Scale, title: 'Transparent by design', text: 'Every factor shows its source, version and validity — so you can defend every number you share.', to: '/about/transparency', label: 'Our methodology' },
];

const TRUST = [
  { icon: Database, title: 'Documented emission factors', text: 'Every factor carries its source, version, geography and validity period.' },
  { icon: Layers, title: 'Inputs and assumptions retained', text: 'Each calculation run keeps a snapshot of the inputs and factors it used.' },
  { icon: FileSearch, title: 'Missing data is flagged', text: 'Gaps are identified explicitly — missing data is never silently treated as zero.' },
  { icon: BadgeCheck, title: 'Estimates are labelled', text: 'Estimated values are clearly distinguished from measured data.' },
  { icon: ShieldAlert, title: 'No carbon-credit claims', text: 'Estimated emissions reductions are not represented as issued carbon credits.' },
];

// Illustrative figures only — the dashboard mock is labelled as such.
const BARS = [62, 88, 47, 95, 71, 80, 58];
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const ROWS = [
  { label: 'Data completeness', w: 90 },
  { label: 'Scope 2 · Electricity', w: 55 },
  { label: 'Scope 1 · Fuel', w: 29 },
  { label: 'Scope 3 · Assessed', w: 16 },
];

const STATS = [
  { value: '3', label: 'GHG Protocol scopes covered' },
  { value: '4', label: 'Connected tools, one workflow' },
  { value: '100%', label: 'Factors with a documented source' },
  { value: '0', label: 'Gaps silently treated as zero' },
];

export default function HomePage() {
  return (
    <>
      <PlanetCanvas />

      {/* 1 · Hero */}
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow hero-eyebrow" data-reveal style={rd(0)}>
            Sustainability intelligence for manufacturers
          </p>
          <h1 className="hero-title" data-reveal style={{ ...rd(60), maxWidth: '19ch' }}>
            Make sustainability
            <br />
            work for <em>your business</em>
          </h1>
          <p className="hero-sub" data-reveal style={rd(180)}>
            Measure your carbon footprint, uncover operational savings, and turn sustainability data into meaningful business decisions.
          </p>
          <div className="hero-actions" data-reveal style={rd(300)}>
            <Link to="/signup" className="btn btn-primary">
              Get started free
              <ArrowRight aria-hidden />
            </Link>
            <Link to="/products" className="btn btn-outline">
              Explore products
            </Link>
          </div>
        </div>
        <div className="logos" data-reveal style={rd(420)}>
          <div className="logos-inner">
            <p className="logos-label">Built on recognised methodology</p>
            <div className="logos-row">
              {METHODOLOGY.map((m) => (
                <span key={m} className="logo">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 2 · The challenge */}
      <section className="sp-section" id="challenge">
        <div className="sp-section-head">
          <p className="eyebrow" data-reveal>
            The challenge
          </p>
          <h2 className="sp-h2" data-reveal style={rd(80)}>
            Sustainability shouldn’t be complicated
          </h2>
          <p className="sp-lead" data-reveal style={rd(160)}>
            Small and medium manufacturers face real pressure to understand their environmental impact — usually without the time, tools or specialists that large companies have.
          </p>
        </div>
        <div className="feature-grid cols-5">
          {PROBLEMS.map((p, i) => (
            <div key={p.title} className="sp-card compact" data-reveal style={rd(i * 90)}>
              <span className="card-icon">
                <p.icon aria-hidden />
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 · Products */}
      <section className="sp-section !pt-0" id="features">
        <div className="sp-section-head">
          <p className="eyebrow" data-reveal>
            Everything in one place
          </p>
          <h2 className="sp-h2" data-reveal style={rd(80)}>
            Measure, reduce and report from one platform
          </h2>
          <p className="sp-lead" data-reveal style={rd(160)}>
            Four connected tools turn your factory’s bills, invoices and production records into a footprint you can trust and a plan you can act on.
          </p>
        </div>
        <div className="feature-grid">
          {PRODUCTS.map((p, i) => (
            <FeatureCard key={p.to} icon={p.icon} title={p.label} to={p.to} delay={i * 90}>
              {PRODUCT_COPY[p.to]}
            </FeatureCard>
          ))}
          {EXTRA_FEATURES.map((f, i) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} to={f.to} linkLabel={f.label} delay={(i + PRODUCTS.length) * 90}>
              {f.text}
            </FeatureCard>
          ))}
        </div>
      </section>

      {/* 4 · Showcase + stats */}
      <section className="sp-section" id="solutions">
        <div className="showcase-grid">
          <div className="sp-showcase-copy">
            <p className="eyebrow" data-reveal>
              Sustainability dashboard
            </p>
            <h2 className="sp-h2" data-reveal style={rd(90)}>
              See exactly where every tonne comes from
            </h2>
            <p className="sp-lead" data-reveal style={rd(180)}>
              Emissions by scope, month and source — calculated from your own bills and invoices, with data completeness tracked alongside. Spot the biggest drivers and the savings hiding behind them.
            </p>
            <div data-reveal style={rd(270)}>
              <Link to="/products/sustainability-dashboard" className="btn btn-primary">
                Explore the dashboard
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>

          <div className="dashboard" data-reveal style={rd(160)} aria-label="Illustrative dashboard preview">
            <div className="dash-top">
              <div>
                <p className="dash-title">Monthly emissions · FY 2025–26</p>
                <p className="dash-sub">619 tCO₂e annual footprint</p>
              </div>
              <span className="dash-live">
                <i aria-hidden />
                Illustrative
              </span>
            </div>
            <div className="dash-bars" aria-hidden>
              {BARS.map((h, i) => (
                <div key={i} className="dash-bar" style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
            <div className="dash-months" aria-hidden>
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="dash-rows">
              {ROWS.map((r) => (
                <div key={r.label} className="dash-row">
                  <span>{r.label}</span>
                  <span className="dash-track">
                    <span className="dash-fill block" style={{ ['--w' as string]: `${r.w}%` }} />
                  </span>
                  <b>{r.w}%</b>
                </div>
              ))}
            </div>
            <div className="dash-note">
              <span className="card-icon">
                <Sun aria-hidden />
              </span>
              <span>
                <strong>Reduction opportunity: rooftop solar</strong>
                Est. 51 tCO₂e/yr avoided · ₹5.4 L/yr savings · ~4.2 yr simple payback
              </span>
            </div>
          </div>
        </div>

        <div className="stats">
          {STATS.map((s, i) => (
            <div key={s.label} className="stat" data-reveal style={rd(i * 80)}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · How it works */}
      <section className="sp-section !pt-0" id="how-it-works">
        <div className="sp-section-head">
          <p className="eyebrow" data-reveal>
            How it works
          </p>
          <h2 className="sp-h2" data-reveal style={rd(80)}>
            From factory data to a sustainability report in four steps
          </h2>
        </div>
        <ProcessSteps />
      </section>

      {/* 6 · Trust */}
      <section className="sp-section !pt-0" id="trust">
        <div className="showcase-grid !items-start">
          <div className="sp-showcase-copy">
            <p className="eyebrow" data-reveal>
              Trust &amp; transparency
            </p>
            <h2 className="sp-h2" data-reveal style={rd(90)}>
              Transparent by design
            </h2>
            <p className="sp-lead" data-reveal style={rd(180)}>
              Cobalance shows its working. Grid electricity uses the Central Electricity Authority’s CO₂ Baseline Database; fuel factors use IPCC 2006 defaults with AR5 global warming potentials.
            </p>
            <div data-reveal style={rd(270)}>
              <Link to="/about/transparency" className="btn btn-outline">
                Read the methodology
              </Link>
            </div>
          </div>
          <ul className="feature-grid cols-2">
            {TRUST.map((t, i) => (
              <li key={t.title} className="sp-card compact" data-reveal style={rd(i * 90)}>
                <span className="card-icon">
                  <t.icon aria-hidden />
                </span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7 · CTA (footer follows from the layout) */}
      <CtaBand
        eyebrow="Ready when you are"
        title="Your sustainability journey starts here"
        description="Start measuring your environmental impact and discover where your business can improve. No credit card, nothing to install."
        cta="Get started free"
        to="/signup"
      />
    </>
  );
}
