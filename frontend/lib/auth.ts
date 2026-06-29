// =====================================================================
// lib/auth.ts
// Client-side helpers built on top of the JWT claims model. None of
// these make a database round-trip just to determine role/org -- they
// read straight off the current session's claims.
// =====================================================================
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type Membership = {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: string;
  role_rank: number;
};

export type AppClaims = {
  memberships: Membership[];
  active_org_id: string | null;
  active_role: string | null;
  account_disabled: boolean;
};

/**
 * Decodes a JWT and returns the payload. No verification (the token was
 * already verified server-side by Supabase Auth).
 */
function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Reads role/org claims from the CURRENT session's JWT access_token.
 *
 * IMPORTANT: The Custom Access Token Hook injects memberships, active_org_id,
 * and active_role into the JWT's claims.app_metadata. However, the Supabase JS
 * client populates session.user.app_metadata from the DATABASE (auth.users
 * raw_app_meta_data column), NOT from the decoded JWT. So we MUST decode the
 * access_token ourselves to read hook-injected claims.
 */
export function getAppClaims(session: { access_token?: string; user?: { app_metadata?: any } } | null): AppClaims | null {
  if (!session) return null;

  // Primary: decode the JWT to get hook-injected claims
  let meta: Record<string, any> = {};
  if (session.access_token) {
    const payload = decodeJwtPayload(session.access_token);
    meta = payload.app_metadata ?? {};
  }

  // Fallback: if JWT decoding yielded nothing, try the user object
  if (!meta.active_role && session.user?.app_metadata) {
    meta = session.user.app_metadata;
  }

  return {
    memberships: meta.memberships ?? [],
    active_org_id: meta.active_org_id ?? null,
    active_role: meta.active_role ?? null,
    account_disabled: meta.account_disabled ?? false,
  };
}

/**
 * Switches the user's active organization. This is a TWO-STEP process
 * and both steps are required:
 *   1. Call the RPC to record the switch request server-side.
 *   2. Force a session refresh so a NEW token gets issued -- the old
 *      token in memory/cookies still has the OLD active_org_id until
 *      this happens. Skipping step 2 is the most common bug when
 *      wiring this up: the RPC appears to succeed but the UI doesn't
 *      change because the stale token is still being used.
 */
export async function switchActiveOrganization(orgId: string) {
  const supabase = createClient();

  const { error: rpcError } = await supabase.rpc('switch_active_organization', {
    p_organization_id: orgId,
  });
  if (rpcError) throw rpcError;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;

  return getAppClaims(data.session as any);
}

/**
 * Helper for an org-switcher dropdown component: lists all orgs the
 * user belongs to, straight from claims, no query needed.
 */
export function listAvailableOrganizations(claims: AppClaims | null): Membership[] {
  return claims?.memberships ?? [];
}

/** Convenience role checks. */
export function isAdminTier(claims: AppClaims | null): boolean {
  return claims?.active_role === 'owner' || claims?.active_role === 'core_team';
}

export function isTrainer(claims: AppClaims | null): boolean {
  return claims?.active_role === 'trainer';
}

export function isStudent(claims: AppClaims | null): boolean {
  return claims?.active_role === 'student';
}
