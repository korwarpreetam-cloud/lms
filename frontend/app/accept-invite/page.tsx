// =====================================================================
// app/accept-invite/page.tsx
// User lands here from the invite email link (?token=...), is prompted
// to set a password (Supabase Auth's own invite flow already
// authenticated them at this point -- inviteUserByEmail signs them in
// via the magic link), then we call redeem_invite to actually create
// their membership.
// =====================================================================
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '../../lib/auth';

function AcceptInvite() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      // At this point Supabase Auth has already established a session
      // from the invite link's magic token. We just need to set their
      // chosen password.
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      if (!token) {
        throw new Error('Missing invite token in URL.');
      }

      const { error: redeemError } = await supabase.rpc('redeem_invite', {
        p_raw_token: token,
      });
      if (redeemError) {
        // INVITE_NOT_FOUND / INVITE_EXPIRED / INVITE_ALREADY_USED_OR_REVOKED
        // / INVITE_EMAIL_MISMATCH
        throw redeemError;
      }

      // CRITICAL: refresh the session so the new membership shows up
      // in app_metadata. Without this, the user appears to have no
      // role until their token naturally expires/refreshes later.
      await supabase.auth.refreshSession();

      router.push('/'); // root route/middleware inspects claims and redirects to the right dashboard
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong accepting the invite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-6">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#4A3ABA]/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#F5A623]/5" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#4A3ABA]/3" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-11 h-11 rounded-xl bg-[#4A3ABA] flex items-center justify-center shadow-lg shadow-purple-200">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              solutions<span className="text-[#4A3ABA]">.com</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Activate Account</h1>
          <p className="mt-2 text-gray-500">Set your password to redeem your invite</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password-input"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Choose Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 text-base"
                  minLength={8}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1" role="alert">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="w-full btn-shine bg-[#4A3ABA] text-white py-4 rounded-xl font-semibold text-base hover:bg-[#3A2A9A] transition-all duration-300 shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Activating Account...
                </>
              ) : (
                <>
                  Accept Invite & Login
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="text-center text-gray-500 font-semibold">Loading invite...</div>
      </main>
    }>
      <AcceptInvite />
    </Suspense>
  );
}
