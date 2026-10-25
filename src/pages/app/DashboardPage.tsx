import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Calculator, Database, Factory, Gauge, IndianRupee, Leaf, PiggyBank, Zap } from 'lucide-react';
import { Button, ButtonLink, Card, EmptyState, Notice, PageHeader, Select, Stat } from '@/components/ui';
import { attempt } from '@/components/ui/toast';
import { axisProps, CHART_GRID, ChartCard, ChartEmpty, ChartTooltip, Legend, SINGLE_SERIES } from '@/components/app/charts';
import { SCOPE_COLORS } from '@/components/app/status';
import { createCalculationRun, setFacilityFilter } from '@/lib/data/actions';
import { bySource, completeness, electricitySeries, monthlyEmissions, periodMonths, productionSeries, runResults, totals, type Filter } from '@/lib/data/analytics';
import { useOrg } from '@/lib/data/hooks';
import { computeScenario } from '@/lib/engine/reduction';
import { fmtDateTime, fmtInr, fmtMonth, fmtNumber } from '@/lib/format';
import { monthsBetween } from '@/lib/constants';

const tco2 = (v: number) => `${fmtNumber(v, 2)} t`;

export default function DashboardPage() {
  const ctx = useOrg();
  const { org, period, facilities, facilityId, periodActivities, latestRun, runIsStale, reductionActions, canEdit } = ctx;
  const allMonths = period ? monthsBetween(period.startDate, period.endDate) : [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filter: Filter = { facilityId, fromMonth: from || undefined, toMonth: to || undefined };

  const data = useMemo(() => {
    if (!period) return null;
    const months = periodMonths(period, filter);
    const results = latestRun ? runResults(latestRun, filter) : [];
    const t = totals(results);
    const monthly = monthlyEmissions(results, months);
    const elec = electricitySeries(periodActivities, period.id, months, filter);
    const prod = productionSeries(periodActivities, period.id, months, filter, facilities);
    const intensity = monthly.map((m, i) => ({
      month: m.month,
      value: prod.rows[i].qty && !prod.mixedUnits && m.total > 0 ? (m.total * 1000) / prod.rows[i].qty! : null,
    }));
    const prodTotal = prod.rows.reduce((s, r) => s + (r.qty ?? 0), 0);
    const kwh = elec.reduce((s, r) => s + (r.kwh ?? 0), 0);
    const spend = elec.reduce((s, r) => s + (r.cost ?? 0), 0);
    const hasSpend = elec.some((r) => r.cost !== null);
    const actions = reductionActions.filter((a) => a.reportingPeriodId === period.id && a.status !== 'rejected' && (facilityId === 'all' || a.facilityId === facilityId));
    const scen = actions.map((a) => ({ a, r: computeScenario(a.actionType, a.inputs) }));
    const sources = bySource(results);
    const comp = completeness(periodActivities, period, facilities, filter);
    const s3Assessed = new Set(results.filter((r) => r.scope === 3 && r.emissionsKgCo2e !== null).map((r) => r.category)).size;
    return { months, results, t, monthly, elec, prod, prodTotal, intensity, kwh, spend, hasSpend, scen, sources, comp, s3Assessed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, latestRun, periodActivities, facilities, facilityId, from, to, reductionActions]);

  if (!org || !period || !data) return null;

  const header = (
    <PageHeader
      title="Overview"
      description={`${org.name} · ${period.label} (${period.startDate} to ${period.endDate})`}
      actions={
        canEdit && periodActivities.length > 0 ? (
          <Button onClick={() => attempt(() => createCalculationRun(org.id, period.id), 'Footprint recalculated')} variant={runIsStale || !latestRun ? 'primary' : 'outline'}>
            <Calculator className="h-4 w-4" /> {latestRun ? 'Recalculate' : 'Calculate footprint'}
          </Button>
        ) : undefined
      }
    />
  );

  if (periodActivities.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<Database className="h-6 w-6" />}
            title="No activity data for this period yet"
            description="Add electricity, fuel and production records — your footprint, trends and intensity will appear here once calculated. Nothing on this page is pre-filled."
            action={<ButtonLink to="/app/activity-data">Add activity data</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const { t, monthly, elec, prod, prodTotal, intensity, kwh, spend, hasSpend, scen, sources, comp, s3Assessed } = data;
  const savings = scen.reduce((s, x) => s + Math.max(0, x.r.netAnnualSavings), 0);
  const prodUnit = prod.unit ?? '';
  const intensityTotal = prodTotal > 0 && !prod.mixedUnits ? t.total / prodTotal : null;
  const topSources = sources.slice(0, 7).map((s) => ({ name: s.label, t: s.kg / 1000, scope: s.scope }));
  const scopeRows = ([1, 2, 3] as const).map((s) => ({ name: `Scope ${s}`, t: t.byScope[s] / 1000, scope: s }));
  const reductionRows = scen
    .filter((x) => x.r.reductionT !== null)
    .map((x) => ({ name: x.a.title, t: x.r.reductionT! }))
    .sort((a, b) => b.t - a.t);

  return (
    <>
      {header}

      {!latestRun && (
        <Notice tone="warning" title="Footprint not calculated yet" className="mb-6">
          You have {periodActivities.length} activity records for this period. Run a calculation to see emissions — dashboards only show saved calculation results.
        </Notice>
      )}
      {latestRun && runIsStale && (
        <Notice tone="warning" title="Results are out of date" className="mb-6">
          Activity data changed after the last calculation ({fmtDateTime(latestRun.createdAt)}). Figures below reflect that run; recalculate to include the changes.
        </Notice>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <FilterSelect label="From" value={from} onChange={setFrom} options={allMonths} placeholder="Period start" />
        <FilterSelect label="To" value={to} onChange={setTo} options={allMonths} placeholder="Period end" />
        <div>
          <label htmlFor="dash-fac" className="mb-1 block text-xs font-medium text-ink-muted">
            Facility
          </label>
          <Select id="dash-fac" className="h-9 w-48" value={facilityId} onChange={(e) => setFacilityFilter(e.target.value)}>
            <option value="all">All facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>
            Reset dates
          </Button>
        )}
        {latestRun && <p className="ml-auto text-xs text-ink-muted">Based on calculation run of {fmtDateTime(latestRun.createdAt)}</p>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat className="col-span-2 md:col-span-1" label="Assessed footprint" value={latestRun ? `${fmtNumber(t.total / 1000, 2)} t` : '—'} sub="tCO₂e · Scopes 1, 2 & assessed Scope 3" icon={<Leaf className="h-4 w-4" />} />
        <Stat label="Scope 1" value={latestRun ? `${fmtNumber(t.byScope[1] / 1000, 2)} t` : '—'} sub="Direct emissions" icon={<Factory className="h-4 w-4" />} />
        <Stat label="Scope 2" value={latestRun ? `${fmtNumber(t.byScope[2] / 1000, 2)} t` : '—'} sub="Purchased energy, location-based" icon={<Zap className="h-4 w-4" />} />
        <Stat label="Scope 3" value={latestRun ? `${fmtNumber(t.byScope[3] / 1000, 2)} t` : '—'} sub={`${s3Assessed} categor${s3Assessed === 1 ? 'y' : 'ies'} assessed — not complete`} icon={<Activity className="h-4 w-4" />} />
        <Stat
          label="Emissions intensity"
          value={intensityTotal !== null && latestRun ? `${fmtNumber(intensityTotal, 3)}` : '—'}
          sub={prod.mixedUnits ? 'Facilities use different production units' : intensityTotal !== null ? `kg CO₂e per ${prodUnit}` : 'Add production data'}
          icon={<Gauge className="h-4 w-4" />}
        />
        <Stat label="Electricity" value={kwh ? `${fmtNumber(kwh)} kWh` : '—'} sub={`${elec.filter((e) => e.kwh !== null).length} of ${elec.length} months recorded`} icon={<Zap className="h-4 w-4" />} />
        <Stat label="Electricity spend" value={hasSpend ? fmtInr(spend) : '—'} sub={hasSpend ? (kwh ? `≈ ₹${fmtNumber(spend / kwh, 2)}/kWh average` : 'From bills') : 'Add bill amounts'} icon={<IndianRupee className="h-4 w-4" />} />
        <Stat label="Est. annual savings" value={scen.length ? fmtInr(savings) : '—'} sub={scen.length ? `${scen.length} planned actions · estimates, not guaranteed` : 'Plan actions in Reduction Planner'} icon={<PiggyBank className="h-4 w-4" />} />
        <Stat
          className="col-span-2 md:col-span-1"
          label="Data completeness"
          value={`${fmtNumber(comp.pct, 0)}%`}
          sub={`${comp.present} of ${comp.expected} monthly electricity & production entries`}
          icon={<Database className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly emissions" description="tCO₂e by scope, from the latest calculation run" className="lg:col-span-2">
          {!latestRun || t.total === 0 ? (
            <ChartEmpty>No calculated emissions for the selected filters.</ChartEmpty>
          ) : (
            <>
              <Legend items={[1, 2, 3].map((s) => ({ label: `Scope ${s}`, color: SCOPE_COLORS[s as 1 | 2 | 3] }))} />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthly} margin={{ left: -8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...axisProps} />
                  <YAxis {...axisProps} width={48} />
                  <Tooltip cursor={{ fill: '#F7F9F6' }} content={<ChartTooltip format={tco2} labelFormat={fmtMonth} />} />
                  {([1, 2, 3] as const).map((s, i) => (
                    <Bar isAnimationActive={false} key={s} dataKey={`s${s}`} name={`Scope ${s}`} stackId="a" fill={SCOPE_COLORS[s]} stroke="#fff" strokeWidth={1} radius={i === 2 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </ChartCard>

        <ChartCard title="Scope breakdown" description="tCO₂e for the selected range">
          {!latestRun || t.total === 0 ? (
            <ChartEmpty>No calculated emissions yet.</ChartEmpty>
          ) : (
            <ul className="space-y-4 py-2">
              {scopeRows.map((r) => (
                <li key={r.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SCOPE_COLORS[r.scope] }} aria-hidden />
                      {r.name}
                    </span>
                    <span className="font-medium">
                      {fmtNumber(r.t, 2)} t <span className="font-normal text-ink-muted">({fmtNumber((r.t * 100000) / t.total, 0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-canvas">
                    <div className="h-2.5 rounded-full" style={{ width: `${(r.t * 100000) / t.total}%`, background: SCOPE_COLORS[r.scope] }} />
                  </div>
                </li>
              ))}
              {s3Assessed === 0 && <li className="text-xs text-ink-muted">Scope 3 has no assessed categories in this run.</li>}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Emissions by source" description="Largest sources, tCO₂e">
          {topSources.length === 0 ? (
            <ChartEmpty>No calculated sources yet.</ChartEmpty>
          ) : (
            <HBar data={topSources} colorOf={(d) => SCOPE_COLORS[d.scope]} format={tco2} />
          )}
        </ChartCard>

        <ChartCard title="Electricity consumption" description="kWh per month, from bills">
          {kwh === 0 ? (
            <ChartEmpty>No electricity records for the selected filters.</ChartEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={elec} margin={{ left: -8, right: 8 }}>
                <CartesianGrid vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...axisProps} />
                <YAxis {...axisProps} width={56} tickFormatter={(v) => fmtNumber(v)} />
                <Tooltip cursor={{ fill: '#F7F9F6' }} content={<ChartTooltip format={(v) => `${fmtNumber(v)} kWh`} labelFormat={fmtMonth} />} />
                <Bar isAnimationActive={false} dataKey="kwh" name="Electricity" fill={SINGLE_SERIES} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {elec.some((e) => e.kwh === null) && kwh > 0 && (
            <p className="mt-2 text-xs text-ink-muted">Gaps are months with no electricity record — missing data is shown as missing, not zero.</p>
          )}
        </ChartCard>

        <ChartCard title="Emissions intensity" description={prodUnit ? `kg CO₂e per ${prodUnit} produced` : 'kg CO₂e per unit produced'}>
          {prod.mixedUnits ? (
            <ChartEmpty>Facilities record production in different units. Select one facility to see intensity.</ChartEmpty>
          ) : !latestRun || intensity.every((x) => x.value === null) ? (
            <ChartEmpty>Needs both calculated emissions and production records.</ChartEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={intensity} margin={{ left: -8, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...axisProps} />
                <YAxis {...axisProps} width={48} />
                <Tooltip content={<ChartTooltip format={(v) => `${fmtNumber(v, 3)} kg/${prodUnit}`} labelFormat={fmtMonth} />} />
                <Line isAnimationActive={false} dataKey="value" name="Intensity" stroke={SINGLE_SERIES} strokeWidth={2} dot={{ r: 4, fill: SINGLE_SERIES, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Reduction opportunities" description="Estimated annual reduction, tCO₂e — not carbon credits">
          {reductionRows.length === 0 ? (
            <ChartEmpty>
              <span>
                No scenarios with an emissions estimate yet.{' '}
                <Link to="/app/reduction-planner" className="text-forest underline">
                  Open the Reduction Planner
                </Link>
              </span>
            </ChartEmpty>
          ) : (
            <HBar data={reductionRows} colorOf={() => SINGLE_SERIES} format={tco2} />
          )}
        </ChartCard>
      </div>
    </>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const id = `f-${label}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <Select id={id} className="h-9 w-36" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((m) => (
          <option key={m} value={m.slice(0, 7)}>
            {fmtMonth(m)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Horizontal bar list with labels in text tokens and values printed beside each bar. */
function HBar<T extends { name: string; t: number }>({ data, colorOf, format }: { data: T[]; colorOf: (d: T) => string; format: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.t), 0) || 1;
  return (
    <ul className="space-y-3 py-1">
      {data.map((d) => (
        <li key={d.name} className="group">
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-ink">{d.name}</span>
            <span className="shrink-0 font-medium">{format(d.t)}</span>
          </div>
          <div className="h-2 rounded-full bg-canvas">
            <div className="h-2 rounded-full transition-opacity group-hover:opacity-80" style={{ width: `${(Math.max(d.t, 0) / max) * 100}%`, background: colorOf(d) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
