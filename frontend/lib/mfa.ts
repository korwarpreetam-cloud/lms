// =====================================================================
// app/mfa-challenge/page.tsx + lib/mfa.ts
// MFA enrollment (one-time, for owner/core_team) and step-up challenge
// (per privileged action). Supabase Auth's native MFA (TOTP) handles
// the crypto; we just wire it to the right moments.
// =====================================================================

// ---- lib/mfa.ts ----
import { createClient } from './auth';

/** Call this once, e.g. from an account settings page, to enroll TOTP. */
export async function enrollTotpMfa() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  // data.totp.qr_code is an SVG data URI -- render it for the user to
  // scan with their authenticator app, then call confirmTotpEnrollment
  // with the 6-digit code they enter.
  return data;
}

export async function confirmTotpEnrollment(factorId: string, code: string) {
  const supabase = createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw verifyError;
}

/**
 * Step-up challenge: called when the user is about to perform a
 * privileged action (revoke a membership, create an invite, etc.) and
 * their current session is only aal1. After this succeeds, their
 * session is aal2 and session_is_mfa() in Postgres will return true.
 */
export async function stepUpMfa(code: string) {
  const supabase = createClient();

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  const totpFactor = factors.totp[0];
  if (!totpFactor) {
    throw new Error('NO_MFA_FACTOR_ENROLLED');
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totpFactor.id,
  });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw verifyError;

  // Session now carries aal2 -- no manual refresh needed, verify()
  // updates the current session in place.
}
