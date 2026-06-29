// =====================================================================
// supabase/functions/send-invite/index.ts
// Edge Function: the server-side piece of the invite flow. Calls the
// create_invite RPC (which requires the caller's own MFA'd session --
// pass through their Authorization header, don't use service_role for
// the create_invite call itself, so the RLS/MFA checks in the RPC
// actually apply to the right user). Then uses the Admin API to send
// the actual invite email via Supabase Auth.
//
// WHY THIS NEEDS TO BE SERVER-SIDE:
//   supabase.auth.admin.inviteUserByEmail() requires the service_role
//   key, which must NEVER reach the browser. This function is the only
//   place that key is used, and only for sending the email -- the
//   actual authorization decision (is this caller allowed to invite
//   someone into this org) is still enforced by create_invite's own
//   RLS/MFA checks, called with the USER's token, not service_role.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'MISSING_AUTH' }), { status: 401 });
  }

  const { email, organizationId, roleCode } = await req.json();

  // Client acting AS THE CALLING USER -- this is what makes create_invite's
  // is_admin_in_org() / session_is_mfa() checks evaluate correctly.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: inviteData, error: inviteError } = await userClient.rpc('create_invite', {
    p_email: email,
    p_organization_id: organizationId,
    p_role_code: roleCode,
  });

  if (inviteError) {
    // Surfaces MFA_REQUIRED / NOT_AUTHORIZED / INVALID_ROLE_CODE etc.
    // straight from the RPC -- don't swallow these, the client needs
    // to distinguish "you need to step up MFA" from a generic failure.
    return new Response(JSON.stringify({ error: inviteError.message }), { status: 403 });
  }

  const { raw_token } = inviteData[0];

  // ONLY here, server-side, do we touch service_role -- to actually
  // deliver the invite email via Supabase's hosted auth email templates.
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const redirectUrl = `${Deno.env.get('PUBLIC_SITE_URL')}/accept-invite?token=${raw_token}`;

  const { error: sendError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl,
  });

  if (sendError) {
    return new Response(JSON.stringify({ error: sendError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
