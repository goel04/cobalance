-- Cobalance core schema.
-- Tables mirror the app's data model (src/lib/data/types.ts):
--   organisation → companies, reporting period → carbon_assessments,
--   activity record → emission_activities.
-- Row Level Security is enabled in 20261026000002_rls.sql.

create extension if not exists pgcrypto;

-- ── Shared helpers ───────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Profiles (one per auth user) ─────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Companies and membership ─────────────────────────────────────────────

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  industry text not null default '',
  company_size text not null default '',
  country text not null default 'India',
  state text not null default '',
  city text not null default '',
  website text not null default '',
  -- Sample companies hold illustrative data only and are flagged everywhere.
  is_sample boolean not null default false,
  onboarding_step smallint not null default 1 check (onboarding_step between 0 and 4),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

-- ── Facilities ───────────────────────────────────────────────────────────

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  address text not null default '',
  state text not null default '',
  city text not null default '',
  facility_type text not null default '',
  industry text not null default '',
  production_unit text not null check (production_unit in ('kg', 't', 'units', 'L')),
  annual_capacity numeric check (annual_capacity is null or annual_capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets child tables prove a facility belongs to the same company.
  unique (id, company_id)
);

create index facilities_company_idx on public.facilities (company_id);
create trigger facilities_updated_at before update on public.facilities
  for each row execute function public.set_updated_at();

-- ── Carbon assessments (reporting periods) ───────────────────────────────

create table public.carbon_assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  label text not null check (length(trim(label)) >= 1),
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  methodology_version text not null,
  -- [{ "category": "...", "reason": "..." }] — Scope 3 categories outside the boundary.
  scope3_exclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(scope3_exclusions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (id, company_id)
);

create index carbon_assessments_company_idx on public.carbon_assessments (company_id, start_date desc);
create trigger carbon_assessments_updated_at before update on public.carbon_assessments
  for each row execute function public.set_updated_at();

-- ── Emission factor library ──────────────────────────────────────────────
-- company_id is null for the shared, read-only library; otherwise the factor
-- belongs to one company (user-supplied or sample). Factors are never edited
-- in place: retire and add a new version so past runs stay reproducible.

create table public.emission_factors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  factor_code text not null,
  category text not null,
  subtype text not null,
  activity_unit text not null,
  -- [{ "gas": "CO2", "kgPerUnit": 3.18 }, …] — kg of each gas per activity unit.
  components jsonb not null check (jsonb_typeof(components) = 'array' and jsonb_array_length(components) > 0),
  factor_unit text not null,
  geography text not null,
  valid_from date not null,
  valid_to date,
  publication_year integer not null,
  source_name text not null check (length(trim(source_name)) > 0),
  source_url text not null default '',
  methodology text not null default '',
  version text not null,
  gwp_reference text not null check (gwp_reference in ('AR5', 'AR6', 'n/a')),
  review_status text not null check (review_status in ('approved', 'provisional', 'retired')),
  origin text not null check (origin in ('library', 'user', 'sample')),
  -- { "densityKgPerL": 0.835 } — unit-conversion assumptions.
  conversions jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check ((company_id is null) = (origin = 'library')),
  unique nulls not distinct (company_id, factor_code, version)
);

create index emission_factors_lookup_idx on public.emission_factors (category, subtype, geography, valid_from);
create index emission_factors_company_idx on public.emission_factors (company_id);

-- ── Evidence documents (files live in the private "evidence" bucket) ─────

create table public.evidence_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  facility_id uuid,
  assessment_id uuid,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 10485760),
  storage_path text not null unique,
  document_type text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed')),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Storage paths start with the owning company's id (checked by storage policies too).
  check (storage_path like company_id::text || '/%'),
  foreign key (facility_id, company_id) references public.facilities (id, company_id) on delete set null (facility_id),
  foreign key (assessment_id, company_id) references public.carbon_assessments (id, company_id) on delete set null (assessment_id),
  unique (id, company_id)
);

create index evidence_documents_company_idx on public.evidence_documents (company_id);

-- ── Emission activities ──────────────────────────────────────────────────
-- Original quantity/unit are kept alongside normalised values. A null quantity
-- means "missing" and is never treated as zero.

create table public.emission_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  facility_id uuid not null,
  assessment_id uuid not null,
  category text not null check (category in (
    'stationary_combustion', 'mobile_combustion', 'refrigerants',
    'purchased_electricity', 'purchased_heat_steam',
    'purchased_goods', 'purchased_packaging', 'upstream_transport', 'waste',
    'business_travel', 'employee_commuting', 'production'
  )),
  subtype text not null,
  activity_date date not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null,
  normalized_quantity numeric,
  normalized_unit text,
  distance_km numeric check (distance_km is null or distance_km >= 0),
  weight_tonnes numeric check (weight_tonnes is null or weight_tonnes >= 0),
  cost_amount numeric check (cost_amount is null or cost_amount >= 0),
  currency text not null default 'INR',
  data_quality text not null check (data_quality in ('measured', 'calculated', 'estimated')),
  data_source text not null check (data_source in ('manual', 'csv', 'onboarding', 'sample')),
  evidence_document_id uuid,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed')),
  notes text not null default '' check (length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Facility, assessment and evidence must belong to the same company as the activity.
  foreign key (facility_id, company_id) references public.facilities (id, company_id) on delete restrict,
  foreign key (assessment_id, company_id) references public.carbon_assessments (id, company_id) on delete cascade,
  foreign key (evidence_document_id, company_id) references public.evidence_documents (id, company_id) on delete set null (evidence_document_id)
);

create index emission_activities_assessment_idx on public.emission_activities (assessment_id, activity_date);
create index emission_activities_company_idx on public.emission_activities (company_id);
create index emission_activities_facility_idx on public.emission_activities (facility_id);
create trigger emission_activities_updated_at before update on public.emission_activities
  for each row execute function public.set_updated_at();

-- ── Calculation runs and results (append-only) ───────────────────────────

create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  assessment_id uuid not null,
  engine_version text not null,
  methodology_version text not null,
  status text not null check (status in ('completed', 'completed_with_warnings')),
  -- Totals by scope/category and result counts, as computed by the engine.
  summary jsonb not null,
  -- Snapshot of every input activity, so the run is reproducible after later edits.
  inputs jsonb not null check (jsonb_typeof(inputs) = 'array'),
  scope3_exclusions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (assessment_id, company_id) references public.carbon_assessments (id, company_id) on delete cascade,
  unique (id, company_id)
);

create index calculation_runs_assessment_idx on public.calculation_runs (assessment_id, created_at desc);

create table public.calculation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  company_id uuid not null,
  -- The activity may later be edited or deleted; the run's input snapshot keeps the original.
  activity_id uuid references public.emission_activities (id) on delete set null,
  source_activity_id uuid not null,
  scope smallint check (scope between 1 and 3),
  category text not null,
  subtype text not null,
  status text not null check (status in ('calculated', 'estimated', 'awaiting_factor', 'invalid', 'not_applicable')),
  input_quantity numeric,
  input_unit text not null,
  normalized_quantity numeric,
  normalized_unit text,
  emissions_kg_co2e numeric check (emissions_kg_co2e is null or emissions_kg_co2e >= 0),
  -- [{ gas, kgGas, gwp, kgCo2e }]
  gases jsonb not null default '[]'::jsonb,
  -- Queryable copy of the factor used, plus the full snapshot.
  factor_id uuid references public.emission_factors (id) on delete set null,
  factor_code text,
  factor_version text,
  factor_source_name text,
  factor_snapshot jsonb,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (run_id, company_id) references public.calculation_runs (id, company_id) on delete cascade,
  -- Emissions exist exactly when the result was calculated or estimated: a
  -- missing factor or invalid input can never be stored as a number (or zero).
  check ((status in ('calculated', 'estimated')) = (emissions_kg_co2e is not null)),
  check (status not in ('calculated', 'estimated') or factor_snapshot is not null)
);

create index calculation_results_run_idx on public.calculation_results (run_id);
create index calculation_results_company_idx on public.calculation_results (company_id);

-- ── Reduction planner ────────────────────────────────────────────────────

create table public.reduction_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  facility_id uuid,
  assessment_id uuid not null,
  action_type text not null check (action_type in (
    'solar', 'efficient_machinery', 'electricity_optimization', 'fuel_reduction', 'waste_reduction', 'material_efficiency'
  )),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  baseline_label text not null default '',
  baseline_unit text not null default '',
  -- Scenario inputs exactly as entered (baseline, unit cost, factor, capex, …).
  inputs jsonb not null,
  assumptions text not null default '',
  limitations text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'in_progress', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (facility_id, company_id) references public.facilities (id, company_id) on delete set null (facility_id),
  foreign key (assessment_id, company_id) references public.carbon_assessments (id, company_id) on delete cascade
);

create index reduction_actions_assessment_idx on public.reduction_actions (assessment_id);
create trigger reduction_actions_updated_at before update on public.reduction_actions
  for each row execute function public.set_updated_at();

-- ── Reports ──────────────────────────────────────────────────────────────

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  assessment_id uuid not null,
  calculation_run_id uuid not null,
  report_type text not null check (report_type in ('pdf', 'csv')),
  -- Never "verified": only third-party assurance could justify that label.
  status text not null default 'draft' check (status in ('draft', 'reviewed_internally')),
  file_name text not null,
  generated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (assessment_id, company_id) references public.carbon_assessments (id, company_id) on delete cascade,
  foreign key (calculation_run_id, company_id) references public.calculation_runs (id, company_id) on delete cascade
);

create index reports_assessment_idx on public.reports (assessment_id, generated_at desc);

-- ── Audit history (written only by triggers) ─────────────────────────────

create table public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies (id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index audit_events_company_idx on public.audit_events (company_id, created_at desc);

create or replace function public.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  cid uuid := case when tg_table_name = 'companies' then (rec ->> 'id')::uuid else (rec ->> 'company_id')::uuid end;
begin
  -- Skip the cascade when a whole company is deleted.
  if tg_op = 'DELETE' and tg_table_name <> 'companies'
     and not exists (select 1 from public.companies c where c.id = cid) then
    return old;
  end if;
  insert into public.audit_events (company_id, user_id, action, entity_type, entity_id, summary)
  values (
    case when tg_op = 'DELETE' and tg_table_name = 'companies' then null else cid end,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    coalesce(rec ->> 'name', rec ->> 'title', rec ->> 'label', rec ->> 'factor_code', rec ->> 'file_name',
             (rec ->> 'category') || '/' || (rec ->> 'subtype'), '')
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['companies', 'facilities', 'carbon_assessments', 'emission_activities', 'emission_factors',
                           'evidence_documents', 'calculation_runs', 'reduction_actions', 'reports'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.write_audit_event()',
      t || '_audit', t);
  end loop;
end;
$$;
