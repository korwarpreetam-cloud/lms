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
