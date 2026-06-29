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
