-- =============================================================================
-- fix_permissions.sql
-- Purpose: Restore baseline privileges for Supabase system roles on the
--          public schema after a REVOKE ALL or accidental grant wipeout.
--
-- SCOPING RATIONALE:
--   - postgres / service_role / dashboard_user: full control (Supabase
--     internals require this; these roles are never issued to end users).
--   - authenticated: per-table grants live in the individual migration files
--     (rls_policies.sql, provisioning_and_org_switch.sql). This file only
--     restores the schema-level USAGE right so those per-table grants can
--     function again.
--   - anon: NOTHING. This LMS has zero public-facing data. An anon caller
--     with your project's anon key should not be able to read any table.
--     RLS policies would catch most attempts, but not granting in the
--     first place is the correct first layer.
--   - supabase_auth_admin: Only needs to read user_session_preferences for
--     the custom_access_token_hook (see 00006_provisioning_and_org_switch).
--     Granting it schema-wide SELECT is unnecessary and expands blast radius
--     if the hook were ever exploited.
-- =============================================================================

-- -----------------------------------------------------------------------
-- 1. System roles: full control over schema and its objects
-- -----------------------------------------------------------------------
GRANT ALL ON SCHEMA public TO postgres, service_role, dashboard_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, dashboard_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, dashboard_user;

-- -----------------------------------------------------------------------
-- 2. authenticated: schema USAGE only. Table-level grants are set by the
--    individual migration files. If you are recovering from a full wipe,
--    re-run the RLS policy migrations to restore those grants.
-- -----------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

-- -----------------------------------------------------------------------
-- 3. supabase_auth_admin: narrowly scoped to only what the
--    custom_access_token_hook reads at token issuance time.
--    Do NOT grant schema-wide SELECT here.
-- -----------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.user_session_preferences TO supabase_auth_admin;
GRANT SELECT ON public.organization_memberships TO supabase_auth_admin;
GRANT SELECT ON public.roles TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- -----------------------------------------------------------------------
-- 4. anon: deliberately receives NO grants in the public schema.
--    If you later add a genuinely public surface (e.g. a public course
--    catalog), add a targeted grant here with the exact table name.
-- -----------------------------------------------------------------------
-- (intentionally empty)

-- -----------------------------------------------------------------------
-- 5. Default privileges for future objects created by postgres/migrations
-- -----------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role, dashboard_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role, dashboard_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, service_role, dashboard_user;

-- authenticated default: schema USAGE covers existing tables; per-table
-- grants for new tables must be added in the migration that creates them.
-- No blanket default privilege for authenticated on tables to avoid
-- accidentally exposing future tables before their RLS policies are in place.
