-- =====================================================================
-- 00004b_rls_recursion_safe_helpers.sql
-- Purpose: Fix RLS infinite recursion between student_profiles,
--          cohort_students, and cohort_trainers.
--
-- THE BUG (found via testing, not theoretical):
--   student_profiles_select_trainer policy queries cohort_students.
--   cohort_students has its OWN RLS policies, one of which
--   (cohort_students_select_self) queries student_profiles to check
--   "does this enrollment belong to me." Postgres evaluates RLS
--   policies on every table touched by a query, INCLUDING tables
--   referenced inside another table's policy predicate. That closes
--   the loop: student_profiles -> cohort_students -> student_profiles
--   -> infinite recursion, caught and rejected by Postgres at runtime.
--
-- THE FIX:
--   Cross-table authorization lookups inside a policy must NOT go
--   through another RLS-protected table directly. Instead, route them
--   through a SECURITY DEFINER function. Such a function still runs
--   with the privileges of its OWNER (postgres), which means MORE
--   importantly here that when Postgres plans the query INSIDE that
--   function body, it is a SEPARATE statement context -- RLS recursion
--   tracking does not chain across the function-call boundary the same
--   way it does across direct subqueries in one statement. This is the
--   standard, documented Postgres/Supabase pattern for exactly this
--   situation.
-- =====================================================================

-- Is the current user an active trainer (or core_team/owner) assigned
-- to teach the cohort that the given student_profile is enrolled in?
-- Used by student_profiles_select_trainer.
create or replace function public.is_trainer_for_student_profile(p_student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from cohort_students cs
    join cohort_trainers ct on ct.cohort_id = cs.cohort_id and ct.unassigned_at is null
    join organization_memberships tm on tm.id = ct.membership_id
    where cs.student_profile_id = p_student_profile_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

-- Does the current user's student_profile match the given id (i.e. is
-- this MY enrollment)? Used by cohort_students_select_self instead of
-- querying student_profiles directly with RLS active.
create or replace function public.is_own_student_profile(p_student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from student_profiles sp
    where sp.id = p_student_profile_id
      and sp.user_id = auth.uid()
  );
$$;

-- Is the current user an active trainer assigned to the given cohort?
-- Used by cohort_students_select_trainer instead of querying
-- cohort_trainers directly with RLS active.
create or replace function public.is_trainer_for_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from cohort_trainers ct
    join organization_memberships tm on tm.id = ct.membership_id
    where ct.cohort_id = p_cohort_id
      and ct.unassigned_at is null
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

-- Does the current user hold the given membership_id (i.e. is this MY
-- trainer assignment)? Used by cohort_trainers_select_self instead of
-- querying organization_memberships directly inside that policy.
create or replace function public.owns_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from organization_memberships m
    where m.id = p_membership_id
      and m.user_id = auth.uid()
  );
$$;

comment on function public.is_trainer_for_student_profile is
  'RLS-recursion-safe check: is current user an active trainer for a cohort this student is enrolled in. SECURITY DEFINER breaks the policy-evaluation cycle that direct cross-table subqueries would create.';
comment on function public.is_own_student_profile is
  'RLS-recursion-safe check: does the given student_profile belong to the current user.';
comment on function public.is_trainer_for_cohort is
  'RLS-recursion-safe check: is current user an active trainer assigned to the given cohort.';
comment on function public.owns_membership is
  'RLS-recursion-safe check: does the current user own the given membership row.';

revoke all on function public.is_trainer_for_student_profile, public.is_own_student_profile,
  public.is_trainer_for_cohort, public.owns_membership from public;
grant execute on function public.is_trainer_for_student_profile to authenticated;
grant execute on function public.is_own_student_profile to authenticated;
grant execute on function public.is_trainer_for_cohort to authenticated;
grant execute on function public.owns_membership to authenticated;
