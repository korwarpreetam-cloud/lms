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
