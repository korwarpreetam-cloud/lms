"use client";

import { useRouter } from "next/navigation";
import { createClient } from "../../lib/auth";

export default function AccountDisabledPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-6">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#4A3ABA]/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#F5A623]/5" />
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Disabled Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border border-red-100 text-red-500 mb-6 shadow-md">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Account Deactivated</h1>
        <p className="mt-3 text-gray-500 text-base leading-relaxed">
          Your account has been deactivated or disabled by an administrator. If you believe this is a mistake, please contact support or your organization manager.
        </p>

        {/* Card */}
        <div className="mt-8 bg-white rounded-3xl p-6 shadow-xl border border-gray-100 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full bg-[#4A3ABA] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#3A2A9A] transition-all duration-300 shadow-lg shadow-purple-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
