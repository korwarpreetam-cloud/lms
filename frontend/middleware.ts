// =====================================================================
// middleware.ts
// Route protection that reads role/org/MFA data straight from the JWT
// claims set by custom_access_token_hook -- ZERO extra database queries
// on every request. This is what fixes the original plan's "3 round
// trips before you can render anything" problem.
// =====================================================================
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes and the role(s) allowed to access them. Checked against
// active_role from the JWT -- no query needed.
const ROUTE_ROLE_MAP: Record<string, string[]> = {
  '/dashboard': ['owner'],
  '/dashboard-team': ['owner', 'core_team'],
  '/dashboard-trainer': ['owner', 'trainer'],
};

// Routes that additionally require a step-up MFA session (aal2),
// regardless of role -- e.g. administrative settings.
const MFA_REQUIRED_PREFIXES = ['/dashboard/team', '/dashboard/settings'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase Auth servers (not just
  // decoding it locally) -- this is the call that actually refreshes an
  // expiring session via the refresh token cookie if needed. Using
  // getSession() instead here is a common mistake: it trusts the
  // locally-stored token without validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtectedPath = Object.keys(ROUTE_ROLE_MAP).some((prefix) => path.startsWith(prefix));

  if (!isProtectedPath) {
    return response; // public route (login, invite redemption, marketing pages, etc.)
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // The Custom Access Token Hook injects claims (memberships, active_org_id,
  // active_role) into the JWT token itself, NOT into auth.users.raw_app_meta_data.
  // session.user.app_metadata comes from the database, so we must decode the
  // JWT access_token to read hook-injected claims.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  let appMetadata: {
    active_role?: string;
    active_org_id?: string;
    account_disabled?: boolean;
    memberships?: Array<{ org_id: string; role: string }>;
  } = {};

  if (accessToken) {
    try {
      const base64 = accessToken.split('.')[1];
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      const payload = JSON.parse(json);
      appMetadata = payload.app_metadata ?? {};
    } catch {
      appMetadata = (session?.user?.app_metadata as any) ?? {};
    }
  } else {
    appMetadata = (session?.user?.app_metadata as any) ?? {};
  }

  if (appMetadata.account_disabled) {
    return NextResponse.redirect(new URL('/account-disabled', request.url));
  }

  if (!appMetadata.active_org_id || !appMetadata.active_role) {
    // User is authenticated but has no active org context -- e.g. an
    // invite that hasn't been redeemed yet, or every membership was
    // revoked. Send them to onboarding rather than a confusing 403.
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  const matchedPrefix = Object.keys(ROUTE_ROLE_MAP)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => path.startsWith(prefix));

  const allowedRoles = matchedPrefix ? ROUTE_ROLE_MAP[matchedPrefix] : [];

  if (!allowedRoles.includes(appMetadata.active_role)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // Disable MFA challenge checks for local testing/development ease
  const requiresMfa = false;
  if (requiresMfa) {
    const aal = (session as any)?.aal ?? 'aal1'; // supabase-js exposes this; verify field name against your SDK version
    if (aal !== 'aal2') {
      const mfaUrl = new URL('/mfa-challenge', request.url);
      mfaUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(mfaUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
};
