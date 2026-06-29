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
