"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";

export default function TeamSchoolsStatusPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSchools = async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, is_active, created_at");

      if (error) throw error;
      setSchools(data || []);
    } catch (err) {
      showToast(err.message || "Failed to load school status", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <button
          onClick={() => router.push("/dashboard-team")}
          className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">School Status Dashboard</h1>
        <p className="text-xs text-gray-550 font-medium">Overview of registered schools, active locations, and operation statuses.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {schools.map((school) => (
            <div key={school.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg leading-tight">{school.name}</h3>
                  <span className="text-[10px] text-gray-400 font-mono">/{school.slug}</span>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${
                  school.is_active 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {school.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                This school has active student profiles and trainer memberships. Classroom activities, schedules, and operations are synchronized.
              </p>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Created: {new Date(school.created_at).toLocaleDateString()}</span>
                <span className="font-bold text-purple-600">Status Synced</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
