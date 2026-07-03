"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { useQuery } from "../../../lib/hooks";
import { fetchCourses } from "../../../lib/queries";

export default function SchoolOperationsPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  const [cohorts, setCohorts] = useState([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [isAddCohortOpen, setIsAddCohortOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: courses } = useQuery(() => fetchCourses(activeOrgId), [activeOrgId]);

  const loadCohorts = async () => {
    if (!activeOrgId) return;
    setLoadingCohorts(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, name, start_date, end_date, status, course_id, courses(name)")
        .eq("organization_id", activeOrgId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setCohorts(data || []);
    } catch (err) {
      showToast(err.message || "Failed to load cohorts", "error");
    } finally {
      setLoadingCohorts(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, [activeOrgId]);

  const handleScheduleCohort = async (e) => {
    e.preventDefault();
    if (!cohortName.trim() || !selectedCourseId) {
      showToast("Cohort name and course are required", "warning");
      return;
    }
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("cohorts")
        .insert({
          organization_id: activeOrgId,
          course_id: selectedCourseId,
          name: cohortName,
          start_date: startDate || null,
          end_date: endDate || null,
          status: "active"
        });

      if (error) throw error;
      showToast("Class batch scheduled successfully!", "success");
      setIsAddCohortOpen(false);
      setCohortName("");
      setSelectedCourseId("");
      setStartDate("");
      setEndDate("");
      loadCohorts();
    } catch (err) {
      showToast(err.message || "Failed to schedule class batch", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard-team")}
            className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">School Operations Planner</h1>
          <p className="text-xs text-gray-550 font-medium">Schedule class batches, allocate courses, and track start/end parameters.</p>
        </div>
        <button
          onClick={() => setIsAddCohortOpen(true)}
          className="text-xs font-bold bg-[#4A3ABA] text-white px-4 py-2.5 rounded-xl hover:bg-[#3A2A9A]"
        >
          Schedule Class Batch +
        </button>
      </div>

      {loadingCohorts ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      ) : cohorts.length === 0 ? (
        <div className="text-xs text-gray-400 py-12 text-center border border-dashed border-gray-255 rounded-3xl bg-white">
          No classroom batches scheduled yet. Click the button above to schedule your first batch!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">{cohort.name}</h3>
                <span className="text-[10px] text-purple-600 font-bold block mt-1">Course: {cohort.courses?.name}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-450 block font-mono">
                  {cohort.start_date ? new Date(cohort.start_date).toLocaleDateString() : "TBD"} –{" "}
                  {cohort.end_date ? new Date(cohort.end_date).toLocaleDateString() : "TBD"}
                </span>
                <span className="inline-block mt-1 text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded uppercase">
                  {cohort.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Cohort Modal */}
      {isAddCohortOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl">
            <form onSubmit={handleScheduleCohort} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Schedule Class Batch</h3>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Batch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swaminarayan Batch 2026"
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Course Allocation</label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 bg-white"
                >
                  <option value="">-- Select Course --</option>
                  {courses?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIsAddCohortOpen(false)} className="text-xs font-bold text-gray-500 border border-gray-200 px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="text-xs font-bold text-white bg-purple-600 px-4 py-2 rounded-xl cursor-pointer" disabled={actionLoading}>
                  {actionLoading ? "Scheduling..." : "Schedule Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
