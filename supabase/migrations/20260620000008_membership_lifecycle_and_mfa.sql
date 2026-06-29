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
