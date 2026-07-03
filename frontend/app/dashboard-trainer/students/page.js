"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../../lib/hooks";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { fetchTrainerCohorts, fetchCohortStudents } from "../../../lib/queries";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function TrainerStudentsPage() {
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";
  const { showToast } = useToast();

  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Form & modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("password123");
  const [studentBranch, setStudentBranch] = useState("Swaminarayan Campus");

  // Fetch cohorts for the trainer
  const { data: cohorts, loading: cohortsLoading } = useQuery(
    () => fetchTrainerCohorts(activeOrgId),
    [activeOrgId]
  );

  const loadStudents = async () => {
    if (!selectedCohortId) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    try {
      const data = await fetchCohortStudents(selectedCohortId);
      setStudents(data || []);
    } catch (err) {
      showToast("Failed to fetch students list", "error");
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [selectedCohortId]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedCohortId) {
      showToast("Please select a target cohort batch first", "warning");
      return;
    }
    if (!studentName.trim() || !studentEmail.trim() || !studentPassword.trim()) {
      showToast("All fields are required", "warning");
      return;
    }
    setActionLoading(true);
    const supabase = createClient();
    try {
      // 1. Provision student account
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: studentEmail,
          password: studentPassword,
          fullName: studentName,
          roleCode: "student",
          organizationId: activeOrgId,
          branch: studentBranch,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to provision student user");

      const createdUserId = resData.userId;

      // 2. Fetch the created student profile ID
      const { data: profile, error: profileError } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", createdUserId)
        .single();

      if (profileError || !profile) {
        throw new Error(profileError?.message || "Student profile lookup failed");
      }

      // 3. Enroll student in cohort
      const { error: enrollError } = await supabase
        .from("cohort_students")
        .insert({
          cohort_id: selectedCohortId,
          student_profile_id: profile.id,
          status: "enrolled",
        });

      if (enrollError) throw enrollError;

      showToast("Student registered and enrolled successfully!", "success");
      setIsAddOpen(false);
      setStudentName("");
      setStudentEmail("");
      setStudentPassword("password123");
      loadStudents();
    } catch (err) {
      showToast(err.message || "Failed to add student", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Students Directory</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Browse classroom rosters, view enrollments, and register new student accounts into your classes.
          </p>
        </div>
        {selectedCohortId && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-3 rounded-xl bg-[#4A3ABA] text-white font-bold text-sm shadow-md hover:bg-[#3A2A9A] transition-all flex items-center gap-2 cursor-pointer animate-in fade-in duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Student to Batch
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Cohorts Selection */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Cohorts</label>
          {cohortsLoading ? (
            <div className="space-y-2">
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : !cohorts || cohorts.length === 0 ? (
            <div className="p-4 bg-gray-55 text-center text-xs text-gray-500 rounded-xl border border-dashed border-gray-200">
              No assigned cohorts found.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cohorts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCohortId(c.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all font-semibold cursor-pointer ${
                    selectedCohortId === c.id
                      ? "border-[#4A3ABA] bg-purple-50/20 text-[#4A3ABA]"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-bold">{c.name}</div>
                  <div className="text-xs text-gray-400 font-medium mt-0.5">{c.courses?.name || "Active Course"}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Roster Table */}
        <div className="md:col-span-2">
          {!selectedCohortId ? (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-3xl text-center shadow-sm">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 mb-2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-sm text-gray-450 font-semibold">Select a cohort batch from the left to load student listings.</p>
            </div>
          ) : (
            <Card className="animate-in fade-in duration-200">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-bold">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Campus Branch</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={4} className="p-4"><TableRowSkeleton /></td>
                          </tr>
                        ))
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500 font-semibold">
                            No enrolled students in this cohort batch.
                          </td>
                        </tr>
                      ) : (
                        students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{student.users?.full_name || "Enrolling..."}</td>
                            <td className="p-4 text-gray-550">{student.users?.email || "—"}</td>
                            <td className="p-4 text-gray-500">{student.branch || "Main Campus"}</td>
                            <td className="p-4">
                              <Badge variant="success">Enrolled</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Register Student</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Provision a student account and link them directly to this training cohort batch.</p>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Preetam Korwar"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="e.g. preetam@student.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Default Password</label>
                <input
                  type="text"
                  required
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Branch / Campus Location</label>
                <input
                  type="text"
                  required
                  value={studentBranch}
                  onChange={(e) => setStudentBranch(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
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
                  {actionLoading ? "Registering..." : "Add & Enroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
