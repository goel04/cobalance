import { METHODOLOGY_VERSION } from '@/lib/engine/calculate';
import type { EmissionFactor } from '@/lib/engine/types';
import { normalize, runInto, uid } from './actions';
import { update } from './store';
import type { ActivityRecord, DB } from './types';

// Sample organisation for exploring Cobalance. Everything here is illustrative:
// it lives in a separate organisation flagged isSample, and sample factors are
// marked origin 'sample' so the engine and reports label them as such.

const MONTHS = ['2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03'];
const ELECTRICITY = [44200, 46800, 45100, 41900, 40800, 42300, 43900, 41200, 39800, 40100, null, 43600]; // Feb missing on purpose
const DIESEL_DG = [820, 910, 760, 640, 590, 610, 700, 540, 520, 560, 600, 690];
const PRODUCTION = [51200, 53800, 52100, 49800, 48600, 50300, 52900, 50100, 47700, 48900, 49600, 52400];
const YARN_T = [44, 46, 45, 43, 41, 43, 46, 43, 41, 42, 43, 45];

const SAMPLE_NOTE = 'ILLUSTRATIVE SAMPLE FACTOR — invented for demonstration, not sourced. Replace with a documented factor before any real use.';

function sampleFactor(orgId: string, over: Partial<EmissionFactor> & Pick<EmissionFactor, 'category' | 'subtype' | 'activityUnit' | 'components' | 'factorUnit' | 'factorCode'>): EmissionFactor {
  return {
    id: uid(),
    geography: 'GLOBAL',
    validFrom: '2020-01-01',
    validTo: null,
    publicationYear: 2024,
    sourceName: 'Cobalance sample data (illustrative)',
    sourceUrl: '',
    methodology: 'Illustrative placeholder for demonstrating Scope 3 workflows.',
    version: 'sample-1',
    gwpReference: 'n/a',
    reviewStatus: 'provisional',
    origin: 'sample',
    organizationId: orgId,
    notes: SAMPLE_NOTE,
    ...over,
  };
}

export function createSampleOrganization(): string {
  return update((d: DB) => {
    const userId = d.session.userId;
    if (!userId) throw new Error('Please log in first.');
    const t = new Date().toISOString();
    const orgId = uid();
    const facilityId = uid();
    const periodId = uid();

    d.organizations.push({
      id: orgId,
      name: 'Sample Textiles Co. (illustrative)',
      industry: 'Textiles & apparel',
      companySize: '51–200 employees',
      country: 'India',
      state: 'Tamil Nadu',
      city: 'Coimbatore',
      website: '',
      isSample: true,
      onboardingStep: 4,
      createdAt: t,
    });
    d.memberships.push({ organizationId: orgId, userId, role: 'owner', createdAt: t });
    d.facilities.push({
      id: facilityId,
      organizationId: orgId,
      name: 'Sample Weaving Unit',
      address: 'Illustrative address',
      state: 'Tamil Nadu',
      city: 'Coimbatore',
      facilityType: 'Manufacturing plant',
      industry: 'Textiles & apparel',
      productionUnit: 'kg',
      annualCapacity: 720000,
      createdAt: t,
    });
    d.periods.push({
      id: periodId,
      organizationId: orgId,
      label: 'FY 2024-25',
      startDate: '2024-04-01',
      endDate: '2025-03-31',
      status: 'open',
      methodologyVersion: METHODOLOGY_VERSION,
      scope3Exclusions: [{ category: 'employee_commuting', reason: 'Sample: outside the boundary of this first inventory; planned for next year.' }],
      createdAt: t,
    });

    d.factors.push(
      sampleFactor(orgId, {
        factorCode: 'SAMPLE-S3-YARN',
        category: 'purchased_goods',
        subtype: 'cotton_yarn',
        activityUnit: 't',
        components: [{ gas: 'CO2e', kgPerUnit: 2500 }],
        factorUnit: 'kg CO2e / t',
      }),
      sampleFactor(orgId, {
        factorCode: 'SAMPLE-S3-TRUCK',
        category: 'upstream_transport',
        subtype: 'road_truck',
        activityUnit: 'tkm',
        components: [{ gas: 'CO2e', kgPerUnit: 0.1 }],
        factorUnit: 'kg CO2e / tkm',
      }),
    );

    const rec = (over: Partial<ActivityRecord> & Pick<ActivityRecord, 'category' | 'subtype' | 'activityDate' | 'quantity' | 'unit'>): ActivityRecord => ({
      id: uid(),
      organizationId: orgId,
      facilityId,
      reportingPeriodId: periodId,
      normalizedQuantity: null,
      normalizedUnit: null,
      distanceKm: null,
      weightTonnes: null,
      costAmount: null,
      currency: 'INR',
      dataQuality: 'measured',
      dataSource: 'sample',
      evidenceDocumentId: null,
      reviewStatus: 'unreviewed',
      notes: 'Sample data (illustrative)',
      createdBy: userId,
      createdAt: t,
      updatedAt: t,
      ...over,
    });

    const records: ActivityRecord[] = [];
    MONTHS.forEach((m, i) => {
      const date = `${m}-01`;
      const kwh = ELECTRICITY[i];
      if (kwh !== null) {
        records.push(rec({ category: 'purchased_electricity', subtype: 'grid', activityDate: date, quantity: kwh, unit: 'kWh', costAmount: Math.round(kwh * 8.4) }));
      }
      records.push(rec({ category: 'stationary_combustion', subtype: 'diesel', activityDate: date, quantity: DIESEL_DG[i], unit: 'L', costAmount: DIESEL_DG[i] * 92 }));
      records.push(rec({ category: 'stationary_combustion', subtype: 'lpg', activityDate: date, quantity: 380, unit: 'kg', costAmount: 380 * 95 }));
      records.push(rec({ category: 'production', subtype: 'output', activityDate: date, quantity: PRODUCTION[i], unit: 'kg' }));
      records.push(rec({ category: 'purchased_goods', subtype: 'cotton_yarn', activityDate: date, quantity: YARN_T[i], unit: 't', dataQuality: 'calculated' }));
      if (i % 3 === 0) {
        records.push(rec({ category: 'upstream_transport', subtype: 'road_truck', activityDate: date, quantity: 420 * 33, unit: 'tkm', distanceKm: 420, weightTonnes: 33, dataQuality: 'estimated' }));
        records.push(rec({ category: 'waste', subtype: 'mixed_landfill', activityDate: date, quantity: 4.2, unit: 't' }));
      }
    });
    records.push(rec({ category: 'mobile_combustion', subtype: 'diesel', activityDate: '2024-09-01', quantity: 1450, unit: 'L', dataQuality: 'estimated', notes: 'Sample: delivery vehicle, estimated from fuel card summary' }));
    records.push(rec({ category: 'refrigerants', subtype: 'R-410A', activityDate: '2024-06-01', quantity: 3.5, unit: 'kg', notes: 'Sample: AC top-up from service invoice' }));
    records.push(rec({ category: 'stationary_combustion', subtype: 'coal', activityDate: '2024-04-01', quantity: 12, unit: 't', notes: 'Sample: boiler coal — no default factor (needs supplier GCV)' }));
    records.forEach((r) => Object.assign(r, normalize(d, r)));
    d.activities.push(...records);

    const annualKwh = ELECTRICITY.reduce<number>((s, v) => s + (v ?? 0), 0);
    const ta = new Date().toISOString();
    d.reductionActions.push(
      {
        id: uid(),
        organizationId: orgId,
        facilityId,
        reportingPeriodId: periodId,
        actionType: 'solar',
        title: 'Rooftop solar — 100 kWp',
        description: 'Install a grid-connected rooftop PV system on the weaving shed roof.',
        baselineLabel: 'Annual grid electricity',
        baselineUnit: 'kWh',
        inputs: { baselineQuantity: annualKwh, unitCost: 8.4, emissionFactorKgPerUnit: 0.727, reductionPct: 0, capex: 4200000, annualOperatingCost: 42000, solar: { capacityKwp: 100, yieldKwhPerKwpYear: 1400 } },
        assumptions: 'Sample: specific yield 1,400 kWh/kWp/yr; installed cost ₹42,000/kWp; O&M 1% of capex per year; tariff ₹8.4/kWh from bills.',
        limitations: 'Illustrative only. Requires a site survey, structural check and DISCOM net-metering approval. Panel degradation and tariff escalation are ignored.',
        status: 'proposed',
        createdAt: ta,
        updatedAt: ta,
      },
      {
        id: uid(),
        organizationId: orgId,
        facilityId,
        reportingPeriodId: periodId,
        actionType: 'efficient_machinery',
        title: 'IE3 motors on looms',
        description: 'Replace standard-efficiency loom motors with IE3 motors at end of life.',
        baselineLabel: 'Annual electricity of loom motors',
        baselineUnit: 'kWh',
        inputs: { baselineQuantity: 180000, unitCost: 8.4, emissionFactorKgPerUnit: 0.727, reductionPct: 6, capex: 650000, annualOperatingCost: 0 },
        assumptions: 'Sample: looms use ~180,000 kWh/yr; IE3 motors save ~6% versus existing motors.',
        limitations: 'Illustrative only. Savings depend on load factor and operating hours; measure motor loads before deciding.',
        status: 'in_progress',
        createdAt: ta,
        updatedAt: ta,
      },
    );

    d.session.organizationId = orgId;
    d.session.periodId = periodId;
    d.session.facilityId = 'all';
    runInto(d, orgId, periodId);
    return orgId;
  });
}
