-- =====================================================================
-- 00002_academic_structure.sql
-- Purpose: Courses, cohorts (class batches), student profiles, and the
--          join tables that answer "which school/class is this student
--          in" and "which classes does this trainer teach."
--
-- KEY DESIGN POINT: student_profiles and cohort_trainers are scoped to
-- a specific organization_membership, NOT directly to a user. This
-- matters because of multi-org: a user might be a student at School A
-- and a trainer at School B. Tying academic records to the membership
-- row (which already encodes user+org+role) prevents data from one
-- org's "hat" leaking into queries for the other.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COURSES
-- ---------------------------------------------------------------------
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_courses_org on public.courses (organization_id) where is_active = true;

create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- COHORTS (class batches)
-- ---------------------------------------------------------------------
create table public.cohorts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete restrict,
  name            text not null check (char_length(name) between 1 and 150),

  status          text not null default 'active'
                    check (status in ('upcoming', 'active', 'completed', 'archived')),

  start_date      date,
  end_date        date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint cohort_course_same_org check (true) -- enforced via trigger below (cross-table check)
);

create index idx_cohorts_org on public.cohorts (organization_id);
create index idx_cohorts_course on public.cohorts (course_id);
create index idx_cohorts_status on public.cohorts (organization_id, status);

create trigger trg_cohorts_updated_at
  before update on public.cohorts
  for each row execute function public.set_updated_at();

-- Trigger to ensure a cohort's course belongs to the same organization
-- (a CHECK constraint can't do cross-table lookups, so this is a trigger).
create or replace function public.enforce_cohort_course_same_org()
returns trigger
language plpgsql
as $$
declare
  v_course_org uuid;
begin
  select organization_id into v_course_org from public.courses where id = new.course_id;
  if v_course_org is null then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if v_course_org <> new.organization_id then
    raise exception 'COURSE_ORG_MISMATCH' using
      detail = 'Cohort organization_id must match its course organization_id.';
  end if;
  return new;
end;
$$;

create trigger trg_cohorts_course_org_check
  before insert or update on public.cohorts
  for each row execute function public.enforce_cohort_course_same_org();

-- ---------------------------------------------------------------------
-- STUDENT_PROFILES
-- One per (user, organization) -- a student's record at a SPECIFIC
-- school. Tied to the organization_membership row directly so role and
-- profile can never drift apart (e.g. profile existing for a membership
-- that was revoked).
-- ---------------------------------------------------------------------
create table public.student_profiles (
  id              uuid primary key default gen_random_uuid(),
  membership_id   uuid not null unique references public.organization_memberships(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  branch          text,        -- e.g. "East Campus" -- promoted to a real column,
                                -- not buried in jsonb, since you'll filter on it
  date_of_birth   date,
  guardian_name   text,
  guardian_phone  text,
  metadata        jsonb not null default '{}'::jsonb, -- truly miscellaneous extras only

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.student_profiles is
  'One record per student-membership (user+org). branch is a real column because you will filter/report on it; metadata is for genuinely unstructured extras only.';

create index idx_student_profiles_org on public.student_profiles (organization_id);
create index idx_student_profiles_user on public.student_profiles (user_id);
create index idx_student_profiles_branch on public.student_profiles (organization_id, branch);

create trigger trg_student_profiles_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

-- Enforce: the membership backing a student_profile must actually be a
-- 'student' role membership, and organization_id/user_id must match it.
create or replace function public.enforce_student_profile_membership_consistency()
returns trigger
language plpgsql
as $$
declare
  v_membership public.organization_memberships%rowtype;
  v_role_code text;
begin
  select * into v_membership from public.organization_memberships where id = new.membership_id;

  if v_membership.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  if v_membership.user_id <> new.user_id or v_membership.organization_id <> new.organization_id then
    raise exception 'MEMBERSHIP_MISMATCH' using
      detail = 'student_profiles.user_id/organization_id must match the referenced membership row exactly.';
  end if;

  select code into v_role_code from public.roles where id = v_membership.role_id;
  if v_role_code <> 'student' then
    raise exception 'MEMBERSHIP_NOT_STUDENT_ROLE' using
      detail = 'student_profiles can only be linked to a membership with role = student.';
  end if;

  return new;
end;
$$;

create trigger trg_student_profile_membership_check
  before insert or update on public.student_profiles
  for each row execute function public.enforce_student_profile_membership_consistency();

-- ---------------------------------------------------------------------
-- COHORT_STUDENTS (enrollment)
-- ---------------------------------------------------------------------
create table public.cohort_students (
  id                  uuid primary key default gen_random_uuid(),
  cohort_id           uuid not null references public.cohorts(id) on delete cascade,
  student_profile_id  uuid not null references public.student_profiles(id) on delete cascade,

  status              text not null default 'enrolled'
                         check (status in ('enrolled', 'completed', 'withdrawn', 'transferred')),

  enrolled_at         timestamptz not null default now(),
  ended_at            timestamptz,
  end_reason          text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (cohort_id, student_profile_id)
);

create index idx_cohort_students_cohort on public.cohort_students (cohort_id) where status = 'enrolled';
create index idx_cohort_students_profile on public.cohort_students (student_profile_id) where status = 'enrolled';

create trigger trg_cohort_students_updated_at
  before update on public.cohort_students
  for each row execute function public.set_updated_at();

-- Cross-org guard: a student_profile's org must match the cohort's org.
create or replace function public.enforce_cohort_student_same_org()
returns trigger
language plpgsql
as $$
declare
  v_cohort_org uuid;
  v_profile_org uuid;
begin
  select organization_id into v_cohort_org from public.cohorts where id = new.cohort_id;
  select organization_id into v_profile_org from public.student_profiles where id = new.student_profile_id;

  if v_cohort_org is null or v_profile_org is null then
    raise exception 'COHORT_OR_PROFILE_NOT_FOUND';
  end if;

  if v_cohort_org <> v_profile_org then
    raise exception 'CROSS_ORG_ENROLLMENT_DENIED' using
      detail = 'Cannot enroll a student into a cohort belonging to a different organization.';
  end if;

  return new;
end;
$$;

create trigger trg_cohort_students_org_check
  before insert or update on public.cohort_students
  for each row execute function public.enforce_cohort_student_same_org();

-- ---------------------------------------------------------------------
-- COHORT_TRAINERS (teaching assignment)
-- Tied to the membership_id (not bare user_id) for the same reason as
-- student_profiles: a trainer's assignment is scoped to their trainer
-- "hat" at that specific org, never bleeding into a different org/role.
-- ---------------------------------------------------------------------
create table public.cohort_trainers (
  id              uuid primary key default gen_random_uuid(),
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  membership_id   uuid not null references public.organization_memberships(id) on delete cascade,

  is_lead         boolean not null default false, -- lead trainer vs. assistant

  assigned_at     timestamptz not null default now(),
  unassigned_at   timestamptz,

  created_at      timestamptz not null default now(),

  unique (cohort_id, membership_id)
);

create index idx_cohort_trainers_cohort on public.cohort_trainers (cohort_id) where unassigned_at is null;
create index idx_cohort_trainers_membership on public.cohort_trainers (membership_id) where unassigned_at is null;

-- Guard: the membership must be a 'trainer' role AND in the same org as the cohort.
create or replace function public.enforce_cohort_trainer_consistency()
returns trigger
language plpgsql
as $$
declare
  v_membership public.organization_memberships%rowtype;
  v_role_code text;
  v_cohort_org uuid;
begin
  select * into v_membership from public.organization_memberships where id = new.membership_id;
  if v_membership.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  select code into v_role_code from public.roles where id = v_membership.role_id;
  if v_role_code not in ('trainer', 'core_team', 'owner') then
    raise exception 'MEMBERSHIP_NOT_TRAINER_ELIGIBLE' using
      detail = 'Only trainer, core_team, or owner role memberships may be assigned to teach a cohort.';
  end if;

  select organization_id into v_cohort_org from public.cohorts where id = new.cohort_id;
  if v_cohort_org <> v_membership.organization_id then
    raise exception 'CROSS_ORG_TRAINER_ASSIGNMENT_DENIED';
  end if;

  return new;
end;
$$;

create trigger trg_cohort_trainers_consistency_check
  before insert or update on public.cohort_trainers
  for each row execute function public.enforce_cohort_trainer_consistency();
