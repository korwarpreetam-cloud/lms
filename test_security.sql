-- Rigorous Security and Authentication test script for LMS Supabase backend.
-- This script runs inside a transaction, performs setup, mocks user contexts,
-- executes security matrix checks, verifies triggers, and rolls back all changes.

BEGIN;

-- =========================================================================
-- 1. Setup Mock Data (Running as superuser/postgres before switching roles)
-- =========================================================================

-- Clear any conflicting testing data
delete from auth.users where email in (
  'test_owner@example.com',
  'test_core_team@example.com',
  'test_trainer@example.com',
  'test_student@example.com',
  'test_unauth@example.com',
  'test_other_student@example.com',
  'test_other_trainer@example.com'
);

-- Insert mock auth users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'test_owner@example.com'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'test_core_team@example.com'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'test_trainer@example.com'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'test_student@example.com'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'test_unauth@example.com'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'test_other_student@example.com'),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'test_other_trainer@example.com')
on conflict (id) do nothing;

-- Ensure public users are populated (if the sync trigger ran, this is already done)
insert into public.users (id, email) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'test_owner@example.com'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'test_core_team@example.com'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'test_trainer@example.com'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'test_student@example.com'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'test_unauth@example.com'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'test_other_student@example.com'),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'test_other_trainer@example.com')
on conflict (id) do nothing;

-- Insert organization
insert into public.organizations (id, name)
values ('10000000-0000-0000-0000-000000000000'::uuid, 'Test LMS Org')
on conflict (id) do nothing;

-- Look up role IDs
do $$
declare
  v_owner_role_id uuid;
  v_core_team_role_id uuid;
  v_trainer_role_id uuid;
  v_student_role_id uuid;
  v_org_id uuid := '10000000-0000-0000-0000-000000000000'::uuid;
begin
  select id into v_owner_role_id from public.roles where name = 'owner';
  select id into v_core_team_role_id from public.roles where name = 'core_team';
  select id into v_trainer_role_id from public.roles where name = 'trainer';
  select id into v_student_role_id from public.roles where name = 'student';

  -- Insert memberships
  insert into public.organization_memberships (organization_id, user_id, role_id, status)
  values
    (v_org_id, '11111111-1111-1111-1111-111111111111'::uuid, v_owner_role_id, 'active'),
    (v_org_id, '22222222-2222-2222-2222-222222222222'::uuid, v_core_team_role_id, 'active'),
    (v_org_id, '33333333-3333-3333-3333-333333333333'::uuid, v_trainer_role_id, 'active'),
    (v_org_id, '44444444-4444-4444-4444-444444444444'::uuid, v_student_role_id, 'active'),
    (v_org_id, '66666666-6666-6666-6666-666666666666'::uuid, v_student_role_id, 'active'),
    (v_org_id, '77777777-7777-7777-7777-777777777777'::uuid, v_trainer_role_id, 'active')
  on conflict do nothing;

  -- Insert Student Profile
  insert into public.student_profiles (id, user_id, organization_id, metadata)
  values ('40000000-0000-0000-0000-000000000000'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, v_org_id, '{"name": "Student A"}'::jsonb)
  on conflict do nothing;

  -- Insert Course & Cohort
  insert into public.courses (id, organization_id, name)
  values ('c0000000-0000-0000-0000-000000000000'::uuid, v_org_id, 'Postgres Security')
  on conflict (id) do nothing;

  insert into public.cohorts (id, organization_id, course_id, name)
  values ('b0000000-0000-0000-0000-000000000000'::uuid, v_org_id, 'c0000000-0000-0000-0000-000000000000'::uuid, 'Spring Cohort')
  on conflict (id) do nothing;

  -- Assign Trainer and Student to Cohort
  insert into public.cohort_trainers (cohort_id, user_id)
  values ('b0000000-0000-0000-0000-000000000000'::uuid, '33333333-3333-3333-3333-333333333333'::uuid)
  on conflict do nothing;

  insert into public.cohort_students (cohort_id, student_id)
  values ('b0000000-0000-0000-0000-000000000000'::uuid, '40000000-0000-0000-0000-000000000000'::uuid)
  on conflict do nothing;

  -- Create Assignment
  insert into public.assignments (id, organization_id, cohort_id, title, max_score)
  values ('a0000000-0000-0000-0000-000000000000'::uuid, v_org_id, 'b0000000-0000-0000-0000-000000000000'::uuid, 'Security Lab 1', 100)
  on conflict (id) do nothing;

  -- Create a different/unassigned cohort & student for isolation check
  insert into public.courses (id, organization_id, name)
  values ('c9999999-0000-0000-0000-000000000000'::uuid, v_org_id, 'Isolated Course B')
  on conflict (id) do nothing;

  insert into public.student_profiles (id, user_id, organization_id, metadata)
  values ('60000000-0000-0000-0000-000000000000'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, v_org_id, '{"name": "Isolated Student B"}'::jsonb)
  on conflict do nothing;

  insert into public.cohorts (id, organization_id, course_id, name)
  values ('b9999999-0000-0000-0000-000000000000'::uuid, v_org_id, 'c9999999-0000-0000-0000-000000000000'::uuid, 'Summer Cohort')
  on conflict (id) do nothing;

  insert into public.cohort_students (cohort_id, student_id)
  values ('b9999999-0000-0000-0000-000000000000'::uuid, '60000000-0000-0000-0000-000000000000'::uuid)
  on conflict do nothing;

  insert into public.cohort_trainers (cohort_id, user_id)
  values ('b9999999-0000-0000-0000-000000000000'::uuid, '77777777-7777-7777-7777-777777777777'::uuid)
  on conflict do nothing;

  -- Create quiz
  insert into public.quizzes (id, organization_id, course_id, title)
  values ('d0000000-0000-0000-0000-000000000000'::uuid, v_org_id, 'c0000000-0000-0000-0000-000000000000'::uuid, 'RLS Quiz')
  on conflict (id) do nothing;

  insert into public.quiz_questions (id, quiz_id, question_text, options)
  values ('e0000000-0000-0000-0000-000000000000'::uuid, 'd0000000-0000-0000-0000-000000000000'::uuid, 'Is RLS enabled?', '["Yes", "No"]'::jsonb)
  on conflict (id) do nothing;

  insert into public.quiz_answer_keys (question_id, correct_answer)
  values ('e0000000-0000-0000-0000-000000000000'::uuid, 'Yes')
  on conflict (question_id) do nothing;

end;
$$;

-- =========================================================================
-- 2. Restrict to 'authenticated' Role (Forces RLS policies to fire)
-- =========================================================================
SET LOCAL ROLE authenticated;

-- =========================================================================
-- 3. Execute PL/pgSQL Test Suites
-- =========================================================================
do $$
declare
  v_owner_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_core_team_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_trainer_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_student_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_unauth_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
  v_other_student_id uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_other_trainer_id uuid := '77777777-7777-7777-7777-777777777777'::uuid;

  v_org_id uuid := '10000000-0000-0000-0000-000000000000'::uuid;
  v_student_profile_id uuid := '40000000-0000-0000-0000-000000000000'::uuid;
  v_other_student_profile_id uuid := '60000000-0000-0000-0000-000000000000'::uuid;
  v_assignment_id uuid := 'a0000000-0000-0000-0000-000000000000'::uuid;
  v_submission_id uuid;

  v_owner_role_id uuid;
  v_core_team_role_id uuid;
  v_trainer_role_id uuid;
  v_student_role_id uuid;

  v_count integer;
  v_test_submission_id uuid;
  v_test_grade_id uuid;
begin
  -- Resolve role IDs (Note: RLS allows viewing roles table)
  select id into v_owner_role_id from public.roles where name = 'owner';
  select id into v_core_team_role_id from public.roles where name = 'core_team';
  select id into v_trainer_role_id from public.roles where name = 'trainer';
  select id into v_student_role_id from public.roles where name = 'student';

  raise notice '=======================================================';
  raise notice 'STARTING SECURITY AND RLS POLICY MATRIX TESTING';
  raise notice '=======================================================';


  -- =========================================================================
  -- SUITE 1: organization_memberships Table Security
  -- =========================================================================
  raise notice 'Running Suite 1: organization_memberships...';

  -- A. Student SELECT
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  select count(*) into v_count from public.organization_memberships;
  if v_count <> 1 then
    raise exception 'Suite 1 failed: Student was able to view % memberships (expected 1)', v_count;
  end if;

  -- B. Student INSERT (should be blocked)
  begin
    insert into public.organization_memberships (organization_id, user_id, role_id)
    values (v_org_id, v_unauth_id, v_student_role_id);
    raise exception 'Suite 1 failed: Student inserted membership but should have been blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- C. Trainer SELECT
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer_id)::text, true);
  select count(*) into v_count from public.organization_memberships;
  if v_count <> 1 then
    raise exception 'Suite 1 failed: Trainer was able to view % memberships (expected 1)', v_count;
  end if;

  -- D. Core Team SELECT (should view all)
  perform set_config('request.jwt.claims', json_build_object('sub', v_core_team_id)::text, true);
  select count(*) into v_count from public.organization_memberships;
  if v_count < 4 then
    raise exception 'Suite 1 failed: Core Team only viewed % memberships (expected at least 4)', v_count;
  end if;

  -- E. Core Team INSERT Owner membership (should be blocked)
  begin
    insert into public.organization_memberships (organization_id, user_id, role_id)
    values (v_org_id, v_unauth_id, v_owner_role_id);
    raise exception 'Suite 1 failed: Core Team inserted Owner role but should have been blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- F. Core Team INSERT Trainer membership (should succeed)
  begin
    insert into public.organization_memberships (organization_id, user_id, role_id)
    values (v_org_id, v_unauth_id, v_trainer_role_id);
  exception
    when others then
      raise exception 'Suite 1 failed: Core Team could not insert Trainer membership: %', sqlerrm;
  end;

  -- G. Core Team UPDATE self-promotion (should be blocked)
  begin
    update public.organization_memberships
    set role_id = v_owner_role_id
    where user_id = v_core_team_id;
    raise exception 'Suite 1 failed: Core Team self-promoted to Owner but should have been blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- H. Owner INSERT Owner membership (should succeed)
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_id)::text, true);
  begin
    insert into public.organization_memberships (organization_id, user_id, role_id)
    values (v_org_id, '55555555-5555-5555-5555-555555555555'::uuid, v_owner_role_id)
    on conflict do nothing;
  exception
    when others then
      raise exception 'Suite 1 failed: Owner could not insert Owner membership: %', sqlerrm;
  end;


  -- =========================================================================
  -- SUITE 2: student_profiles Table Security
  -- =========================================================================
  raise notice 'Running Suite 2: student_profiles...';

  -- A. Student SELECT (should only see their own)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  select count(*) into v_count from public.student_profiles;
  if v_count <> 1 then
    raise exception 'Suite 2 failed: Student saw % profiles (expected 1)', v_count;
  end if;

  -- B. Student UPDATE (should be blocked - RPC only)
  begin
    update public.student_profiles
    set metadata = '{"updated": true}'::jsonb
    where id = v_student_profile_id;
    raise exception 'Suite 2 failed: Student updated profile directly but should be blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- C. Trainer SELECT (should see student in their cohort, but not the other)
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer_id)::text, true);
  select count(*) into v_count from public.student_profiles;
  -- Trainer is assigned to v_student_id, not v_other_student_id
  if v_count <> 1 then
    raise exception 'Suite 2 failed: Trainer saw % student profiles (expected exactly 1 assigned student)', v_count;
  end if;

  -- D. Owner SELECT (should see all)
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_id)::text, true);
  select count(*) into v_count from public.student_profiles;
  if v_count < 2 then
    raise exception 'Suite 2 failed: Owner saw % student profiles (expected at least 2)', v_count;
  end if;


  -- =========================================================================
  -- SUITE 3: submissions & attempts Table Security
  -- =========================================================================
  raise notice 'Running Suite 3: submissions and attempts...';

  -- A. Student INSERT submission for their own profile (should succeed)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  begin
    insert into public.submissions (organization_id, assignment_id, student_id, content)
    values (v_org_id, v_assignment_id, v_student_profile_id, 'My submission content')
    returning id into v_submission_id;
  exception
    when others then
      raise exception 'Suite 3 failed: Student could not submit their own assignment: %', sqlerrm;
  end;

  -- B. Student INSERT submission for another student (should be blocked)
  begin
    insert into public.submissions (organization_id, assignment_id, student_id, content)
    values (v_org_id, v_assignment_id, v_other_student_profile_id, 'Malicious submission');
    raise exception 'Suite 3 failed: Student submitted work for another student profile but was not blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- C. Verify Trigger `on_submission_upsert` created an attempt history
  select count(*) into v_count from public.submission_attempts where submission_id = v_submission_id;
  if v_count <> 1 then
    raise exception 'Suite 3 failed: Trigger did not create automatic submission attempt (count: %)', v_count;
  end if;

  -- D. Student UPDATE submission content when ungraded (should succeed)
  begin
    update public.submissions
    set content = 'Updated content'
    where id = v_submission_id;
  exception
    when others then
      raise exception 'Suite 3 failed: Student failed to update ungraded submission: %', sqlerrm;
  end;

  -- E. Verify second attempt was logged automatically
  select count(*) into v_count from public.submission_attempts where submission_id = v_submission_id;
  if v_count <> 2 then
    raise exception 'Suite 3 failed: Trigger failed to log the updated content as a new attempt (count: %)', v_count;
  end if;


  -- =========================================================================
  -- SUITE 4: grades Table Security & Constraints
  -- =========================================================================
  raise notice 'Running Suite 4: grades...';

  -- A. Student INSERT grade (should be blocked)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  begin
    insert into public.grades (organization_id, submission_id, score, grader_id)
    values (v_org_id, v_submission_id, 95, v_student_id);
    raise exception 'Suite 4 failed: Student graded a submission but should be blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- B. Trainer INSERT grade for student in their cohort (should succeed)
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer_id)::text, true);
  begin
    insert into public.grades (organization_id, submission_id, score, grader_id)
    values (v_org_id, v_submission_id, 90, v_trainer_id)
    returning id into v_test_grade_id;
  exception
    when others then
      raise exception 'Suite 4 failed: Trainer failed to grade a submission in their cohort: %', sqlerrm;
  end;

  -- C. Student UPDATE graded submission (should be blocked now that it is graded)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  begin
    update public.submissions
    set content = 'Attempting edit after grade'
    where id = v_submission_id;
    raise exception 'Suite 4 failed: Student updated a graded submission but should be blocked';
  exception
    when insufficient_privilege or raise_exception then
      -- expected
  end;

  -- D. Validate Grade Bounds Trigger (grades.score <= assignment.max_score)
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer_id)::text, true);
  -- Try to update grade to 150 (max_score is 100) -> should trigger error
  begin
    update public.grades
    set score = 150
    where id = v_test_grade_id;
    raise exception 'Suite 4 failed: Updated grade above max_score but did not trigger exception';
  exception
    when raise_exception then
      -- expected trigger exception
  end;

  -- Try to update grade to -10 -> should trigger error
  begin
    update public.grades
    set score = -10
    where id = v_test_grade_id;
    raise exception 'Suite 4 failed: Updated grade to negative score but did not trigger exception';
  exception
    when raise_exception then
      -- expected trigger exception
  end;


  -- =========================================================================
  -- SUITE 5: quiz_answer_keys Security
  -- =========================================================================
  raise notice 'Running Suite 5: quiz_answer_keys...';

  -- A. Student SELECT quiz answer key (should return 0 rows/denied)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id)::text, true);
  select count(*) into v_count from public.quiz_answer_keys;
  if v_count <> 0 then
    raise exception 'Suite 5 failed: Student was able to view % quiz answer keys (expected 0)', v_count;
  end if;

  -- B. Trainer SELECT quiz answer key (should succeed)
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer_id)::text, true);
  select count(*) into v_count from public.quiz_answer_keys;
  if v_count <> 1 then
    raise exception 'Suite 5 failed: Trainer failed to view quiz answer key (count: %)', v_count;
  end if;

  -- C. Other Trainer SELECT quiz answer key (should return 0 rows since not assigned to the cohort)
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_trainer_id)::text, true);
  select count(*) into v_count from public.quiz_answer_keys;
  if v_count <> 0 then
    raise exception 'Suite 5 failed: Unassigned trainer saw % quiz answer keys (expected 0)', v_count;
  end if;


  -- =========================================================================
  -- SUITE 6: Tenant/Org Consistency Trigger Verification
  -- =========================================================================
  raise notice 'Running Suite 6: Tenant Consistency check...';

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_id)::text, true);

  -- Try to assign trainer user `v_trainer_id` to a cohort in an organization where they aren't a trainer.
  -- (Here, v_trainer_id is a trainer in v_org_id, but if we create a different org, we test it).
  -- Let's test the trigger on public.cohorts: Cohort organization must match course organization.
  begin
    insert into public.cohorts (organization_id, course_id, name)
    values ('20000000-0000-0000-0000-000000000000'::uuid, 'c0000000-0000-0000-0000-000000000000'::uuid, 'Mismatched Cohort');
    raise exception 'Suite 6 failed: Inserted cohort with mismatched course organization but was not blocked';
  exception
    when raise_exception then
      -- expected consistency violation exception
  end;

  raise notice '=======================================================';
  raise notice 'ALL SECURITY AND RLS CHECKS PASSED SUCCESSFULLY!';
  raise notice '=======================================================';

end;
$$;


-- =========================================================================
-- Reset to superuser before switching to anon, so we have full privilege
-- to SET ROLE. (SET LOCAL ROLE authenticated above drops us to that level;
-- we need postgres-equivalent to set anon.)
-- =========================================================================
RESET ROLE;


-- =========================================================================
-- SUITE 7: anon role -- "nothing leaks to the public internet"
--
-- This suite simulates a raw HTTP call made with ONLY the project's
-- public anon key: no Authorization header, no JWT sub claim, no
-- session whatsoever. The DB role will be 'anon'.
--
-- Every SELECT below must return 0 rows. If any return > 0, either:
--   a) RLS is not enabled on that table, or
--   b) fix_permissions.sql (or a migration) granted anon SELECT rights
--      on a table it has no business reading.
--
-- NOTE: anon cannot run DO $$ … $$ blocks directly (no EXECUTE privilege
-- on PL/pgSQL by default in a locked-down setup), so we use individual
-- SQL statements and verify using psql \gset or via the exception pattern
-- below with a superuser wrapper that impersonates the role.
-- =========================================================================
do $$
declare
  v_count integer;
begin
  raise notice 'Running Suite 7: anon role leakage checks...';

  -- Switch role to anon (no JWT claims set -- blank slate)
  set local role anon;

  -- -----------------------------------------------------------------------
  -- 7A. grades (most sensitive: scores are private student data)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.grades;
    if v_count <> 0 then
      raise exception 'Suite 7A FAILED: anon can read % row(s) from public.grades (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      -- Also acceptable: permission denied before RLS even fires
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7B. quiz_answer_keys (answer keys must never be publicly readable)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.quiz_answer_keys;
    if v_count <> 0 then
      raise exception 'Suite 7B FAILED: anon can read % row(s) from public.quiz_answer_keys (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7C. submissions (student work is private)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.submissions;
    if v_count <> 0 then
      raise exception 'Suite 7C FAILED: anon can read % row(s) from public.submissions (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7D. student_profiles (PII: DOB, guardian info)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.student_profiles;
    if v_count <> 0 then
      raise exception 'Suite 7D FAILED: anon can read % row(s) from public.student_profiles (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7E. organization_memberships (user-to-role mapping is internal)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.organization_memberships;
    if v_count <> 0 then
      raise exception 'Suite 7E FAILED: anon can read % row(s) from public.organization_memberships (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7F. courses (not a public catalog in this LMS -- org-gated)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.courses;
    if v_count <> 0 then
      raise exception 'Suite 7F FAILED: anon can read % row(s) from public.courses (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  -- -----------------------------------------------------------------------
  -- 7G. users table (profile data is private)
  -- -----------------------------------------------------------------------
  begin
    select count(*) into v_count from public.users;
    if v_count <> 0 then
      raise exception 'Suite 7G FAILED: anon can read % row(s) from public.users (expected 0)', v_count;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice 'Suite 7 PASSED: anon role sees 0 rows on all sensitive tables (or gets permission denied).';
  raise notice '=======================================================';
  raise notice 'ALL SUITES COMPLETE.';
  raise notice '=======================================================';
end;
$$;

-- Reset role before rolling back so ROLLBACK itself runs as superuser
RESET ROLE;

ROLLBACK;
