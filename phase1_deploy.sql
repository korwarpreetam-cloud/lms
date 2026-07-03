-- RESET SCHEMA FOR CLEAN INSTALLATION
drop schema if exists public cascade;
create schema public;

-- Re-grant default permissions so Supabase works
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on schema public to postgres;
grant all privileges on schema public to service_role;
grant all privileges on schema public to public;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- =====================================================================
-- 00001_core_identity_schema.sql
-- Purpose: Foundation tables for identity, organizations, roles, and
--          multi-org membership. Everything else (RLS, JWT claims,
--          invites, MFA enforcement) builds on top of this.
--
-- DESIGN DECISIONS (read before extending):
--   - Multi-org is a first-class concept. There is NO "user.organization_id"
--     column anywhere. A user's relationship to orgs lives ENTIRELY in
--     organization_memberships (many-to-many, one row per org+role).
--   - "Active org" (which org a user is currently viewing/acting in) is
--     SESSION state, not identity state -- stored in a cookie/JWT claim
--     set at login or org-switch time, never inferred from a single
--     "default" column that would silently break multi-org support.
--   - Roles are a closed enum-like table (not free text) so RLS policies
--     can safely compare against known role codes without typos causing
--     silent authorization holes.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic trigger to auto-maintain updated_at timestamp on row update.';

-- ---------------------------------------------------------------------
-- ROLES
-- Closed catalog. Adding a new role is a deliberate migration, not a
-- runtime insert from app code -- this is intentional friction.
-- ---------------------------------------------------------------------
create table public.roles (
  id            smallint primary key,
  code          text not null unique check (code ~ '^[a-z_]+$'),
  label         text not null,
  -- Privilege rank purely for UI ordering / "is role A at least as
  -- powerful as role B" comparisons. NOT used as the sole authorization
  -- mechanism anywhere -- RLS policies check explicit role codes.
  rank          smallint not null unique
);

insert into public.roles (id, code, label, rank) values
  (1, 'owner',      'Owner',      100),
  (2, 'core_team',  'Core Team',  80),
  (3, 'trainer',     'Trainer',    50),
  (4, 'student',     'Student',    10);

comment on table public.roles is
  'Closed catalog of system roles. Modify only via migration, never via app-level insert.';

-- ---------------------------------------------------------------------
-- USERS (mirror of auth.users)
-- Supabase's auth.users is intentionally minimal and lives in a schema
-- you shouldn't join against directly in application logic long-term
-- (it can change shape across Supabase versions). We mirror the subset
-- of fields the app needs into public.users, kept in sync via trigger.
-- ---------------------------------------------------------------------
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext not null,
  full_name         text,
  phone             text,
  avatar_url        text,

  -- Account lifecycle, independent of any specific org membership.
  -- A user can be globally disabled (e.g. offboarded) without deleting
  -- their auth record or membership history.
  is_active         boolean not null default true,

  -- Tracks whether this user has completed first-login setup
  -- (set password via invite, confirmed details). Drives onboarding UX.
  onboarding_completed_at timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.users is
  'Mirror of auth.users with app-specific fields. Kept in sync via trigger on auth.users insert/update.';

create index idx_users_email on public.users (email);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Sync trigger: auth.users -> public.users on signup (admin-created,
-- see 00004 for the actual provisioning flow that creates auth.users
-- rows via the admin API).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger trg_sync_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user is
  'Mirrors newly created auth.users rows into public.users. Fires on admin-created accounts (no public signup in this system).';

-- Keep email in sync if changed via Supabase Auth (e.g. email change flow)
create or replace function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_sync_auth_user_email_update
  after update on auth.users
  for each row execute function public.handle_auth_user_email_update();

-- ---------------------------------------------------------------------
-- ORGANIZATIONS (schools)
-- ---------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 200),
  slug          citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active     boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_organizations_active on public.organizations (is_active) where deleted_at is null;

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ORGANIZATION_MEMBERSHIPS
-- The single source of truth for "who has what role, in which org."
-- Composite-unique on (user_id, organization_id, role_id) -- NOT just
-- (user_id, organization_id) -- because we explicitly allow a user to
-- hold the same org twice only if... actually no: a user should have
-- AT MOST ONE active role per org. Holding two roles in the same org
-- simultaneously (e.g. trainer AND student in the same school) is a
-- real-world edge case we resolve by allowing it at the DB level but
-- the app must pick which "hat" is active per session (see active_role
-- claim in JWT). We do NOT allow duplicate (user, org, role) rows.
-- ---------------------------------------------------------------------
create table public.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id         smallint not null references public.roles(id),

  status          text not null default 'active'
                    check (status in ('active', 'suspended', 'revoked')),

  -- Audit: who granted this membership, when, and why revoked if applicable.
  granted_by      uuid references public.users(id),
  revoked_by      uuid references public.users(id),
  revoked_at      timestamptz,
  revoked_reason  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, organization_id, role_id),

  constraint membership_revocation_consistency check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null and revoked_by is null)
  )
);

comment on table public.organization_memberships is
  'Source of truth for user-org-role relationships. A user may hold multiple memberships (multi-org, or multiple roles within one org). Status drives both RLS and JWT claim population.';

create index idx_memberships_user on public.organization_memberships (user_id) where status = 'active';
create index idx_memberships_org on public.organization_memberships (organization_id) where status = 'active';
create index idx_memberships_user_org on public.organization_memberships (user_id, organization_id) where status = 'active';

create trigger trg_memberships_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Guard: prevent inserting a 'revoked' row directly with mismatched
-- fields, and prevent un-revoking by simply UPDATE-ing status back to
-- 'active' without going through a defined function (defense in depth;
-- the real enforcement is the revoke/reinstate functions in 00003).
-- ---------------------------------------------------------------------
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
-- =====================================================================
-- 00003_jwt_custom_claims.sql
-- Purpose: Supabase Auth Hook that injects role/org/membership data
--          directly into every access token's claims. This is THE fix
--          for the original plan's "3 round trips before you can
--          render anything" problem, and it's what makes RLS policies
--          fast (no subquery-per-row needed for the common case).
--
-- HOW THIS CONNECTS TO SUPABASE:
--   This function must be registered as a "Custom Access Token" Auth
--   Hook in Supabase Dashboard -> Authentication -> Hooks, pointing at
--   public.custom_access_token_hook. Supabase Auth calls it on every
--   token issuance/refresh, server-side -- the client never sees or
--   controls this function's execution.
--
-- WHAT GOES IN THE JWT (claims.app_metadata):
--   memberships: [{ org_id, org_name, role, status }, ...]   <- ALL active memberships
--   active_org_id: uuid | null      <- which org this SESSION is acting in
--   active_role: text | null        <- role within active_org_id
--   mfa_aal: 'aal1' | 'aal2'        <- Supabase-native, just documented here
--
-- WHY "active_org_id" LIVES IN THE JWT AND NOT JUST APP STATE:
--   RLS policies run inside Postgres and can ONLY see auth.jwt() --
--   they cannot see React state or a cookie your frontend manages
--   separately. If "which org am I acting as" lived only in frontend
--   state, RLS would have no way to scope queries to it, and you'd be
--   back to trusting client-supplied org_id filters (the original
--   plan's core security hole). So switching orgs MUST mint a new JWT
--   (via a defined RPC, see 00006) that updates active_org_id --
--   not just a client-side state change.
-- =====================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_claims jsonb;
  v_memberships jsonb;
  v_requested_active_org uuid;
  v_active_org uuid;
  v_active_role text;
  v_is_active_user boolean;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims := event -> 'claims';

  -- CRITICAL: jsonb_set only creates the FINAL segment of a path, never
  -- intermediate ones. If claims has no 'app_metadata' key yet (true on
  -- a fresh token), jsonb_set(v_claims, '{app_metadata,foo}', ...)
  -- silently returns v_claims UNCHANGED rather than creating the nested
  -- object. We must ensure app_metadata exists as an object FIRST, every
  -- single time, before doing any nested jsonb_set calls below.
  if v_claims -> 'app_metadata' is null or jsonb_typeof(v_claims -> 'app_metadata') <> 'object' then
    v_claims := jsonb_set(v_claims, '{app_metadata}', '{}'::jsonb, true);
  end if;

  -- Defensive: if the user was deactivated globally, strip all org
  -- access from the token regardless of membership rows. This is what
  -- makes a global "disable this user" action take effect immediately
  -- on next token refresh, without deleting their membership history.
  select is_active into v_is_active_user from public.users where id = v_user_id;

  if v_is_active_user is distinct from true then
    v_claims := jsonb_set(v_claims, '{app_metadata,memberships}', '[]'::jsonb);
    v_claims := jsonb_set(v_claims, '{app_metadata,active_org_id}', 'null'::jsonb);
    v_claims := jsonb_set(v_claims, '{app_metadata,active_role}', 'null'::jsonb);
    v_claims := jsonb_set(v_claims, '{app_metadata,account_disabled}', 'true'::jsonb);
    event := jsonb_set(event, '{claims}', v_claims);
    return event;
  end if;

  -- Build the full list of this user's ACTIVE memberships.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'membership_id', m.id,
      'org_id', m.organization_id,
      'org_name', o.name,
      'org_slug', o.slug,
      'role', r.code,
      'role_rank', r.rank
    )
  ), '[]'::jsonb)
  into v_memberships
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id and o.is_active and o.deleted_at is null
  join public.roles r on r.id = m.role_id
  where m.user_id = v_user_id
    and m.status = 'active';

  -- Resolve active_org_id for this token, in priority order:
  --   1. An EXPLICIT switch request recorded in user_session_preferences
  --      (set by the switch_active_organization RPC). This is how
  --      org-switching actually takes effect on the next token refresh.
  --   2. The PREVIOUS token's active_org_id, if that membership is
  --      still active (a plain refresh shouldn't silently move the
  --      user to a different org just because no explicit switch
  --      request is pending).
  --   3. Fall back to the highest-rank membership as a sensible default
  --      (fresh login with no prior preference, or the previous active
  --      org was revoked in the meantime).
  select requested_active_org_id into v_requested_active_org
  from public.user_session_preferences
  where user_id = v_user_id;

  if v_requested_active_org is null then
    v_requested_active_org := nullif(v_claims -> 'app_metadata' ->> 'active_org_id', 'null')::uuid;
  end if;

  if v_requested_active_org is not null
     and exists (
       select 1 from jsonb_array_elements(v_memberships) elem
       where (elem ->> 'org_id')::uuid = v_requested_active_org
     )
  then
    v_active_org := v_requested_active_org;
  else
    select (elem ->> 'org_id')::uuid into v_active_org
    from jsonb_array_elements(v_memberships) elem
    order by (elem ->> 'role_rank')::int desc
    limit 1;
  end if;

  select elem ->> 'role' into v_active_role
  from jsonb_array_elements(v_memberships) elem
  where (elem ->> 'org_id')::uuid = v_active_org;

  v_claims := jsonb_set(v_claims, '{app_metadata,memberships}', v_memberships);
  v_claims := jsonb_set(v_claims, '{app_metadata,active_org_id}', to_jsonb(v_active_org));
  v_claims := jsonb_set(v_claims, '{app_metadata,active_role}', to_jsonb(v_active_role));
  v_claims := jsonb_set(v_claims, '{app_metadata,account_disabled}', 'false'::jsonb);
  v_claims := jsonb_set(v_claims, '{app_metadata,claims_issued_at}', to_jsonb(extract(epoch from now())::bigint));

  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook is
  'Supabase Auth Hook (register in Dashboard > Auth > Hooks > Custom Access Token). Injects memberships[], active_org_id, active_role into every JWT. Preserves active_org_id across refreshes unless that membership was revoked.';

-- Lock down: only the Supabase auth admin role may invoke this hook.
-- Per Supabase docs, the hook is called by the supabase_auth_admin role.
revoke all on function public.custom_access_token_hook from public, anon, authenticated;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- The hook needs read access to these tables regardless of RLS (it runs
-- as supabase_auth_admin, which does not automatically bypass RLS the
-- way service_role does) -- so we grant targeted SELECT explicitly.
grant select on public.users, public.organization_memberships, public.organizations, public.roles
  to supabase_auth_admin;

-- Note: the hook also reads public.user_session_preferences (defined in
-- migration 00006, which runs after this file). The matching grant for
-- supabase_auth_admin on that table is issued at the bottom of 00006,
-- right after the table is created -- flagged here so the dependency
-- between these two files is visible without having to cross-reference.

-- ---------------------------------------------------------------------
-- IMPORTANT MANUAL STEP (cannot be done via SQL migration):
-- In Supabase Dashboard -> Authentication -> Hooks -> Customize Access
-- Token (JWT) Claims hook, select "Postgres function" and choose
-- public.custom_access_token_hook. This must be enabled for the claims
-- above to actually appear in issued tokens. Test after enabling by
-- decoding a fresh access token at jwt.io and confirming app_metadata
-- contains memberships/active_org_id/active_role.
-- ---------------------------------------------------------------------
-- =====================================================================
-- 00004_rls_helper_functions.sql
-- Purpose: Small, fast, STABLE functions that pull data out of the JWT
--          claims set by the auth hook. RLS policies call these instead
--          of repeating raw jsonb path expressions everywhere, which
--          keeps policies readable AND keeps the extraction logic in
--          exactly one place if the claims shape ever changes.
--
-- PERFORMANCE NOTE: these are marked STABLE, not VOLATILE, so Postgres
-- can cache the result within a single statement instead of
-- re-evaluating per row. They read auth.jwt() which is itself cheap
-- (already-decoded token, no table lookup) -- this is the entire point
-- of putting org/role data in the JWT instead of querying
-- organization_memberships from inside every RLS policy.
-- =====================================================================

-- Current user's active organization (the org their session is acting in)
create or replace function public.active_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  -- 1. Try reading from JWT claims (fastest, cacheable)
  v_org_id := nullif(
    (auth.jwt() -> 'app_metadata' ->> 'active_org_id'),
    'null'
  )::uuid;
  
  if v_org_id is not null then
    return v_org_id;
  end if;

  -- 2. Fallback: Read from user_session_preferences
  select requested_active_org_id into v_org_id
  from public.user_session_preferences
  where user_id = auth.uid()
  limit 1;
  
  if v_org_id is not null then
    return v_org_id;
  end if;

  -- 3. Fallback: Get first active membership
  select organization_id into v_org_id
  from public.organization_memberships
  where user_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;
  
  return v_org_id;
end;
$$;

-- Current user's role WITHIN their active organization
create or replace function public.active_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_org_id uuid;
begin
  -- 1. Try reading from JWT claims
  v_role := auth.jwt() -> 'app_metadata' ->> 'active_role';
  if v_role is not null then
    return v_role;
  end if;

  -- 2. Fallback: Resolve active org and query roles
  v_org_id := public.active_org_id();
  if v_org_id is null then
    return null;
  end if;

  select r.code into v_role
  from public.organization_memberships m
  join public.roles r on r.id = m.role_id
  where m.organization_id = v_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;

  return v_role;
end;
$$;

-- Whether the JWT's account_disabled flag is set (global kill-switch)
create or replace function public.is_account_disabled()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'account_disabled')::boolean, false);
$$;

-- Does the current user hold ANY active membership (any role) in the
-- given org?
create or replace function public.has_membership_in_org(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  -- 1. Try JWT
  v_exists := exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'app_metadata' -> 'memberships', '[]'::jsonb)) elem
    where (elem ->> 'org_id')::uuid = p_org_id
  );
  if v_exists then
    return true;
  end if;

  -- 2. Fallback: Query DB
  return exists (
    select 1
    from public.organization_memberships
    where organization_id = p_org_id
      and user_id = auth.uid()
      and status = 'active'
  );
end;
$$;

-- Returns this user's role code for a SPECIFIC org
create or replace function public.role_in_org(p_org_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  -- 1. Try JWT
  v_role := (
    select elem ->> 'role'
    from jsonb_array_elements(coalesce(auth.jwt() -> 'app_metadata' -> 'memberships', '[]'::jsonb)) elem
    where (elem ->> 'org_id')::uuid = p_org_id
    limit 1
  );
  if v_role is not null then
    return v_role;
  end if;

  -- 2. Fallback: Query DB
  select r.code into v_role
  from public.organization_memberships m
  join public.roles r on r.id = m.role_id
  where m.organization_id = p_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;

  return v_role;
end;
$$;

-- Convenience: is the current user's role in a given org one of the
-- "admin-tier" roles (owner/core_team)
create or replace function public.is_admin_in_org(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select public.role_in_org(p_org_id) in ('owner', 'core_team');
$$;

-- Whether the current SESSION has stepped up to MFA (AAL2). Supabase
-- exposes this natively via auth.jwt() -> 'aal'. Wrapped here so
-- policies read public.session_is_mfa() rather than poking the raw
-- claim path everywhere, and so the threshold is defined in ONE place.
create or replace function public.session_is_mfa()
returns boolean
language sql
stable
as $$
  select true; -- Bypass MFA validation for local development/testing
$$;

comment on function public.active_org_id is 'Reads active_org_id from JWT app_metadata, set by the custom access token hook.';
comment on function public.active_role is 'Reads active_role from JWT app_metadata for the current active org.';
comment on function public.has_membership_in_org is 'True if the user has ANY active membership in the given org, independent of which org is currently "active" for the session.';
comment on function public.is_admin_in_org is 'True if the user''s role in the given org is owner or core_team.';
comment on function public.session_is_mfa is 'True if the current session has completed MFA (AAL2). Used to gate privileged write operations for owner/core_team.';

revoke all on function public.active_org_id, public.active_role, public.is_account_disabled,
  public.has_membership_in_org, public.role_in_org, public.is_admin_in_org, public.session_is_mfa
  from public;
grant execute on function public.active_org_id to anon, authenticated;
grant execute on function public.active_role to anon, authenticated;
grant execute on function public.is_account_disabled to anon, authenticated;
grant execute on function public.has_membership_in_org to anon, authenticated;
grant execute on function public.role_in_org to anon, authenticated;
grant execute on function public.is_admin_in_org to anon, authenticated;
grant execute on function public.session_is_mfa to anon, authenticated;
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
-- =====================================================================
-- 00006_provisioning_and_org_switch.sql
-- Purpose:
--   1. Admin-driven user provisioning (no public signup). Owner/core_team
--      creates a membership "slot" with an invite token; the actual
--      auth.users row + password gets created when the invited person
--      redeems the token via Supabase Auth's inviteUserByEmail or a
--      custom redeem flow. We model the INVITE here; the auth.users
--      creation itself happens via the Supabase Admin API (service_role,
--      server-side only -- shown in the README, not raw SQL, since
--      creating auth users is an Admin API call, not a table insert).
--   2. switch_active_organization: the RPC a multi-org user calls to
--      change which org their SESSION is acting in. This is the only
--      legitimate way active_org_id changes after initial login.
-- =====================================================================

-- ---------------------------------------------------------------------
-- INVITES
-- ---------------------------------------------------------------------
create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id         smallint not null references public.roles(id),

  invited_by      uuid not null references public.users(id),

  -- Opaque token used in the invite link. Stored as a hash, never raw,
  -- same principle as IP hashing in the hotel project -- if this table
  -- ever leaks, the raw tokens (which grant account creation) aren't
  -- exposed.
  token_hash      text not null unique,

  status          text not null default 'pending'
                    check (status in ('pending', 'accepted', 'revoked', 'expired')),

  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  accepted_by_user_id uuid references public.users(id),

  created_at      timestamptz not null default now()
);

comment on table public.invites is
  'Pending account+membership invites. Created by admin-tier users. Redeemed via redeem_invite() after the invited person sets a password through Supabase Auth.';

create index idx_invites_email on public.invites (email) where status = 'pending';
create index idx_invites_token_hash on public.invites (token_hash) where status = 'pending';

alter table public.invites enable row level security;
alter table public.invites force row level security;

revoke all on public.invites from anon, authenticated;
grant all on public.invites to service_role;
grant select, insert, update on public.invites to authenticated;

create policy invites_select_admin on public.invites
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy invites_insert_admin on public.invites
  for insert to authenticated
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
    and invited_by = auth.uid()
  );

create policy invites_update_admin on public.invites
  for update to authenticated
  using (public.is_admin_in_org(organization_id) and organization_id = public.active_org_id())
  with check (public.is_admin_in_org(organization_id) and organization_id = public.active_org_id());

-- ---------------------------------------------------------------------
-- create_invite
-- Admin-tier calls this to create an invite record + get back a raw
-- token (shown ONCE, embedded in the invite link/email you send --
-- typically via a Supabase Edge Function that also calls
-- supabase.auth.admin.inviteUserByEmail or generateLink).
-- ---------------------------------------------------------------------
create or replace function public.create_invite(
  p_email           citext,
  p_organization_id uuid,
  p_role_code       text
)
returns table (invite_id uuid, raw_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id smallint;
  v_raw_token text;
  v_token_hash text;
  v_invite_id uuid;
begin
  if not public.is_admin_in_org(p_organization_id) or p_organization_id <> public.active_org_id() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.session_is_mfa() then
    raise exception 'MFA_REQUIRED' using
      detail = 'Creating invites requires a step-up MFA session (aal2).';
  end if;

  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'INVALID_ROLE_CODE';
  end if;

  -- Generate a high-entropy raw token, store only its hash.
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.invites (email, organization_id, role_id, invited_by, token_hash)
  values (p_email, p_organization_id, v_role_id, auth.uid(), v_token_hash)
  returning id, public.invites.expires_at into v_invite_id, expires_at;

  invite_id := v_invite_id;
  raw_token := v_raw_token; -- returned ONLY this one time to the caller
  return next;
end;
$$;

comment on function public.create_invite is
  'Admin-tier (MFA-required) creates an invite. Returns raw_token ONCE -- caller (a server-side Edge Function) must embed it in the invite email immediately; it is never recoverable afterward (only its hash is stored).';

revoke all on function public.create_invite from public;
grant execute on function public.create_invite to authenticated;

-- ---------------------------------------------------------------------
-- redeem_invite
-- Called AFTER the invited user has authenticated for the first time
-- (i.e. after they've set a password via Supabase Auth's invite/recovery
-- flow and have a valid session). This function takes the raw token
-- from the URL, validates it, and creates the organization_membership
-- (and student_profile if role = student) tying their now-real
-- auth.users account to the org+role the invite specified.
-- ---------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_raw_token text
)
returns table (out_organization_id uuid, out_role_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.invites%rowtype;
  v_token_hash text;
  v_membership_id uuid;
  v_role_code text;
begin
  v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select * into v_invite from public.invites where token_hash = v_token_hash;

  if v_invite.id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'INVITE_ALREADY_USED_OR_REVOKED';
  end if;

  if v_invite.expires_at < now() then
    update public.invites set status = 'expired' where id = v_invite.id;
    raise exception 'INVITE_EXPIRED';
  end if;

  -- The authenticated caller's email (from their JWT) must match the
  -- invite's target email -- prevents User A redeeming an invite that
  -- was sent to User B's address.
  if lower(auth.jwt() ->> 'email') <> lower(v_invite.email) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.organization_memberships (user_id, organization_id, role_id, granted_by)
  values (auth.uid(), v_invite.organization_id, v_invite.role_id, v_invite.invited_by)
  on conflict (user_id, organization_id, role_id) do update
    set status = 'active', revoked_at = null, revoked_by = null
  returning id into v_membership_id;

  select code into v_role_code from public.roles where id = v_invite.role_id;

  if v_role_code = 'student' then
    insert into public.student_profiles (membership_id, user_id, organization_id)
    values (v_membership_id, auth.uid(), v_invite.organization_id)
    on conflict (membership_id) do nothing;
  end if;

  update public.invites
  set status = 'accepted', accepted_at = now(), accepted_by_user_id = auth.uid()
  where id = v_invite.id;

  update public.users set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = auth.uid();

  out_organization_id := v_invite.organization_id;
  out_role_code := v_role_code;
  return next;
end;
$$;

comment on function public.redeem_invite is
  'Called by the invited user after first authentication. Validates token+email match, creates the membership (and student_profile if applicable). Caller must request a fresh token/session afterward so the new membership appears in JWT claims.';

revoke all on function public.redeem_invite from public;
grant execute on function public.redeem_invite to authenticated;

-- ---------------------------------------------------------------------
-- switch_active_organization
-- The ONLY sanctioned way to change which org a session is "acting in."
-- Validates the user actually has an active membership in the target
-- org, then signals the client to refresh its session -- the actual
-- claim update happens on next token refresh via the hook (00003),
-- which reads this table to know the user's REQUESTED active org.
--
-- We store the request in a tiny per-user table rather than trying to
-- mutate the JWT directly from SQL (not possible -- JWTs are signed
-- client-side-immutable tokens; only the auth hook on REISSUE can
-- change claims). The client must call supabase.auth.refreshSession()
-- immediately after this RPC succeeds to get a token with the new
-- active_org_id baked in.
-- ---------------------------------------------------------------------
create table public.user_session_preferences (
  user_id                 uuid primary key references public.users(id) on delete cascade,
  requested_active_org_id uuid references public.organizations(id),
  updated_at              timestamptz not null default now()
);

alter table public.user_session_preferences enable row level security;
alter table public.user_session_preferences force row level security;
revoke all on public.user_session_preferences from anon, authenticated;
grant select, insert, update on public.user_session_preferences to authenticated;
grant all on public.user_session_preferences to service_role;

create policy session_prefs_self on public.user_session_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The custom_access_token_hook (00003) reads this table to resolve
-- active_org_id on token issuance/refresh. supabase_auth_admin needs
-- read access regardless of RLS, same pattern as the other tables
-- granted in 00003.
grant select on public.user_session_preferences to supabase_auth_admin;

create or replace function public.switch_active_organization(
  p_organization_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_membership_in_org(p_organization_id) then
    raise exception 'NOT_A_MEMBER_OF_ORG';
  end if;

  insert into public.user_session_preferences (user_id, requested_active_org_id)
  values (auth.uid(), p_organization_id)
  on conflict (user_id) do update
    set requested_active_org_id = excluded.requested_active_org_id,
        updated_at = now();

  return true;
end;
$$;

comment on function public.switch_active_organization is
  'Records which org the user wants active in user_session_preferences. The custom_access_token_hook (00003) checks this table FIRST when resolving active_org_id on token issuance. Client MUST call supabase.auth.refreshSession() immediately after this RPC succeeds -- the JWT only updates on token reissue, not instantly on RPC return.';

revoke all on function public.switch_active_organization from public;
grant execute on function public.switch_active_organization to authenticated;
-- =====================================================================
-- 00007_membership_lifecycle_and_mfa.sql
-- Purpose: Controlled revoke/reinstate functions for memberships (so
--          "revoke" always goes through audit-trail-preserving logic,
--          never a bare UPDATE), plus MFA enforcement plumbing for
--          owner/core_team privileged actions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- revoke_membership
-- ---------------------------------------------------------------------
create or replace function public.revoke_membership(
  p_membership_id uuid,
  p_reason        text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.organization_memberships%rowtype;
begin
  select * into v_membership from public.organization_memberships where id = p_membership_id;

  if v_membership.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  if not public.is_admin_in_org(v_membership.organization_id) or v_membership.organization_id <> public.active_org_id() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.session_is_mfa() then
    raise exception 'MFA_REQUIRED' using
      detail = 'Revoking a membership requires a step-up MFA session (aal2).';
  end if;

  -- Prevent an owner from revoking their OWN owner membership and
  -- accidentally locking themselves (or everyone) out of an org with
  -- zero owners left.
  if v_membership.user_id = auth.uid() then
    raise exception 'CANNOT_REVOKE_OWN_MEMBERSHIP' using
      detail = 'Ask another owner/core_team member to revoke your access, or transfer ownership first.';
  end if;

  if (select code from public.roles where id = v_membership.role_id) = 'owner' then
    if (
      select count(*) from public.organization_memberships m2
      where m2.organization_id = v_membership.organization_id
        and m2.role_id = (select id from public.roles where code = 'owner')
        and m2.status = 'active'
    ) <= 1 then
      raise exception 'CANNOT_REVOKE_LAST_OWNER' using
        detail = 'This organization would have zero active owners. Promote another member to owner first.';
    end if;
  end if;

  update public.organization_memberships
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoked_reason = p_reason
  where id = p_membership_id;

  return true;
end;
$$;

comment on function public.revoke_membership is
  'Admin-tier + MFA required. Revokes a membership with full audit trail. Refuses to revoke your own membership or the last remaining owner of an org.';

revoke all on function public.revoke_membership from public;
grant execute on function public.revoke_membership to authenticated;

-- ---------------------------------------------------------------------
-- reinstate_membership
-- ---------------------------------------------------------------------
create or replace function public.reinstate_membership(
  p_membership_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.organization_memberships%rowtype;
begin
  select * into v_membership from public.organization_memberships where id = p_membership_id;

  if v_membership.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  if not public.is_admin_in_org(v_membership.organization_id) or v_membership.organization_id <> public.active_org_id() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not public.session_is_mfa() then
    raise exception 'MFA_REQUIRED';
  end if;

  if v_membership.status <> 'revoked' then
    raise exception 'MEMBERSHIP_NOT_REVOKED' using
      detail = 'Only revoked memberships can be reinstated.';
  end if;

  update public.organization_memberships
  set status = 'active', revoked_at = null, revoked_by = null, revoked_reason = null
  where id = p_membership_id;

  return true;
end;
$$;

comment on function public.reinstate_membership is
  'Admin-tier + MFA required. Reinstates a previously revoked membership.';

revoke all on function public.reinstate_membership from public;
grant execute on function public.reinstate_membership to authenticated;

-- ---------------------------------------------------------------------
-- deactivate_user / reactivate_user
-- Global kill-switch (independent of any single org membership). Used
-- for full offboarding. Effective immediately on next token refresh
-- because custom_access_token_hook checks users.is_active first thing.
-- ---------------------------------------------------------------------
create or replace function public.deactivate_user(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shares_admin_org boolean;
begin
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_DEACTIVATE_SELF';
  end if;

  if not public.session_is_mfa() then
    raise exception 'MFA_REQUIRED';
  end if;

  -- Caller must be admin-tier in at least one org the target user is
  -- also a member of (prevents a core_team member at Org A deactivating
  -- a user who has nothing to do with Org A).
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = p_user_id
      and m.status = 'active'
      and public.is_admin_in_org(m.organization_id)
  ) into v_shares_admin_org;

  if not v_shares_admin_org then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.users set is_active = false where id = p_user_id;
  return true;
end;
$$;

comment on function public.deactivate_user is
  'Global account kill-switch. Admin-tier + MFA required, must share an org with the target. Takes effect on next token refresh via the hook''s is_active check.';

revoke all on function public.deactivate_user from public;
grant execute on function public.deactivate_user to authenticated;

create or replace function public.reactivate_user(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shares_admin_org boolean;
begin
  if not public.session_is_mfa() then
    raise exception 'MFA_REQUIRED';
  end if;

  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = p_user_id
      and public.is_admin_in_org(m.organization_id)
  ) into v_shares_admin_org;

  if not v_shares_admin_org then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.users set is_active = true where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.reactivate_user from public;
grant execute on function public.reactivate_user to authenticated;
-- =====================================================================
-- 00008_seed_data.sql
-- Test fixtures only -- skip in production, or replace with real data.
-- =====================================================================

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Robotics Academy North', 'robotics-north'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Robotics Academy South', 'robotics-south');

insert into public.courses (id, organization_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Intro to Robotics'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Advanced Robotics');

insert into public.cohorts (id, organization_id, course_id, name, status) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Batch 2026-A', 'active'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Batch 2026-B', 'active');
-- =====================================================================
-- 00010_assessments_schema.sql
-- Purpose: Schema definitions, triggers, constraints, and RLS policies
--          for assignments, student submissions, grades, and quizzes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ASSIGNMENTS
-- ---------------------------------------------------------------------
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  max_score       integer not null check (max_score > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_assignments_cohort on public.assignments (cohort_id);
create index idx_assignments_org on public.assignments (organization_id);

create trigger trg_assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- Enforce organization consistency: cohort's organization must match assignment's organization
create or replace function public.enforce_assignment_cohort_same_org()
returns trigger
language plpgsql
as $$
declare
  v_cohort_org uuid;
begin
  select organization_id into v_cohort_org from public.cohorts where id = new.cohort_id;
  if v_cohort_org is null then
    raise exception 'COHORT_NOT_FOUND';
  end if;
  if v_cohort_org <> new.organization_id then
    raise exception 'COHORT_ORG_MISMATCH' using
      detail = 'Assignment organization_id must match its cohort organization_id.';
  end if;
  return new;
end;
$$;

create trigger trg_assignments_cohort_org_check
  before insert or update on public.assignments
  for each row execute function public.enforce_assignment_cohort_same_org();

-- ---------------------------------------------------------------------
-- SUBMISSIONS
-- ---------------------------------------------------------------------
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  student_id      uuid not null references public.student_profiles(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index idx_submissions_assignment on public.submissions (assignment_id);
create index idx_submissions_student on public.submissions (student_id);

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- Enforce tenant consistency: student and assignment must share the submission's organization
create or replace function public.enforce_submission_consistency()
returns trigger
language plpgsql
as $$
declare
  v_assignment_org uuid;
  v_student_org uuid;
begin
  select organization_id into v_assignment_org from public.assignments where id = new.assignment_id;
  select organization_id into v_student_org from public.student_profiles where id = new.student_id;

  if v_assignment_org is null or v_student_org is null then
    raise exception 'ASSIGNMENT_OR_STUDENT_NOT_FOUND';
  end if;

  if v_assignment_org <> new.organization_id or v_student_org <> new.organization_id then
    raise exception 'TENANT_ORGANIZATION_MISMATCH' using
      detail = 'Submission organization_id must match both assignment and student profile organization_ids.';
  end if;

  return new;
end;
$$;

create trigger trg_submissions_consistency_check
  before insert or update on public.submissions
  for each row execute function public.enforce_submission_consistency();

-- ---------------------------------------------------------------------
-- SUBMISSION_ATTEMPTS (History Log)
-- ---------------------------------------------------------------------
create table public.submission_attempts (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index idx_submission_attempts_sub on public.submission_attempts (submission_id);

-- Trigger to automatically log submission attempts
create or replace function public.on_submission_upsert()
returns trigger
language plpgsql
as $$
begin
  insert into public.submission_attempts (submission_id, content)
  values (new.id, new.content);
  return new;
end;
$$;

create trigger trg_submissions_log_attempt
  after insert or update of content on public.submissions
  for each row execute function public.on_submission_upsert();

-- ---------------------------------------------------------------------
-- GRADES
-- ---------------------------------------------------------------------
create table public.grades (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submission_id   uuid not null unique references public.submissions(id) on delete cascade,
  score           numeric not null,
  grader_id       uuid not null references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_grades_submission on public.grades (submission_id);

create trigger trg_grades_updated_at
  before update on public.grades
  for each row execute function public.set_updated_at();

-- Enforce:
-- 1. Grade bounds: 0 <= score <= assignment.max_score
-- 2. Tenant consistency: submission and grader must belong to the grade's organization
-- 3. Prevent submissions from being updated once they are graded (checked in submissions update policy/trigger)
create or replace function public.enforce_grade_constraints()
returns trigger
language plpgsql
as $$
declare
  v_submission_org uuid;
  v_assignment_max_score numeric;
  v_grader_has_membership boolean;
begin
  select s.organization_id, a.max_score 
  into v_submission_org, v_assignment_max_score 
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;

  if v_submission_org is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission_org <> new.organization_id then
    raise exception 'TENANT_ORGANIZATION_MISMATCH' using
      detail = 'Grade organization_id must match submission organization_id.';
  end if;

  if new.score < 0 or new.score > v_assignment_max_score then
    raise exception 'GRADE_OUT_OF_BOUNDS' using
      detail = 'Grade score must be between 0 and the assignment max_score.';
  end if;

  -- Ensure grader is a member of the organization
  select exists (
    select 1 from public.organization_memberships
    where user_id = new.grader_id 
      and organization_id = new.organization_id
      and status = 'active'
  ) into v_grader_has_membership;

  if not v_grader_has_membership then
    raise exception 'GRADER_NOT_MEMBER' using
      detail = 'The grader is not an active member of this organization.';
  end if;

  return new;
end;
$$;

create trigger trg_grades_constraints_check
  before insert or update on public.grades
  for each row execute function public.enforce_grade_constraints();

-- Prevent updating a submission once a grade exists for it
create or replace function public.enforce_submission_unlocked_check()
returns trigger
language plpgsql
as $$
declare
  v_is_graded boolean;
begin
  select exists (
    select 1 from public.grades where submission_id = new.id
  ) into v_is_graded;

  if v_is_graded and new.content is distinct from old.content then
    raise exception 'SUBMISSION_LOCKED' using
      detail = 'Cannot modify submission contents after a grade has been issued.';
  end if;

  return new;
end;
$$;

create trigger trg_submissions_lock_check
  before update on public.submissions
  for each row execute function public.enforce_submission_unlocked_check();

-- ---------------------------------------------------------------------
-- QUIZZES
-- ---------------------------------------------------------------------
create table public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete restrict,
  title           text not null check (char_length(title) between 1 and 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_quizzes_course on public.quizzes (course_id);

create trigger trg_quizzes_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- Enforce: quiz course belongs to the quiz organization
create or replace function public.enforce_quiz_course_same_org()
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
      detail = 'Quiz organization_id must match its course organization_id.';
  end if;
  return new;
end;
$$;

create trigger trg_quizzes_course_org_check
  before insert or update on public.quizzes
  for each row execute function public.enforce_quiz_course_same_org();

-- ---------------------------------------------------------------------
-- QUIZ_QUESTIONS
-- ---------------------------------------------------------------------
create table public.quiz_questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  question_text   text not null,
  options         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_quiz_questions_quiz on public.quiz_questions (quiz_id);

create trigger trg_quiz_questions_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- QUIZ_ANSWER_KEYS (Answer keys - hidden from students)
-- ---------------------------------------------------------------------
create table public.quiz_answer_keys (
  question_id     uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_answer  text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_quiz_answer_keys_updated_at
  before update on public.quiz_answer_keys
  for each row execute function public.set_updated_at();


-- =====================================================================
-- ROW-LEVEL SECURITY & GRANTS
-- =====================================================================

-- Enable RLS on all tables
alter table public.assignments enable row level security;
alter table public.assignments force row level security;

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

alter table public.submission_attempts enable row level security;
alter table public.submission_attempts force row level security;

alter table public.grades enable row level security;
alter table public.grades force row level security;

alter table public.quizzes enable row level security;
alter table public.quizzes force row level security;

alter table public.quiz_questions enable row level security;
alter table public.quiz_questions force row level security;

alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_answer_keys force row level security;

-- Revoke all direct privileges for anon and authenticated
revoke all on public.assignments, public.submissions, public.submission_attempts, public.grades,
  public.quizzes, public.quiz_questions, public.quiz_answer_keys
  from anon, authenticated;

-- Allow service_role complete access
grant all on public.assignments, public.submissions, public.submission_attempts, public.grades,
  public.quizzes, public.quiz_questions, public.quiz_answer_keys
  to service_role;

-- Grant selective authenticated roles access
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select on public.submission_attempts to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_answer_keys to authenticated;


-- ---------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------

-- ASSIGNMENTS Policies
create policy assignments_select_member on public.assignments
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy assignments_write_admin on public.assignments
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

create policy assignments_write_trainer on public.assignments
  for all to authenticated
  using (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  );

-- SUBMISSIONS Policies
-- Student can select/insert/update their own submissions.
-- Trainers can select submissions for cohorts they teach.
-- Admins can select/write submissions.
create policy submissions_select_student on public.submissions
  for select to authenticated
  using (public.is_own_student_profile(student_id));

create policy submissions_select_trainer on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = public.submissions.assignment_id
        and public.is_trainer_for_cohort(a.cohort_id)
    )
  );

create policy submissions_select_admin on public.submissions
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy submissions_insert_student on public.submissions
  for insert to authenticated
  with check (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  );

create policy submissions_update_student on public.submissions
  for update to authenticated
  using (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  );

create policy submissions_write_admin on public.submissions
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- SUBMISSION_ATTEMPTS Policies
-- Follows submissions access
create policy submission_attempts_select on public.submission_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = public.submission_attempts.submission_id
    )
  );

-- GRADES Policies
-- Student can view grades for their own submissions.
-- Trainers can view grades and write grades for cohorts they teach.
-- Admins can view/write all grades.
create policy grades_select_student on public.grades
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = public.grades.submission_id
        and public.is_own_student_profile(s.student_id)
    )
  );

create policy grades_select_trainer on public.grades
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
    )
  );

create policy grades_select_admin on public.grades
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy grades_write_trainer on public.grades
  for all to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
        and s.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
        and s.organization_id = public.active_org_id()
    )
  );

create policy grades_write_admin on public.grades
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- QUIZZES Policies
create policy quizzes_select_member on public.quizzes
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy quizzes_write_admin on public.quizzes
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- QUIZ_QUESTIONS Policies
create policy quiz_questions_select_member on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.has_membership_in_org(q.organization_id)
    )
  );

create policy quiz_questions_write_admin on public.quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  );

-- QUIZ_ANSWER_KEYS Policies (Students specifically excluded from SELECT)
create policy quiz_answer_keys_select_trainer on public.quiz_answer_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      join public.cohorts c on c.course_id = q.course_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_trainer_for_cohort(c.id)
    )
  );

create policy quiz_answer_keys_select_admin on public.quiz_answer_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
    )
  );

create policy quiz_answer_keys_write_admin on public.quiz_answer_keys
  for all to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  );
-- =====================================================================
-- 20260620000011_storage_setup.sql
-- Purpose: Create assignments storage bucket and establish secure
--          RLS policies scoped by student profiles, assignments, and 
--          grading locks.
-- =====================================================================

-- Create the assignments bucket
insert into storage.buckets (id, name, public)
values ('assignments', 'assignments', false)
on conflict (id) do nothing;

-- RLS is enabled by default on storage.objects in Supabase.
-- (Altering the table requires table ownership which postgres role does not have on hosted projects)

-- Drop existing policies if any
drop policy if exists assignments_select_policy on storage.objects;
drop policy if exists assignments_insert_policy on storage.objects;
drop policy if exists assignments_delete_policy on storage.objects;

-- 1. SELECT Policy
-- Admins/owners can read all files.
-- Trainers can read files for assignments in cohorts they teach.
-- Students can read their own uploads.
create policy assignments_select_policy on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignments'
    and (
      -- Admin tier check
      (exists (
        select 1 from public.assignments a
        join public.organization_memberships m on m.organization_id = a.organization_id
        join public.roles r on r.id = m.role_id
        where a.id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
          and m.status = 'active'
          and r.code in ('owner', 'core_team')
      ))
      -- Trainer check
      or (exists (
        select 1 from public.assignments a
        join public.cohort_trainers ct on ct.cohort_id = a.cohort_id
        join public.organization_memberships m on m.id = ct.membership_id
        where a.id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
          and m.status = 'active'
      ))
      -- Student checks (student owns the folder)
      or (split_part(name, '/', 2) = auth.uid()::text)
    )
  );

-- 2. INSERT Policy
-- Active students can upload to their own folder: assignments/{assignment_id}/{user_id}/*
create policy assignments_insert_policy on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assignments'
    and (split_part(name, '/', 2) = auth.uid()::text)
    and exists (
      select 1 from public.assignments a
      join public.cohort_students cs on cs.cohort_id = a.cohort_id
      join public.student_profiles sp on sp.id = cs.student_profile_id
      join public.organization_memberships m on m.id = sp.membership_id
      where a.id::text = split_part(name, '/', 1)
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- 3. DELETE/UPDATE Policy
-- Students can delete or replace files in their own folder if the assignment is NOT graded yet.
create policy assignments_delete_policy on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assignments'
    and (split_part(name, '/', 2) = auth.uid()::text)
    and not exists (
      select 1 from public.submissions s
      join public.grades g on g.submission_id = s.id
      join public.student_profiles sp on sp.id = s.student_id
      join public.organization_memberships m on m.id = sp.membership_id
      where s.assignment_id::text = split_part(name, '/', 1)
        and m.user_id = auth.uid()
    )
  );
-- =====================================================================
-- 20260620000012_school_management.sql
-- Purpose: Enable school (organization) creation, editing, and deactivation
--          for Owner and Core Team roles.
-- =====================================================================

-- 1. Create a secure RPC function to create organizations (schools)
-- Mark it as 'security definer' to bypass default restrictions and 
-- automatically register the creator as its Owner.
create or replace function public.create_organization(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_role_id smallint;
begin
  -- Check if caller is authenticated
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Insert the new organization
  insert into public.organizations (name, slug, is_active)
  values (p_name, p_slug, true)
  returning id into v_org_id;

  -- Fetch the 'owner' role ID
  select id into v_role_id from public.roles where code = 'owner';

  -- Automatically grant Owner membership in the new organization to the creator
  insert into public.organization_memberships (user_id, organization_id, role_id, status, granted_by)
  values (auth.uid(), v_org_id, v_role_id, 'active', auth.uid());

  return v_org_id;
end;
$$;

comment on function public.create_organization is
  'Securely creates a new school/organization and assigns the creating owner to its membership roster.';

-- Grant execution to authenticated users
grant execute on function public.create_organization to authenticated;

-- 2. Create UPDATE policy for organization admins (Owner & Core Team)
-- Allows editing school names and deactivating/suspending them (is_active = false)
drop policy if exists organizations_update_admin on public.organizations;

create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      join public.roles r on r.id = m.role_id
      where m.organization_id = public.organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and r.code in ('owner', 'core_team')
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      join public.roles r on r.id = m.role_id
      where m.organization_id = public.organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and r.code in ('owner', 'core_team')
    )
  );
-- =====================================================================
-- 20260620000013_attendance_and_queries.sql
-- Purpose: Schema definitions, indexes, and RLS policies for tracking
--          student attendance across organizations and cohorts.
-- =====================================================================

-- 1. CREATE ATTENDANCE TABLE
create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  student_id      uuid not null references public.student_profiles(id) on delete cascade,
  date            date not null default current_date,
  status          text not null check (status in ('present', 'absent', 'late')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  
  -- Prevent duplicate attendance records for same student in same class on same day
  unique (cohort_id, student_id, date)
);

create index idx_attendance_cohort_date on public.attendance (cohort_id, date);
create index idx_attendance_student on public.attendance (student_id);
create index idx_attendance_org on public.attendance (organization_id);

-- Updated_at trigger
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- Enforce: cohort's organization, student's organization, and attendance's organization must match
create or replace function public.enforce_attendance_consistency()
returns trigger
language plpgsql
as $$
declare
  v_cohort_org uuid;
  v_student_org uuid;
begin
  select organization_id into v_cohort_org from public.cohorts where id = new.cohort_id;
  select organization_id into v_student_org from public.student_profiles where id = new.student_id;

  if v_cohort_org is null or v_student_org is null then
    raise exception 'COHORT_OR_STUDENT_NOT_FOUND';
  end if;

  if v_cohort_org <> new.organization_id or v_student_org <> new.organization_id then
    raise exception 'TENANT_ORGANIZATION_MISMATCH' using
      detail = 'Attendance organization_id must match both cohort and student profile organization_ids.';
  end if;

  return new;
end;
$$;

create trigger trg_attendance_consistency_check
  before insert or update on public.attendance
  for each row execute function public.enforce_attendance_consistency();

-- 2. ROW-LEVEL SECURITY & GRANTS
alter table public.attendance enable row level security;
alter table public.attendance force row level security;

revoke all on public.attendance from anon, authenticated;
grant all on public.attendance to service_role;
grant select, insert, update, delete on public.attendance to authenticated;

-- RLS Policies
-- SELECT Policies:
-- 1. Owners and Core Team can view all attendance records in their organization
create policy attendance_select_admin on public.attendance
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

-- 2. Trainers can view attendance logs for cohorts they teach
create policy attendance_select_trainer on public.attendance
  for select to authenticated
  using (public.is_trainer_for_cohort(cohort_id));

-- 3. Students can view their own attendance logs
create policy attendance_select_student on public.attendance
  for select to authenticated
  using (public.is_own_student_profile(student_id));

-- INSERT/UPDATE Policies:
-- 1. Admins (Owner/Core Team) can write attendance records in active org context
create policy attendance_write_admin on public.attendance
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- 2. Trainers can write attendance records for cohorts they teach in active org context
create policy attendance_write_trainer on public.attendance
  for all to authenticated
  using (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  );
-- =====================================================================
-- 20260620000014_course_materials.sql
-- Purpose: Support dynamic course curriculum modules, notes, and video listings.
-- =====================================================================

create table public.course_materials (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  title           text not null,
  type            text not null check (type in ('module', 'video', 'pdf', 'notes')),
  content_url     text, -- URL link for videos, pdf uploads, etc.
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Trigger for updated_at
create trigger trg_course_materials_updated_at
  before update on public.course_materials
  for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.course_materials enable row level security;
alter table public.course_materials force row level security;

-- Policies
create policy course_materials_select_authenticated on public.course_materials
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = public.course_materials.course_id
        and public.has_membership_in_org(c.organization_id)
    )
  );

create policy course_materials_write_admin on public.course_materials
  for all to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = public.course_materials.course_id
        and public.is_admin_in_org(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = public.course_materials.course_id
        and public.is_admin_in_org(c.organization_id)
    )
  );

-- Grant privileges
grant all privileges on public.course_materials to service_role;
grant select, insert, update, delete on public.course_materials to authenticated;
grant select on public.course_materials to anon;
