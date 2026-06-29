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
language sql
stable
as $$
  select nullif(
    (auth.jwt() -> 'app_metadata' ->> 'active_org_id'),
    'null'
  )::uuid;
$$;

-- Current user's role WITHIN their active organization
create or replace function public.active_role()
returns text
language sql
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'active_role';
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
-- given org? Checks the full memberships[] array in the JWT, NOT just
-- active_org_id -- useful for cases where a user needs access to an org
-- they're a member of but haven't "switched into" as their active context
-- (e.g. an owner glancing at another org they core_team for).
create or replace function public.has_membership_in_org(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'app_metadata' -> 'memberships', '[]'::jsonb)) elem
    where (elem ->> 'org_id')::uuid = p_org_id
  );
$$;

-- Returns this user's role code for a SPECIFIC org (not just the active
-- one) by reading the memberships[] array. Null if no membership there.
create or replace function public.role_in_org(p_org_id uuid)
returns text
language sql
stable
as $$
  select elem ->> 'role'
  from jsonb_array_elements(coalesce(auth.jwt() -> 'app_metadata' -> 'memberships', '[]'::jsonb)) elem
  where (elem ->> 'org_id')::uuid = p_org_id
  limit 1;
$$;

-- Convenience: is the current user's role in a given org one of the
-- "admin-tier" roles (owner/core_team), regardless of active org?
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
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
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
