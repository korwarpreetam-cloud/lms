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
