-- Company-level access control.
-- Every table has Row Level Security enabled. A user can read a company's rows
-- only while they are a member, and can write only with a sufficient role:
--   viewer < editor < admin < owner
-- These mirror the role checks the app makes (src/lib/data/actions.ts), but the
-- database is the enforcement point.

-- ── Role helpers ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so policies can consult company_members without recursing
-- into company_members' own policies. They only ever look at auth.uid().

create or replace function public.company_role(cid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.company_members m
  where m.company_id = cid and m.user_id = auth.uid();
$$;

create or replace function public.has_company_role(cid uuid, min_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_position(array['viewer', 'editor', 'admin', 'owner'], m.role)
            >= array_position(array['viewer', 'editor', 'admin', 'owner'], min_role)
     from public.company_members m
     where m.company_id = cid and m.user_id = auth.uid()),
    false);
$$;

revoke all on function public.company_role(uuid) from public;
revoke all on function public.has_company_role(uuid, text) from public;
grant execute on function public.company_role(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text) to authenticated;

-- ── Enable RLS everywhere ────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.facilities enable row level security;
alter table public.carbon_assessments enable row level security;
alter table public.emission_factors enable row level security;
alter table public.evidence_documents enable row level security;
alter table public.emission_activities enable row level security;
alter table public.calculation_runs enable row level security;
alter table public.calculation_results enable row level security;
alter table public.reduction_actions enable row level security;
alter table public.reports enable row level security;
alter table public.audit_events enable row level security;

-- Anonymous visitors get nothing from any of these tables.
revoke all on all tables in schema public from anon;

-- ── Profiles ─────────────────────────────────────────────────────────────

create policy "profiles: read own and co-members" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── Companies ────────────────────────────────────────────────────────────
-- Created only through create_company() so the creator becomes owner atomically.

create policy "companies: members read" on public.companies
  for select to authenticated
  using (public.has_company_role(id, 'viewer'));

create policy "companies: admins update" on public.companies
  for update to authenticated
  using (public.has_company_role(id, 'admin'))
  with check (public.has_company_role(id, 'admin'));

create policy "companies: owners delete" on public.companies
  for delete to authenticated
  using (public.has_company_role(id, 'owner'));

-- Only profile fields are editable; is_sample and created_by never change.
-- (Column grants only restrict anything once the table-wide grant is revoked.)
revoke update on public.companies from authenticated;
grant update (name, industry, company_size, country, state, city, website, onboarding_step) on public.companies to authenticated;

create or replace function public.create_company(
  p_name text,
  p_industry text,
  p_company_size text,
  p_country text,
  p_state text,
  p_city text,
  p_website text,
  p_is_sample boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.companies (name, industry, company_size, country, state, city, website, is_sample,
                                onboarding_step, created_by)
  values (p_name, coalesce(p_industry, ''), coalesce(p_company_size, ''), coalesce(p_country, 'India'),
          coalesce(p_state, ''), coalesce(p_city, ''), coalesce(p_website, ''), coalesce(p_is_sample, false),
          case when p_is_sample then 4 else 1 end, uid)
  returning id into cid;
  insert into public.company_members (company_id, user_id, role) values (cid, uid, 'owner');
  return cid;
end;
$$;

revoke all on function public.create_company(text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.create_company(text, text, text, text, text, text, text, boolean) to authenticated;

-- ── Company members ──────────────────────────────────────────────────────

create policy "members: members read" on public.company_members
  for select to authenticated
  using (public.has_company_role(company_id, 'viewer'));

-- Admins may add members, but only an owner may create another owner.
create policy "members: admins add" on public.company_members
  for insert to authenticated
  with check (
    public.has_company_role(company_id, 'admin')
    and (role <> 'owner' or public.has_company_role(company_id, 'owner'))
  );

create policy "members: admins change roles" on public.company_members
  for update to authenticated
  using (
    public.has_company_role(company_id, 'admin')
    and (role <> 'owner' or public.has_company_role(company_id, 'owner'))
  )
  with check (
    public.has_company_role(company_id, 'admin')
    and (role <> 'owner' or public.has_company_role(company_id, 'owner'))
  );

create policy "members: admins remove, anyone leaves" on public.company_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or (public.has_company_role(company_id, 'admin') and (role <> 'owner' or public.has_company_role(company_id, 'owner')))
  );

-- Only the role can change; rows never move between companies or users.
revoke update on public.company_members from authenticated;
grant update (role) on public.company_members to authenticated;

-- A company must always keep at least one owner.
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.companies c where c.id = old.company_id)
     and not exists (
       select 1 from public.company_members m
       where m.company_id = old.company_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'A company must keep at least one owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger company_members_keep_owner before update or delete on public.company_members
  for each row execute function public.keep_one_owner();

-- ── Standard company-scoped tables ───────────────────────────────────────
-- read: any member · insert/update/delete: role shown per table.

create policy "facilities: members read" on public.facilities
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "facilities: editors add" on public.facilities
  for insert to authenticated with check (public.has_company_role(company_id, 'editor'));
create policy "facilities: editors update" on public.facilities
  for update to authenticated
  using (public.has_company_role(company_id, 'editor'))
  with check (public.has_company_role(company_id, 'editor'));
create policy "facilities: admins delete" on public.facilities
  for delete to authenticated using (public.has_company_role(company_id, 'admin'));

create policy "assessments: members read" on public.carbon_assessments
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "assessments: admins add" on public.carbon_assessments
  for insert to authenticated with check (public.has_company_role(company_id, 'admin'));
create policy "assessments: admins update" on public.carbon_assessments
  for update to authenticated
  using (public.has_company_role(company_id, 'admin'))
  with check (public.has_company_role(company_id, 'admin'));
create policy "assessments: owners delete" on public.carbon_assessments
  for delete to authenticated using (public.has_company_role(company_id, 'owner'));

create policy "activities: members read" on public.emission_activities
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "activities: editors add" on public.emission_activities
  for insert to authenticated
  with check (public.has_company_role(company_id, 'editor') and created_by = auth.uid());
create policy "activities: editors update" on public.emission_activities
  for update to authenticated
  using (public.has_company_role(company_id, 'editor'))
  with check (public.has_company_role(company_id, 'editor'));
create policy "activities: editors delete" on public.emission_activities
  for delete to authenticated using (public.has_company_role(company_id, 'editor'));

-- Only admins may mark activity data as reviewed.
create or replace function public.guard_activity_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status is distinct from (case when tg_op = 'INSERT' then 'unreviewed' else old.review_status end)
     and new.review_status = 'reviewed'
     and not public.has_company_role(new.company_id, 'admin') then
    raise exception 'Only admins can mark records as reviewed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger emission_activities_review_guard before insert or update on public.emission_activities
  for each row execute function public.guard_activity_review();

create policy "evidence: members read" on public.evidence_documents
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "evidence: editors add" on public.evidence_documents
  for insert to authenticated
  with check (public.has_company_role(company_id, 'editor') and uploaded_by = auth.uid());
create policy "evidence: admins review" on public.evidence_documents
  for update to authenticated
  using (public.has_company_role(company_id, 'admin'))
  with check (public.has_company_role(company_id, 'admin'));
create policy "evidence: editors delete" on public.evidence_documents
  for delete to authenticated using (public.has_company_role(company_id, 'editor'));
revoke update on public.evidence_documents from authenticated;
grant update (review_status) on public.evidence_documents to authenticated;

create policy "reductions: members read" on public.reduction_actions
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "reductions: editors add" on public.reduction_actions
  for insert to authenticated with check (public.has_company_role(company_id, 'editor'));
create policy "reductions: editors update" on public.reduction_actions
  for update to authenticated
  using (public.has_company_role(company_id, 'editor'))
  with check (public.has_company_role(company_id, 'editor'));
create policy "reductions: editors delete" on public.reduction_actions
  for delete to authenticated using (public.has_company_role(company_id, 'editor'));

create policy "reports: members read" on public.reports
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "reports: members record" on public.reports
  for insert to authenticated
  with check (public.has_company_role(company_id, 'viewer') and created_by = auth.uid() and status = 'draft');
create policy "reports: admins set status" on public.reports
  for update to authenticated
  using (public.has_company_role(company_id, 'admin'))
  with check (public.has_company_role(company_id, 'admin'));
revoke update on public.reports from authenticated;
grant update (status) on public.reports to authenticated;

create policy "audit: members read" on public.audit_events
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
-- No insert/update/delete policies: audit rows are written only by triggers.
revoke insert, update, delete on public.audit_events from authenticated;

-- Rows never move between companies and keep their creator: only these columns are updatable.
revoke update on public.facilities, public.carbon_assessments, public.emission_activities, public.reduction_actions from authenticated;
grant update (name, address, state, city, facility_type, industry, production_unit, annual_capacity)
  on public.facilities to authenticated;
grant update (label, start_date, end_date, status, methodology_version, scope3_exclusions)
  on public.carbon_assessments to authenticated;
grant update (facility_id, assessment_id, category, subtype, activity_date, quantity, unit, normalized_quantity,
              normalized_unit, distance_km, weight_tonnes, cost_amount, currency, data_quality, data_source,
              evidence_document_id, review_status, notes)
  on public.emission_activities to authenticated;
grant update (facility_id, assessment_id, action_type, title, description, baseline_label, baseline_unit, inputs,
              assumptions, limitations, status)
  on public.reduction_actions to authenticated;

-- ── Emission factors ─────────────────────────────────────────────────────
-- The shared library (company_id is null) is readable by every signed-in user
-- and writable by no one through the API. Company factors are readable by
-- members; admins add them and may only change review_status afterwards.

create policy "factors: library and own company" on public.emission_factors
  for select to authenticated
  using (company_id is null or public.has_company_role(company_id, 'viewer'));
create policy "factors: admins add company factors" on public.emission_factors
  for insert to authenticated
  with check (company_id is not null and origin in ('user', 'sample') and public.has_company_role(company_id, 'admin'));
create policy "factors: admins review company factors" on public.emission_factors
  for update to authenticated
  using (company_id is not null and public.has_company_role(company_id, 'admin'))
  with check (company_id is not null and public.has_company_role(company_id, 'admin'));
revoke update, delete on public.emission_factors from authenticated;
grant update (review_status) on public.emission_factors to authenticated;

-- ── Calculation runs and results: append-only ────────────────────────────

create policy "runs: members read" on public.calculation_runs
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "runs: editors add" on public.calculation_runs
  for insert to authenticated
  with check (public.has_company_role(company_id, 'editor') and created_by = auth.uid());
revoke update, delete on public.calculation_runs from authenticated;

create policy "results: members read" on public.calculation_results
  for select to authenticated using (public.has_company_role(company_id, 'viewer'));
create policy "results: editors add" on public.calculation_results
  for insert to authenticated with check (public.has_company_role(company_id, 'editor'));
revoke update, delete on public.calculation_results from authenticated;

-- Save a run and all of its results in one transaction. SECURITY INVOKER, so
-- every row still passes the RLS policies above.
create or replace function public.save_calculation_run(
  p_company_id uuid,
  p_assessment_id uuid,
  p_engine_version text,
  p_methodology_version text,
  p_status text,
  p_summary jsonb,
  p_inputs jsonb,
  p_scope3_exclusions jsonb,
  p_results jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rid uuid;
begin
  insert into public.calculation_runs (company_id, assessment_id, engine_version, methodology_version, status,
                                       summary, inputs, scope3_exclusions, created_by)
  values (p_company_id, p_assessment_id, p_engine_version, p_methodology_version, p_status,
          p_summary, p_inputs, coalesce(p_scope3_exclusions, '[]'::jsonb), auth.uid())
  returning id into rid;

  insert into public.calculation_results (
    run_id, company_id, activity_id, source_activity_id, scope, category, subtype, status,
    input_quantity, input_unit, normalized_quantity, normalized_unit, emissions_kg_co2e, gases,
    factor_id, factor_code, factor_version, factor_source_name, factor_snapshot, warnings)
  select
    rid, p_company_id,
    (select a.id from public.emission_activities a where a.id = (r ->> 'activityId')::uuid and a.company_id = p_company_id),
    (r ->> 'activityId')::uuid,
    (r ->> 'scope')::smallint,
    r ->> 'category', r ->> 'subtype', r ->> 'status',
    (r ->> 'inputQuantity')::numeric, r ->> 'inputUnit',
    (r ->> 'normalizedQuantity')::numeric, r ->> 'normalizedUnit',
    (r ->> 'emissionsKgCo2e')::numeric,
    coalesce(r -> 'gases', '[]'::jsonb),
    (select f.id from public.emission_factors f where f.id::text = r -> 'factor' ->> 'factorId'),
    r -> 'factor' ->> 'factorCode', r -> 'factor' ->> 'version', r -> 'factor' ->> 'sourceName',
    r -> 'factor',
    coalesce(array(select jsonb_array_elements_text(r -> 'warnings')), '{}')
  from jsonb_array_elements(p_results) r;

  return rid;
end;
$$;

revoke all on function public.save_calculation_run(uuid, uuid, text, text, text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_calculation_run(uuid, uuid, text, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ── Private evidence bucket ──────────────────────────────────────────────
-- Object paths are "<company_id>/<document_id>/<file name>".

-- First path segment as a company id; null (→ no access) when it isn't a uuid.
create or replace function public.storage_company_id(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "evidence files: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and public.has_company_role(public.storage_company_id(name), 'viewer'));
create policy "evidence files: editors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and public.has_company_role(public.storage_company_id(name), 'editor'));
create policy "evidence files: editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and public.has_company_role(public.storage_company_id(name), 'editor'));
