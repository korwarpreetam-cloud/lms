"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../../lib/hooks";
import { fetchMembers } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function TrainersPage() {
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // Fetch all members
  const { data: members, loading: membersLoading, refetch: refetchMembers } = useQuery(
    () => fetchMembers(activeOrgId),
    [activeOrgId]
  );

  const trainers = (members ?? []).filter((m) => m.roles?.code === "trainer");

  // Fetch Cohorts for active organization
  const [cohorts, setCohorts] = useState([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  const loadCohorts = async () => {
    if (!activeOrgId) return;
    setCohortsLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, name, courses(name)")
        .eq("organization_id", activeOrgId);
      if (error) throw error;
      setCohorts(data || []);
    } catch (err) {
      console.error("Failed to load cohorts:", err.message);
    } finally {
      setCohortsLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, [activeOrgId]);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Add Trainer form state
  const [trainerName, setTrainerName] = useState("");
  const [trainerEmail, setTrainerEmail] = useState("");
  const [trainerPassword, setTrainerPassword] = useState("password123");

  // Assign Trainer form state
  const [selectedTrainerMemId, setSelectedTrainerMemId] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [isLead, setIsLead] = useState(false);

  const handleAddTrainer = async (e) => {
    e.preventDefault();
    if (!trainerName.trim() || !trainerEmail.trim() || !trainerPassword.trim()) {
      showToast("All fields are required", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trainerEmail,
          password: trainerPassword,
          fullName: trainerName,
          roleCode: "trainer",
          organizationId: activeOrgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create trainer");

      showToast("Trainer account provisioned successfully!", "success");
      setIsAddOpen(false);
      setTrainerName("");
      setTrainerEmail("");
      setTrainerPassword("password123");
      refetchMembers();
    } catch (err) {
      showToast(err.message || "Failed to add trainer", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTrainer = async (e) => {
    e.preventDefault();
    if (!selectedTrainerMemId || !selectedCohortId) {
      showToast("Trainer and Cohort/Batch are required", "warning");
      return;
    }
    setActionLoading(true);
    const supabase = createClient();
    try {
      // Check if already assigned
      const { data: existing } = await supabase
        .from("cohort_trainers")
        .select("id")
        .eq("cohort_id", selectedCohortId)
        .eq("membership_id", selectedTrainerMemId)
        .is("unassigned_at", null)
        .maybeSingle();

      if (existing) {
        throw new Error("This trainer is already active in the selected cohort");
      }

      const { error } = await supabase
        .from("cohort_trainers")
        .insert({
          cohort_id: selectedCohortId,
          membership_id: selectedTrainerMemId,
          is_lead: isLead,
        });

      if (error) throw error;

      showToast("Trainer assigned to batch successfully!", "success");
      setIsAssignOpen(false);
      setSelectedTrainerMemId("");
      setSelectedCohortId("");
      setIsLead(false);
    } catch (err) {
      showToast(err.message || "Failed to assign trainer", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Trainer Registry</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Register professional trainers, assign them to teaching cohorts, and manage workloads.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAssignOpen(true)}
            className="px-5 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            Assign to Batch
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-3 rounded-xl bg-[#4A3ABA] text-white font-bold text-sm shadow-md hover:bg-[#3A2A9A] transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add New Trainer
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-bold">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {membersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className="p-4"><TableRowSkeleton /></td>
                    </tr>
                  ))
                ) : trainers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500 font-semibold">
                      No trainers found in this school context. Register one to get started!
                    </td>
                  </tr>
                ) : (
                  trainers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{t.users?.full_name || "—"}</td>
                      <td className="p-4 text-gray-550">{t.users?.email || "—"}</td>
                      <td className="p-4">
                        <Badge variant="success">Active</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Trainer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Add New Trainer</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Provision a new trainer account. They will be added to auth and linked as a member.</p>

            <form onSubmit={handleAddTrainer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Trainer Full Name</label>
                <input
                  type="text"
                  required
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  placeholder="e.g. Dr. John Doe"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={trainerEmail}
                  onChange={(e) => setTrainerEmail(e.target.value)}
                  placeholder="e.g. johndoe@school.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Default Password</label>
                <input
                  type="text"
                  required
                  value={trainerPassword}
                  onChange={(e) => setTrainerPassword(e.target.value)}
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
                  {actionLoading ? "Provisioning..." : "Add Trainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Batch Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Assign Trainer to Cohort</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Link a trainer to a classroom cohort batch to give them management access.</p>

            <form onSubmit={handleAssignTrainer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Select Trainer</label>
                <select
                  required
                  value={selectedTrainerMemId}
                  onChange={(e) => setSelectedTrainerMemId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                >
                  <option value="">-- Choose Trainer --</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.users?.full_name} ({t.users?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Select Cohort Batch</label>
                <select
                  required
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                >
                  <option value="">-- Choose Batch --</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.courses?.name || "No Course"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="isLead"
                  checked={isLead}
                  onChange={(e) => setIsLead(e.target.checked)}
                  className="w-4 h-4 text-[#4A3ABA] focus:ring-[#4A3ABA]"
                />
                <label htmlFor="isLead" className="text-xs font-semibold text-gray-700 select-none cursor-pointer">
                  Designate as Lead Instructor (Lead Trainer)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 text-sm font-bold text-white bg-[#4A3ABA] hover:bg-[#3A2A9A] rounded-xl shadow-lg shadow-purple-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Assigning..." : "Assign Trainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
