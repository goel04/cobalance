# Cobalance

Sustainability intelligence for Indian MSME manufacturers: carbon footprint (Scope 1, 2 and selected Scope 3), dashboards, reduction planning and transparent reports.

Backend: **Supabase** (Postgres with Row Level Security, Auth, private Storage). Hosting: **Vercel**. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Run it

```sh
npm install
# .env.local needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see docs/DEPLOYMENT.md)
npm run dev        # http://localhost:5173
npm test           # all tests: engine, CSV import, data layer, database (PGlite)
npm run test:db    # migrations + RLS + app write payloads against an in-process Postgres
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
  lib/supabase.ts    Browser client (publishable key only)
  lib/auth.tsx       Session provider: loads the account's data on sign-in, clears it on sign-out
  lib/data/          Data layer
    types.ts           Record shapes used by the app
    remote.ts          Supabase repository: row ↔ record mappers, paged loading, friendly errors
    store.ts           In-memory cache of the signed-in user's data (never persisted locally)
    actions.ts         Auth + every write: Supabase first (RLS enforces roles), then the cache
    bundle.ts          All-or-nothing import of a whole organisation (sample data, legacy import)
    legacy.ts          Import of data saved in the browser by the earlier demo version
    analytics.ts       Dashboard / completeness / Scope 3 status, from saved runs only
    seed.ts            Sample organisation
supabase/
  migrations/        Schema, RLS + storage policies, factor library seed
  tests/             rls_test.sql (SQL editor) + db.test.ts (PGlite)
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

## Security model

Every table has Row Level Security: users read only companies they belong to and write according to their role (viewer < editor < admin < owner). Calculation runs and results are append-only, audit events are written only by triggers, evidence files sit in a private bucket under `<company id>/…`. The browser holds only the publishable key; the app's own role checks exist for friendlier messages, the database is the enforcement point.

Calculations run in the browser with the tested engine and are saved atomically by the `save_calculation_run` RPC. A possible next step is to move the calculation into an Edge Function that imports `src/lib/engine` unchanged, so clients can't submit their own results.
