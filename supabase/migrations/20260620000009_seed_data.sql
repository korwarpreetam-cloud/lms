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
