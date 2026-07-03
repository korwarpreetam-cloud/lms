import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const requestCookies = request.cookies;
    
    // 1. Create a Supabase server client using the caller's request cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return requestCookies.getAll();
          },
          setAll(cookiesToSet) {
            // Read-only context for auth verification, no need to write back cookies
          },
        },
      }
    );

    // 2. Retrieve session and verify owner claim
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const accessToken = session.access_token;
    let activeRole: string | null = null;
    if (accessToken) {
      try {
        const base64 = accessToken.split('.')[1];
        const json = Buffer.from(base64, 'base64').toString('utf-8');
        const payload = JSON.parse(json);
        activeRole = payload.app_metadata?.active_role ?? null;
      } catch (err) {
        console.error('Failed to parse active_role from token', err);
      }
    }

    if (activeRole !== 'owner' && activeRole !== 'trainer') {
      return NextResponse.json({ error: 'Unauthorized: Only platform owners or trainers can provision users' }, { status: 403 });
    }

    // 3. Parse input body
    const body = await request.json();
    const { email, password, fullName, roleCode, organizationId, branch } = body;

    if (activeRole === 'trainer' && roleCode !== 'student') {
      return NextResponse.json({ error: 'Unauthorized: Trainers are only permitted to provision student accounts' }, { status: 403 });
    }

    if (!email || !password || !fullName || !roleCode || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 4. Create Service Role client to call Admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 5. Check if role exists and resolve its ID
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('code', roleCode)
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: `Invalid role code: ${roleCode}` }, { status: 400 });
    }

    // 6. Create the auth user directly without email verification
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createError || !user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create auth user' }, { status: 400 });
    }

    // 7. Update public.users table full_name
    await supabaseAdmin
      .from('users')
      .update({ full_name: fullName })
      .eq('id', user.id);

    // 8. Create active membership in target organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_memberships')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        role_id: roleData.id,
        status: 'active'
      })
      .select('id')
      .single();

    if (membershipError || !membership) {
      // Clean up newly created user on failure to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: membershipError?.message || 'Failed to assign organization membership' }, { status: 400 });
    }

    // 9. Create student profile if role is student
    if (roleCode === 'student') {
      const { error: profileError } = await supabaseAdmin
        .from('student_profiles')
        .insert({
          membership_id: membership.id,
          user_id: user.id,
          organization_id: organizationId,
          branch: branch || 'Main Campus'
        });

      if (profileError) {
        // Clean up created entities
        await supabaseAdmin.from('organization_memberships').delete().eq('id', membership.id);
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        return NextResponse.json({ error: profileError.message || 'Failed to create student profile' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, userId: user.id });

  } catch (err: any) {
    console.error('User creation exception:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
