-- Row Level Security tests for Cobalance.
-- Run in the Supabase SQL editor AFTER applying the migrations. Everything runs
-- in one transaction and is rolled back: no users or data are left behind.
-- Success: the last query returns "ALL RLS TESTS PASSED".
-- Failure: the script stops with an error starting "FAIL:".
--
-- Users:  A = owner of company A · B = outsider (owns company B) · C = viewer in company A

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test', '{"full_name":"RLS A"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test', '{"full_name":"RLS B"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@example.test', '{"full_name":"RLS C"}', now(), now());

do $$ begin
  if (select count(*) from public.profiles where id in ('00000000-0000-4000-8000-00000000000a',
      '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c')) <> 3 then
    raise exception 'FAIL: signup trigger did not create profiles';
  end if;
end $$;

-- ════════ Act as A: set up company A ════════
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  cid uuid := public.create_company('RLS Test A', 'Other manufacturing', '1–10 employees', 'India', 'Maharashtra', 'Pune', '', false);
  fid uuid; aid uuid; act uuid; rid uuid;
begin
  insert into public.facilities (company_id, name, production_unit) values (cid, 'Plant A', 'kg') returning id into fid;
  insert into public.carbon_assessments (company_id, label, start_date, end_date, methodology_version)
    values (cid, 'FY 2025-26', '2025-04-01', '2026-03-31', 'test') returning id into aid;
  insert into public.emission_activities (company_id, facility_id, assessment_id, category, subtype, activity_date,
                                          quantity, unit, data_quality, data_source, created_by)
    values (cid, fid, aid, 'purchased_electricity', 'grid', '2025-04-01', 100, 'kWh', 'measured', 'manual', auth.uid())
    returning id into act;
  rid := public.save_calculation_run(cid, aid, '1.0.0', 'test', 'completed', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'activityId', act, 'scope', 2, 'category', 'purchased_electricity', 'subtype', 'grid', 'status', 'calculated',
      'inputQuantity', 100, 'inputUnit', 'kWh', 'normalizedQuantity', 100, 'normalizedUnit', 'kWh', 'emissionsKgCo2e', 72.7,
      'factor', jsonb_build_object('factorId', md5('cobalance-library:CEA-S2-GRID-IN-FY2024:v20.0')::uuid,
                                   'factorCode', 'CEA-S2-GRID-IN-FY2024', 'version', 'v20.0', 'sourceName', 'CEA'))));
  insert into public.company_members (company_id, user_id, role) values (cid, '00000000-0000-4000-8000-00000000000c', 'viewer');
  perform set_config('test.company_a', cid::text, true);
  perform set_config('test.facility_a', fid::text, true);
  perform set_config('test.assessment_a', aid::text, true);
  perform set_config('test.activity_a', act::text, true);
  perform set_config('test.run_a', rid::text, true);
  if (select factor_code from public.calculation_results where run_id = rid) <> 'CEA-S2-GRID-IN-FY2024' then
    raise exception 'FAIL: calculation result did not store the factor used';
  end if;
  raise notice 'PASS setup: owner A created company, facility, assessment, activity and a calculation run';
end $$;

-- A: owner protections and append-only history
do $$
declare cid uuid := current_setting('test.company_a')::uuid; n int;
begin
  begin
    update public.calculation_runs set status = 'completed' where id = current_setting('test.run_a')::uuid;
    raise exception 'FAIL: calculation runs are editable';
  exception when insufficient_privilege then raise notice 'PASS calculation runs are append-only';
  end;
  begin
    delete from public.calculation_results where run_id = current_setting('test.run_a')::uuid;
    raise exception 'FAIL: calculation results are deletable';
  exception when insufficient_privilege then raise notice 'PASS calculation results cannot be deleted';
  end;
  begin
    insert into public.calculation_results (run_id, company_id, source_activity_id, category, subtype, status, input_unit, emissions_kg_co2e)
      values (current_setting('test.run_a')::uuid, cid, gen_random_uuid(), 'refrigerants', 'R-32', 'awaiting_factor', 'kg', 0);
    raise exception 'FAIL: a result without a factor was stored as zero';
  exception when check_violation then raise notice 'PASS missing factors cannot be stored as zero emissions';
  end;
  begin
    insert into public.audit_events (company_id, action, entity_type) values (cid, 'x', 'x');
    raise exception 'FAIL: clients can forge audit events';
  exception when insufficient_privilege then raise notice 'PASS audit events cannot be written by clients';
  end;
  begin
    update public.companies set is_sample = true where id = cid;
    raise exception 'FAIL: is_sample is editable';
  exception when insufficient_privilege then raise notice 'PASS sample flag cannot be changed';
  end;
  begin
    delete from public.company_members where company_id = cid and user_id = auth.uid();
    raise exception 'FAIL: the only owner could leave';
  exception when insufficient_privilege then raise notice 'PASS a company keeps at least one owner';
  end;
  select count(*) into n from public.audit_events where company_id = cid;
  if n = 0 then raise exception 'FAIL: no audit events recorded'; end if;
  raise notice 'PASS % audit events recorded for company A', n;
end $$;

-- ════════ Act as B: an outsider ════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  cid uuid := current_setting('test.company_a')::uuid;
  own uuid; aid uuid; n int;
begin
  if (select count(*) from public.companies where id = cid) <> 0 then raise exception 'FAIL: B can read company A'; end if;
  if (select count(*) from public.facilities where company_id = cid) <> 0 then raise exception 'FAIL: B can read A facilities'; end if;
  if (select count(*) from public.carbon_assessments where company_id = cid) <> 0 then raise exception 'FAIL: B can read A assessments'; end if;
  if (select count(*) from public.emission_activities where company_id = cid) <> 0 then raise exception 'FAIL: B can read A activities'; end if;
  if (select count(*) from public.calculation_runs where company_id = cid) <> 0 then raise exception 'FAIL: B can read A runs'; end if;
  if (select count(*) from public.calculation_results where company_id = cid) <> 0 then raise exception 'FAIL: B can read A results'; end if;
  if (select count(*) from public.company_members where company_id = cid) <> 0 then raise exception 'FAIL: B can read A members'; end if;
  if (select count(*) from public.audit_events where company_id = cid) <> 0 then raise exception 'FAIL: B can read A audit'; end if;
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a') <> 0 then raise exception 'FAIL: B can read A profile'; end if;
  raise notice 'PASS outsider sees none of company A''s rows';

  update public.emission_activities set quantity = 999 where id = current_setting('test.activity_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A activity'; end if;
  delete from public.facilities where company_id = cid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A facility'; end if;
  delete from public.companies where id = cid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted company A'; end if;
  raise notice 'PASS outsider cannot update or delete company A''s rows';

  begin
    insert into public.emission_activities (company_id, facility_id, assessment_id, category, subtype, activity_date,
                                            quantity, unit, data_quality, data_source, created_by)
      values (cid, current_setting('test.facility_a')::uuid, current_setting('test.assessment_a')::uuid,
              'purchased_electricity', 'grid', '2025-05-01', 1, 'kWh', 'measured', 'manual', auth.uid());
    raise exception 'FAIL: B inserted into company A';
  exception when insufficient_privilege then raise notice 'PASS outsider cannot insert into company A';
  end;
  begin
    insert into public.company_members (company_id, user_id, role) values (cid, auth.uid(), 'owner');
    raise exception 'FAIL: B joined company A';
  exception when insufficient_privilege then raise notice 'PASS outsider cannot add themselves to company A';
  end;
  begin
    perform public.save_calculation_run(cid, current_setting('test.assessment_a')::uuid, '1', 'x', 'completed',
                                        '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: B saved a run for company A';
  exception when insufficient_privilege then raise notice 'PASS outsider cannot save calculation runs for company A';
  end;

  -- B's own company cannot point at A's facility or assessment.
  own := public.create_company('RLS Test B', 'Other manufacturing', '1–10 employees', 'India', 'Gujarat', 'Surat', '', false);
  insert into public.carbon_assessments (company_id, label, start_date, end_date, methodology_version)
    values (own, 'FY B', '2025-04-01', '2026-03-31', 'test') returning id into aid;
  begin
    insert into public.emission_activities (company_id, facility_id, assessment_id, category, subtype, activity_date,
                                            quantity, unit, data_quality, data_source, created_by)
      values (own, current_setting('test.facility_a')::uuid, aid, 'purchased_electricity', 'grid', '2025-05-01', 1, 'kWh',
              'measured', 'manual', auth.uid());
    raise exception 'FAIL: B referenced A''s facility';
  exception when foreign_key_violation then raise notice 'PASS cross-company references are rejected';
  end;

  -- Shared factor library: readable, never writable.
  if (select count(*) from public.emission_factors where company_id is null) = 0 then raise exception 'FAIL: library factors not readable'; end if;
  update public.emission_factors set review_status = 'retired' where company_id is null;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B retired a library factor'; end if;
  begin
    delete from public.emission_factors where company_id is null;
    raise exception 'FAIL: B deleted library factors';
  exception when insufficient_privilege then raise notice 'PASS shared factor library is read-only';
  end;
  begin
    insert into public.emission_factors (company_id, factor_code, category, subtype, activity_unit, components, factor_unit,
      geography, valid_from, publication_year, source_name, version, gwp_reference, review_status, origin)
      values (cid, 'EVIL', 'refrigerants', 'R-32', 'kg', '[{"gas":"CO2e","kgPerUnit":0}]', 'kg CO2e / kg', 'IN',
              '2020-01-01', 2024, 'x', 'v1', 'n/a', 'approved', 'user');
    raise exception 'FAIL: B added a factor to company A';
  exception when insufficient_privilege then raise notice 'PASS outsider cannot add factors to company A';
  end;
end $$;

-- ════════ Act as C: viewer in company A ════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare cid uuid := current_setting('test.company_a')::uuid; n int;
begin
  if (select count(*) from public.emission_activities where company_id = cid) <> 1 then raise exception 'FAIL: viewer cannot read A activities'; end if;
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a') <> 1 then raise exception 'FAIL: viewer cannot see co-member profile'; end if;
  raise notice 'PASS viewer reads company A';
  update public.emission_activities set quantity = 1 where company_id = cid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: viewer edited activities'; end if;
  begin
    insert into public.facilities (company_id, name, production_unit) values (cid, 'Viewer plant', 'kg');
    raise exception 'FAIL: viewer added a facility';
  exception when insufficient_privilege then raise notice 'PASS viewer cannot write data';
  end;
  begin
    update public.company_members set role = 'owner' where company_id = cid and user_id = auth.uid();
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: viewer promoted themselves'; end if;
    raise notice 'PASS viewer cannot change roles';
  end;
  begin
    insert into public.reports (company_id, assessment_id, calculation_run_id, report_type, status, file_name, created_by)
      values (cid, current_setting('test.assessment_a')::uuid, current_setting('test.run_a')::uuid, 'pdf', 'reviewed_internally', 'x.pdf', auth.uid());
    raise exception 'FAIL: a report was created as reviewed';
  exception when insufficient_privilege then raise notice 'PASS new reports can only start as Draft';
  end;
end $$;

-- ════════ Anonymous visitor ════════
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  begin
    perform 1 from public.companies limit 1;
    raise exception 'FAIL: anonymous users can query companies';
  exception when insufficient_privilege then raise notice 'PASS anonymous users have no table access';
  end;
end $$;

select 'ALL RLS TESTS PASSED' as result;

rollback;
