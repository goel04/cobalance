# Cobalance

Sustainability intelligence for Indian MSME manufacturers: carbon footprint (Scope 1, 2 and selected Scope 3), dashboards, reduction planning and transparent reports.

> **Frontend-only build, demo mode.** There is no backend yet. Accounts, organisations, records and evidence files are stored in the browser (localStorage + IndexedDB) and every app screen says so. Nothing is sent to a server.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # engine + CSV import unit tests (vitest)
npm run build      # type-check + production build
```

To explore quickly: sign up, then choose **Explore sample data** in onboarding (or Settings → Data). The sample organisation is flagged, isolated from real records and uses clearly labelled illustrative factors.

## Structure

```
src/
  lib/engine/        Pure, UI-free calculation engine (tested)
    catalog.ts         Activity categories, sources, allowed units, scope mapping
    units.ts           Unit normalisation (density-based fuel conversions)
    factors.ts         Versioned emission-factor library + AR5 GWPs
    calculate.ts       Factor selection, multi-gas → CO2e, run summaries
    reduction.ts       Savings / payback / reduction scenario maths
  lib/data/          Demo data layer (mirrors the planned Supabase schema)
    types.ts           Record shapes (organizations, facilities, activity_records, …)
    store.ts           localStorage persistence — swap for a Supabase repository later
    actions.ts         All writes, with role checks (RLS stand-in) and audit events
    analytics.ts       Dashboard / completeness / Scope 3 status, from saved runs only
    seed.ts            Sample organisation
  lib/reports/       Report model (build.ts) + PDF renderer (pdf.ts)
  lib/csv-import.ts  CSV parsing and validation (tested)
  components/        ui/ primitives, marketing/ site, app/ shell & shared app parts
  pages/             marketing/, auth/, app/
```

## Methodology (what the numbers are based on)

| Source | Factor | Status |
| --- | --- | --- |
| Stationary & mobile fuels (diesel, petrol, LPG, natural gas, furnace oil) | IPCC 2006 Vol. 2 Tier 1 defaults (NCV × CO2/CH4/N2O per TJ), typical densities for volume inputs | Approved |
| Refrigerants (R-410A, R-32, R-134a, R-404A) | IPCC AR5 100-yr GWPs | Approved |
| Indian grid electricity (location-based Scope 2) | CEA CO2 Baseline Database v20.0, FY 2023-24 weighted average, 0.727 tCO2/MWh | **Provisional** — value taken from secondary reporting; confirm against the CEA user guide (v22.0 revised earlier years) before external use |
| Coal, purchased steam, all Scope 3 categories | None built in | Records show **Awaiting factor** until an admin adds a documented factor (Settings → Emission factors) |

Rules the engine enforces: missing quantities are never treated as zero; an activity without a factor is excluded and flagged, never given an invented value; each result stores a snapshot of the factor it used; factors are retired, never edited in place; totals reconcile to the sum of results.

## Next: backend

The data layer is written so Supabase can replace it: `store.ts`/`actions.ts` become calls to Postgres tables with RLS policies matching the role checks in `actions.ts`, evidence moves from IndexedDB to a private Storage bucket, and `createCalculationRun` moves into an Edge Function that imports `src/lib/engine` unchanged.
