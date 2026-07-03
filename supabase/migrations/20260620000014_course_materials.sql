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
