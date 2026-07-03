"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../../lib/hooks";
import { fetchCourses } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function SchedulesPage() {
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // Query all courses for active school
  const { data: courses, loading: coursesLoading } = useQuery(
    () => fetchCourses(activeOrgId),
    [activeOrgId]
  );

  // Cohort list state
  const [cohorts, setCohorts] = useState([]);
  const [cohortsLoading, setCohortsLoading] = useState(true);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [cohortName, setCohortName] = useState("");
  const [cohortSlug, setCohortSlug] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cohortStatus, setCohortStatus] = useState("active");

  const loadCohorts = async () => {
    if (!activeOrgId) return;
    setCohortsLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, name, slug, start_date, end_date, status, course_id, courses(name)")
        .eq("organization_id", activeOrgId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setCohorts(data || []);
    } catch (err) {
      showToast(err.message || "Failed to load cohorts", "error");
    } finally {
      setCohortsLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, [activeOrgId]);

  const handleCreateCohort = async (e) => {
    e.preventDefault();
    if (!cohortName.trim() || !cohortSlug.trim() || !selectedCourseId) {
      showToast("Cohort name, slug, and course are required", "warning");
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
          slug: cohortSlug,
          start_date: startDate || null,
          end_date: endDate || null,
          status: cohortStatus,
        });

      if (error) throw error;

      showToast("Cohort batch scheduled successfully!", "success");
      setIsAddOpen(false);
      setCohortName("");
      setCohortSlug("");
      setSelectedCourseId("");
      setStartDate("");
      setEndDate("");
      setCohortStatus("active");
      loadCohorts();
    } catch (err) {
      showToast(err.message || "Failed to create cohort", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (cohortId, newStatus) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("cohorts")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", cohortId);

      if (error) throw error;

      showToast(`Batch status updated to ${newStatus}`, "success");
      loadCohorts();
    } catch (err) {
      showToast(err.message || "Failed to update cohort status", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Timetables & Batches</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Schedule active training batches, link courses, and track start/end semester dates.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-3 rounded-xl bg-[#4A3ABA] text-white font-bold text-sm shadow-md hover:bg-[#3A2A9A] transition-all flex items-center gap-2 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Schedule Batch (Cohort)
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-bold">
                  <th className="p-4">Batch Name</th>
                  <th className="p-4">Linked Course</th>
                  <th className="p-4">Semester Dates</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cohortsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-4"><TableRowSkeleton /></td>
                    </tr>
                  ))
                ) : cohorts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-semibold">
                      No cohort batches scheduled in this school context.
                    </td>
                  </tr>
                ) : (
                  cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{c.name}</td>
                      <td className="p-4 text-gray-700 font-semibold">{c.courses?.name || "—"}</td>
                      <td className="p-4 text-gray-500 font-mono text-xs">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : "TBD"} –{" "}
                        {c.end_date ? new Date(c.end_date).toLocaleDateString() : "TBD"}
                      </td>
                      <td className="p-4 font-semibold uppercase text-xs">
                        <span
                          className={
                            c.status === "active"
                              ? "text-green-600"
                              : c.status === "completed"
                              ? "text-gray-400"
                              : "text-blue-500"
                          }
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {c.status !== "active" && (
                          <button
                            onClick={() => handleStatusChange(c.id, "active")}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-all cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        {c.status !== "completed" && (
                          <button
                            onClick={() => handleStatusChange(c.id, "completed")}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                          >
                            Set Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Cohort Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Schedule Class Batch</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Create a new batch, link it to a course structure, and set academic timelines.</p>

            <form onSubmit={handleCreateCohort} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Select Course Structure</label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                >
                  <option value="">-- Choose Course --</option>
                  {coursesLoading ? (
                    <option disabled>Loading courses...</option>
                  ) : (
                    courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Batch / Cohort Name</label>
                <input
                  type="text"
                  required
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  placeholder="e.g. Swaminarayan Batch 1"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Slug URL Identifier</label>
                <input
                  type="text"
                  required
                  value={cohortSlug}
                  onChange={(e) => setCohortSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. swaminarayan-batch-1"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Initial Status</label>
                <select
                  value={cohortStatus}
                  onChange={(e) => setCohortStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-bold"
                >
                  <option value="planning">Planning (Not Started)</option>
                  <option value="active">Active (In Session)</option>
                  <option value="completed">Completed (Archived)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 text-sm font-bold text-white bg-[#4A3ABA] hover:bg-[#3A2A9A] rounded-xl shadow-lg shadow-purple-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Scheduling..." : "Schedule Cohort"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
