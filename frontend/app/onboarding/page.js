"use client";

import { useRouter } from "next/navigation";
import { createClient } from "../../lib/auth";

export default function OnboardingPage() {
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
        {/* Info Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-50 border border-purple-100 text-[#4A3ABA] mb-6 shadow-md">
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">No Active Organization</h1>
        <p className="mt-3 text-gray-500 text-base leading-relaxed">
          Your account is registered, but it is not linked to any active organization or school. Please check if you received an invitation email, or ask your administrator to add you.
        </p>

        {/* Card */}
        <div className="mt-8 bg-white rounded-3xl p-6 shadow-xl border border-gray-100 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />

          <div className="space-y-3">
            <button
              onClick={() => router.push("/")}
              className="w-full bg-[#4A3ABA] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#3A2A9A] transition-all duration-300 shadow-lg shadow-purple-200"
            >
              Go to Homepage
            </button>
            <button
              onClick={handleSignOut}
              className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-50 transition-all duration-300"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
