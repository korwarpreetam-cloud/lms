-- =====================================================================
-- 00005_rls_policies.sql
-- Purpose: Row-level security for every table. This is the REAL
--          authorization boundary -- it holds even if frontend code is
--          buggy, bypassed via devtools, or a raw API call is crafted
--          by hand. Policies are written against JWT claims (fast,
--          no extra queries) with fallback to direct membership checks
--          only where the JWT's active_org_id isn't the right scope
--          (e.g. an owner inspecting an org they're not "active" in).
--
-- GENERAL PATTERN PER TABLE:
--   SELECT: must have ANY active membership in that row's org
--           (has_membership_in_org), not just be in their active org --
--           multi-org users can view orgs they belong to without
--           switching context for every read.
--   INSERT/UPDATE/DELETE: must be admin-tier (owner/core_team) OR the
--           specific role the action requires, scoped to active_org_id
--           specifically (mutations always act on your CURRENT context,
--           preventing "I'm a member of Org B but my session says
--           Org A" mutation confusion).
-- =====================================================================

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.roles enable row level security; -- read-only catalog, no force needed beyond select
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.courses enable row level security;
alter table public.courses force row level security;
alter table public.cohorts enable row level security;
alter table public.cohorts force row level security;
alter table public.student_profiles enable row level security;
alter table public.student_profiles force row level security;
alter table public.cohort_students enable row level security;
alter table public.cohort_students force row level security;
alter table public.cohort_trainers enable row level security;
alter table public.cohort_trainers force row level security;

revoke all on public.organizations, public.roles, public.users, public.organization_memberships,
  public.courses, public.cohorts, public.student_profiles, public.cohort_students, public.cohort_trainers
  from anon, authenticated;

grant all on public.organizations, public.roles, public.users, public.organization_memberships,
  public.courses, public.cohorts, public.student_profiles, public.cohort_students, public.cohort_trainers
  to service_role;

-- anon gets NOTHING beyond the auth flow itself (no anonymous browsing
-- of any LMS data -- this system has no public-facing surface, unlike
-- the hotel review app).

-- roles catalog: any authenticated user can read it (needed for UI
-- dropdowns/labels), nobody can write it from the API.
grant select on public.roles to authenticated;
create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- USERS
-- A user can read/update their OWN row. Admin-tier users can read any
-- user row that shares at least one org membership with them (so an
-- owner can see a trainer's name/email, but not a stranger from an
-- unrelated org with zero overlap).
-- ---------------------------------------------------------------------
grant select, update (full_name, phone, avatar_url) on public.users to authenticated;

create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_select_same_org_admin on public.users
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.user_id = public.users.id
        and m.status = 'active'
        and public.is_admin_in_org(m.organization_id)
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- ORGANIZATIONS
-- Visible to any user with an active membership in that org.
-- Mutations restricted to service_role only (you create/edit schools
-- directly -- matches "admin creates accounts directly" model).
-- ---------------------------------------------------------------------
grant select on public.organizations to authenticated;

create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.has_membership_in_org(id));

-- ---------------------------------------------------------------------
-- ORGANIZATION_MEMBERSHIPS
-- A user can see their OWN membership rows (needed for the org-switcher
-- UI to list "which orgs am I in"). Admin-tier users can see/manage all
-- membership rows for orgs they admin.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.organization_memberships to authenticated;

create policy memberships_select_self on public.organization_memberships
  for select to authenticated
  using (user_id = auth.uid());

create policy memberships_select_admin on public.organization_memberships
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy memberships_insert_admin on public.organization_memberships
  for insert to authenticated
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
    and public.session_is_mfa()  -- granting roles is privileged: require MFA step-up
  );

create policy memberships_update_admin on public.organization_memberships
  for update to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
    and public.session_is_mfa()
  );

-- No delete policy at all: memberships are revoked (status update), never
-- hard-deleted, to preserve audit history. Absence of a DELETE policy
-- means delete is denied outright for authenticated, even though we
-- granted the privilege above (RLS still gates it -- the grant alone is
-- not sufficient without a matching policy).

-- ---------------------------------------------------------------------
-- COURSES
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.courses to authenticated;

create policy courses_select_member on public.courses
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy courses_write_admin on public.courses
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- ---------------------------------------------------------------------
-- COHORTS
-- Read: any member of the org. Write: admin-tier only, scoped to
-- active_org_id (trainers can be assigned to teach, but cannot create
-- or edit cohort records themselves in this model -- adjust if you
-- want trainers to self-manage their own cohort details later).
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.cohorts to authenticated;

create policy cohorts_select_member on public.cohorts
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy cohorts_write_admin on public.cohorts
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- ---------------------------------------------------------------------
-- STUDENT_PROFILES
-- A student can read/update limited fields on their OWN profile.
-- Trainers can read profiles of students in cohorts they teach (not
-- the whole org's student roster -- scoped to their actual classes).
-- Admin-tier can read/write all profiles in their org.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.student_profiles to authenticated;
grant update (branch, guardian_name, guardian_phone, metadata) on public.student_profiles to authenticated;

create policy student_profiles_select_self on public.student_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy student_profiles_select_trainer on public.student_profiles
  for select to authenticated
  using (public.is_trainer_for_student_profile(id));

create policy student_profiles_select_admin on public.student_profiles
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy student_profiles_write_admin on public.student_profiles
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- ---------------------------------------------------------------------
-- COHORT_STUDENTS (enrollment)
-- Student sees their own enrollment rows. Trainer sees enrollments for
-- cohorts they teach. Admin-tier manages all enrollments in their org.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.cohort_students to authenticated;

create policy cohort_students_select_self on public.cohort_students
  for select to authenticated
  using (public.is_own_student_profile(student_profile_id));

create policy cohort_students_select_trainer on public.cohort_students
  for select to authenticated
  using (public.is_trainer_for_cohort(cohort_id));

create policy cohort_students_select_admin on public.cohort_students
  for select to authenticated
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_students.cohort_id
        and public.is_admin_in_org(c.organization_id)
    )
  );

create policy cohort_students_write_trainer on public.cohort_students
  for all to authenticated
  using (public.is_trainer_for_cohort(cohort_id))
  with check (public.is_trainer_for_cohort(cohort_id));

create policy cohort_students_write_admin on public.cohort_students
  for all to authenticated
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_students.cohort_id
        and public.is_admin_in_org(c.organization_id)
        and c.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_students.cohort_id
        and public.is_admin_in_org(c.organization_id)
        and c.organization_id = public.active_org_id()
    )
  );

-- ---------------------------------------------------------------------
-- COHORT_TRAINERS (teaching assignment)
-- A trainer sees their OWN assignment rows. Admin-tier manages all.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.cohort_trainers to authenticated;

create policy cohort_trainers_select_self on public.cohort_trainers
  for select to authenticated
  using (public.owns_membership(membership_id));

create policy cohort_trainers_select_admin on public.cohort_trainers
  for select to authenticated
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_trainers.cohort_id
        and public.is_admin_in_org(c.organization_id)
    )
  );

create policy cohort_trainers_write_admin on public.cohort_trainers
  for all to authenticated
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_trainers.cohort_id
        and public.is_admin_in_org(c.organization_id)
        and c.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.cohorts c
      where c.id = public.cohort_trainers.cohort_id
        and public.is_admin_in_org(c.organization_id)
        and c.organization_id = public.active_org_id()
    )
  );
