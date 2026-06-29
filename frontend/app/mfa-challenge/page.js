"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { stepUpMfa } from "../../lib/mfa";

function MfaChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await stepUpMfa(code);
      router.push(redirect);
    } catch (err) {
      if (err.message === "NO_MFA_FACTOR_ENROLLED") {
        setError("No Multi-Factor Authentication factor is enrolled for this account. Please enroll first in your dashboard settings.");
      } else {
        setError(err.message ?? "Invalid MFA verification code. Please try again.");
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-6">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#4A3ABA]/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#F5A623]/5" />
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
          <h1 className="text-3xl font-bold text-gray-900">Security Step-up</h1>
          <p className="mt-2 text-gray-500">Enter your 6-digit authenticator code</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="code-input"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Verification Code
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
                  id="code-input"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="000000"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 text-base text-center tracking-widest text-lg font-bold"
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
              disabled={isLoading || code.length !== 6}
              className="w-full btn-shine bg-[#4A3ABA] text-white py-4 rounded-xl font-semibold text-base hover:bg-[#3A2A9A] transition-all duration-300 shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
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
                  Verifying...
                </>
              ) : (
                <>
                  Verify Code
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

export default function MfaChallengePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="text-center text-gray-500 font-semibold">Loading authentication...</div>
      </main>
    }>
      <MfaChallenge />
    </Suspense>
  );
}
