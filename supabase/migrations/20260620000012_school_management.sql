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
