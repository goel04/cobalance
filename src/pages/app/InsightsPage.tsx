import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, ClipboardCheck, Lightbulb, Sun, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui';
import { bySource, completeness, electricitySeries, monthlyEmissions, periodMonths, productionSeries, runResults, totals } from '@/lib/data/analytics';
import { useOrg } from '@/lib/data/hooks';
import { categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { fmtInr, fmtMonth, fmtNumber } from '@/lib/format';

interface Insight {
  id: string;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  link?: { to: string; label: string };
  tone?: 'default' | 'warning';
}

export default function InsightsPage() {
  const { period, periodActivities, latestRun, facilities, facilityId } = useOrg();
  if (!period) return null;

  if (!latestRun) {
    return (
      <>
        <PageHeader title="Insights" description="Observations generated from your own calculated data." />
        <Card>
          <EmptyState
            icon={<Lightbulb className="h-6 w-6" />}
            title="Insights appear after your first calculation"
            description="Add activity data and run a calculation. Every insight here is computed from your records — nothing is generic or pre-written."
            action={<ButtonLink to={periodActivities.length ? '/app/calculator' : '/app/activity-data'}>{periodActivities.length ? 'Go to calculator' : 'Add activity data'}</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const f = { facilityId };
  const results = runResults(latestRun, f);
  const t = totals(results);
  const months = periodMonths(period, f);
  const monthly = monthlyEmissions(results, months);
  const sources = bySource(results);
  const elec = electricitySeries(periodActivities, period.id, months, f);
  const prod = productionSeries(periodActivities, period.id, months, f, facilities);
  const comp = completeness(periodActivities, period, facilities, f);
  const insights: Insight[] = [];

  if (t.total > 0 && sources.length) {
    const top = sources.slice(0, 3);
    const share = (top.reduce((s, x) => s + x.kg, 0) / t.total) * 100;
    insights.push({
      id: 'top',
      icon: <BarChart3 className="h-5 w-5" />,
      title: `Your top ${top.length} sources make up ${fmtNumber(share, 0)}% of assessed emissions`,
      body: (
        <ul className="mt-1 space-y-0.5">
          {top.map((s) => (
            <li key={s.key}>
              {s.label}: <span className="font-medium text-ink">{fmtNumber(s.kg / 1000, 2)} t</span> ({fmtNumber((s.kg / t.total) * 100, 0)}%)
            </li>
          ))}
        </ul>
      ),
    });
  }

  const elecShare = t.total ? (t.byScope[2] / t.total) * 100 : 0;
  if (elecShare >= 30) {
    insights.push({
      id: 'elec',
      icon: <Sun className="h-5 w-5" />,
      title: `Purchased electricity is ${fmtNumber(elecShare, 0)}% of your assessed footprint`,
      body: 'Electricity-heavy sites usually have the most room for rooftop solar and efficiency upgrades. Model the payback with your own tariff and roof area.',
      link: { to: '/app/reduction-planner', label: 'Model solar or efficiency' },
    });
  }

  const kwhMonths = elec.filter((e) => e.kwh !== null);
  const withCost = elec.filter((e) => e.kwh && e.cost !== null);
  if (withCost.length >= 2) {
    const rates = withCost.map((e) => ({ month: e.month, rate: e.cost! / e.kwh! }));
    const avg = rates.reduce((s, r) => s + r.rate, 0) / rates.length;
    const max = rates.reduce((a, b) => (b.rate > a.rate ? b : a));
    insights.push({
      id: 'tariff',
      icon: <Zap className="h-5 w-5" />,
      title: `Average electricity cost: ${fmtInr(avg)}/kWh (bill amount ÷ kWh)`,
      body: `Highest effective rate was ${fmtInr(max.rate)}/kWh in ${fmtMonth(max.month)}. Bill amounts include fixed and demand charges, so this is an all-in rate — check your contract demand and power factor penalties.`,
    });
  }
  if (kwhMonths.length >= 3) {
    const peak = kwhMonths.reduce((a, b) => (b.kwh! > a.kwh! ? b : a));
    const avg = kwhMonths.reduce((s, e) => s + e.kwh!, 0) / kwhMonths.length;
    insights.push({
      id: 'peak',
      icon: <TrendingUp className="h-5 w-5" />,
      title: `Electricity use peaked in ${fmtMonth(peak.month)} at ${fmtNumber(peak.kwh)} kWh`,
      body: `That is ${fmtNumber(((peak.kwh! - avg) / avg) * 100, 0)}% above your monthly average of ${fmtNumber(avg)} kWh. Compare against production that month to see whether the increase was output-driven.`,
    });
  }

  if (!prod.mixedUnits && prod.unit) {
    const pts = monthly
      .map((m, i) => ({ m: m.month, v: prod.rows[i].qty && m.total ? (m.total * 1000) / prod.rows[i].qty! : null }))
      .filter((p): p is { m: string; v: number } => p.v !== null);
    if (pts.length >= 4) {
      const half = Math.floor(pts.length / 2);
      const a = pts.slice(0, half).reduce((s, p) => s + p.v, 0) / half;
      const b = pts.slice(half).reduce((s, p) => s + p.v, 0) / (pts.length - half);
      const change = ((b - a) / a) * 100;
      insights.push({
        id: 'intensity',
        icon: change <= 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />,
        title: `Emissions intensity ${change <= 0 ? 'improved' : 'worsened'} by ${fmtNumber(Math.abs(change), 1)}% in the second half of the period`,
        body: `Average ${fmtNumber(a, 3)} → ${fmtNumber(b, 3)} kg CO₂e per ${prod.unit} (months with both emissions and production data only).`,
      });
    }
  }

  const awaiting = results.filter((r) => r.status === 'awaiting_factor');
  if (awaiting.length) {
    const kinds = [...new Set(awaiting.map((r) => subtypeLabel(r.category, r.subtype)))];
    insights.push({
      id: 'awaiting',
      tone: 'warning',
      icon: <AlertTriangle className="h-5 w-5" />,
      title: `${awaiting.length} records are excluded because no documented factor exists`,
      body: `Sources: ${kinds.join(', ')}. Add a documented factor (with source and version) in Settings → Emission factors, then recalculate.`,
      link: { to: '/app/settings', label: 'Open factor library' },
    });
  }

  const provisional = results.filter((r) => r.factor?.reviewStatus === 'provisional' && r.factor.origin === 'library');
  if (provisional.length) {
    const kg = provisional.reduce((s, r) => s + (r.emissionsKgCo2e ?? 0), 0);
    insights.push({
      id: 'prov',
      tone: 'warning',
      icon: <AlertTriangle className="h-5 w-5" />,
      title: `${fmtNumber(t.total ? (kg / t.total) * 100 : 0, 0)}% of your footprint relies on a provisional factor`,
      body: 'The Indian grid factor is marked provisional until confirmed against the published CEA document. Treat Scope 2 figures as internal estimates until then.',
    });
  }

  const emissionRecs = periodActivities.filter((a) => a.category !== 'production');
  const estimated = emissionRecs.filter((a) => a.dataQuality === 'estimated').length;
  const noEvidence = emissionRecs.filter((a) => !a.evidenceDocumentId).length;
  insights.push({
    id: 'quality',
    icon: <ClipboardCheck className="h-5 w-5" />,
    title: `Data quality: ${fmtNumber(comp.pct, 0)}% of core monthly data present`,
    body: (
      <>
        {comp.missing.length} missing monthly electricity/production entries · {estimated} of {emissionRecs.length} records estimated · {noEvidence} without a supporting document.{' '}
        {categoryLabel('purchased_electricity')} bills are the easiest evidence to attach first.
      </>
    ),
    link: { to: '/app/activity-data', label: 'Review activity data' },
  });

  return (
    <>
      <PageHeader title="Insights" description="Observations computed from your records and latest calculation run. They are prompts for investigation, not audited findings." />
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((i) => (
          <Card key={i.id} className={i.tone === 'warning' ? 'border-amber-200 p-5' : 'p-5'}>
            <div className="flex gap-3">
              <div className={i.tone === 'warning' ? 'h-fit rounded-lg bg-amber-50 p-2 text-amber-700' : 'h-fit rounded-lg bg-forest-50 p-2 text-forest'}>{i.icon}</div>
              <div className="min-w-0">
                <h2 className="font-semibold leading-snug">{i.title}</h2>
                <div className="mt-1 text-sm text-ink-muted">{i.body}</div>
                {i.link && (
                  <Link to={i.link.to} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                    {i.link.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
