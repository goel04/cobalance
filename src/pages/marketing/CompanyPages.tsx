import { useState, type FormEvent } from 'react';
import { BookOpen, Building2, Handshake, Landmark, Mail, Sun, Users, Wrench } from 'lucide-react';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { NAV_GROUPS } from '@/components/marketing/nav-data';
import { CtaBand, FeatureCard, PageHero, Prose, Section, SectionHeading } from '@/components/marketing/sections';
import { CONTACT_EMAIL } from '@/config';

export function CompanyPage() {
  const items = NAV_GROUPS[2].items;
  return (
    <>
      <PageHero
        eyebrow="Company"
        icon={Building2}
        title="Building sustainability tools for Indian manufacturing."
        description="Cobalance is an early-stage company. Get in touch, explore ways to work together or read our resources."
      />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <FeatureCard key={i.to} icon={i.icon} title={i.label} to={i.to}>
              {i.description}
            </FeatureCard>
          ))}
        </div>
      </Section>
    </>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Enquiry from ${name || 'website visitor'}${company ? ` (${company})` : ''}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}${company ? `, ${company}` : ''}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <PageHero eyebrow="Contact us" icon={Mail} title="We'd love to hear from you." description="Questions about Cobalance, early access or working together? Send us an email." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading title="Email" />
            <p className="mt-4 text-sm text-ink-muted">Write to us directly at</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 inline-block text-lg font-semibold text-forest hover:text-forest-deep hover:underline">
              {CONTACT_EMAIL}
            </a>
            <p className="mt-6 text-sm leading-relaxed text-ink-muted">
              Please don't send sensitive business data by email. You can explore Cobalance with your own data by creating an account.
            </p>
          </div>
          <Card className="p-6">
            <h2 className="text-base font-semibold text-ink">Compose a message</h2>
            <p className="mt-1 text-sm text-ink-muted">This opens your email app with the message pre-filled. Nothing is sent from this page.</p>
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" required>
                  {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />}
                </Field>
                <Field label="Company">
                  {(p) => <Input {...p} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />}
                </Field>
              </div>
              <Field label="Message" required>
                {(p) => <Textarea {...p} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />}
              </Field>
              <Button type="submit">
                <Mail className="h-4 w-4" aria-hidden />
                Open in email app
              </Button>
            </form>
          </Card>
        </div>
      </Section>
    </>
  );
}

export function PartnershipsPage() {
  return (
    <>
      <PageHero
        eyebrow="Partnerships"
        icon={Handshake}
        title="Help more manufacturers take practical climate action."
        description="We're looking to work with organisations that support MSMEs. We don't have formal partnerships to announce yet — if you'd like to explore one, let's talk."
      />
      <Section>
        <SectionHeading eyebrow="Who we'd like to work with" title="Partnership areas we're exploring." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Users} title="Industry associations">
            Helping members understand and respond to customer sustainability requests.
          </FeatureCard>
          <FeatureCard icon={Wrench} title="Energy auditors">
            Turning audit findings into tracked, costed reduction actions.
          </FeatureCard>
          <FeatureCard icon={Sun} title="Solar & efficiency providers">
            Grounding feasibility conversations in a factory's actual consumption data.
          </FeatureCard>
          <FeatureCard icon={Landmark} title="Banks & lenders">
            Supporting green-finance assessments with transparent emissions and savings data.
          </FeatureCard>
        </div>
      </Section>
      <CtaBand title="Interested in partnering?" description="Tell us about your organisation and how you support manufacturers." cta="Contact us" to="/company/contact" />
    </>
  );
}

export function ResourcesPage() {
  return (
    <>
      <PageHero eyebrow="Resources" icon={BookOpen} title="Carbon accounting, explained simply." description="Short guides to help factory teams understand the basics." />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-24 space-y-2 text-sm">
              {[
                ['#scopes', 'Scopes 1, 2 and 3'],
                ['#factors', 'Emission factors'],
                ['#data', 'Collecting good data'],
                ['#intensity', 'Emissions intensity'],
                ['#credits', 'Reductions vs. credits'],
              ].map(([h, l]) => (
                <li key={h}>
                  <a href={h} className="text-ink-muted hover:text-forest">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Prose>
            <h2 id="scopes">Scopes 1, 2 and 3</h2>
            <p>The GHG Protocol Corporate Standard groups emissions into three scopes:</p>
            <ul>
              <li><strong>Scope 1</strong> — direct emissions from sources you own or control: fuel burned in boilers, furnaces and DG sets, company vehicles, and refrigerant leaks.</li>
              <li><strong>Scope 2</strong> — indirect emissions from purchased electricity, steam, heat or cooling.</li>
              <li><strong>Scope 3</strong> — other indirect emissions in your value chain, such as purchased materials, freight, waste, business travel and commuting.</li>
            </ul>
            <h2 id="factors">Emission factors</h2>
            <p>
              An emission factor converts an activity — a litre of diesel, a kWh of electricity — into greenhouse-gas emissions. Good factors come from recognised sources and state their unit, geography and year. For Indian grid electricity, the Central Electricity Authority publishes the{' '}
              <a href="https://cea.nic.in/cdm-co2-baseline-database/?lang=en" target="_blank" rel="noreferrer">CO₂ Baseline Database</a>.
              Fuel factors commonly use the{' '}
              <a href="https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html" target="_blank" rel="noreferrer">2006 IPCC Guidelines</a>.
            </p>
            <h2 id="data">Collecting good data</h2>
            <ul>
              <li>Use the kWh figure on your electricity bill — not the amount paid.</li>
              <li>Record fuel in physical units (litres, kg, scm) from invoices or stock registers.</li>
              <li>Keep the bills and invoices as evidence; mark any figure you had to estimate.</li>
              <li>Record production every month so you can track intensity.</li>
            </ul>
            <h2 id="intensity">Emissions intensity</h2>
            <p>
              Intensity divides emissions by production (for example tCO₂e per tonne of product). It shows whether you are becoming more efficient even while output changes.
            </p>
            <h2 id="credits">Reductions vs. carbon credits</h2>
            <p>
              Reducing your own emissions is not the same as generating carbon credits. Credits require registration under a recognised programme, a defined methodology and independent verification. Cobalance's reduction estimates are for planning and are not carbon credits.
            </p>
          </Prose>
        </div>
      </Section>
    </>
  );
}
