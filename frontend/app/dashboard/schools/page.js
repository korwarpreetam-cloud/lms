"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../../lib/hooks";
import { fetchOrganizations } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";

export default function SchoolsPage() {
  const { claims, switchOrg } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // Queries
  const { data: schools, loading: schoolsLoading, refetch } = useQuery(fetchOrganizations);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  // Selected school for edit/deactivate
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Form states
  const [schoolName, setSchoolName] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { data: newOrgId, error } = await supabase.rpc('create_organization', {
        p_name: schoolName,
        p_slug: schoolSlug
      });

      if (error) throw error;

      showToast("School created successfully!", "success");
      setIsCreateOpen(false);
      setSchoolName("");
      setSchoolSlug("");
      refetch();

      if (newOrgId) {
        showToast("Switching to new school...", "info");
        await switchOrg(newOrgId);
      }
    } catch (err) {
      showToast(err.message || "Failed to create school", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSchool = async (e) => {
    e.preventDefault();
    if (!selectedSchool) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: editName, updated_at: new Date().toISOString() })
        .eq('id', selectedSchool.id);

      if (error) throw error;

      showToast("School name updated successfully!", "success");
      setIsEditOpen(false);
      setSelectedSchool(null);
      setEditName("");
      refetch();

      if (selectedSchool.id === activeOrgId) {
        await switchOrg(activeOrgId);
      }
    } catch (err) {
      showToast(err.message || "Failed to edit school", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateSchool = async () => {
    if (!selectedSchool) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', selectedSchool.id);

      if (error) throw error;

      showToast("School deactivated successfully", "success");
      setIsDeactivateOpen(false);
      setSelectedSchool(null);
      refetch();

      if (selectedSchool.id === activeOrgId) {
        const otherOrg = claims?.memberships?.find(m => m.org_id !== activeOrgId);
        if (otherOrg) {
          await switchOrg(otherOrg.org_id);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      showToast(err.message || "Failed to deactivate school", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSwitch = async (orgId) => {
    try {
      showToast("Switching school context...", "info");
      await switchOrg(orgId);
      showToast("Context switched successfully", "success");
    } catch (err) {
      showToast(err.message || "Failed to switch organization", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">School Management</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Create and edit academy branches, deactivate inactive schools, and switch active organization contexts.
          </p>
        </div>
        <button
          onClick={() => {
            setSchoolName("");
            setSchoolSlug("");
            setIsCreateOpen(true);
          }}
          className="bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] transition-all px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create School
        </button>
      </div>

      {/* Schools Cards Grid */}
      {schoolsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-48">
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/3 mb-6" />
              <div className="h-10 bg-gray-150 rounded w-full" />
            </div>
          ))}
        </div>
      ) : !schools || schools.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-250 max-w-xl mx-auto shadow-sm">
          <p className="text-gray-500 text-sm font-semibold">No schools registered on the platform yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schools.map((school) => {
            const isActive = school.id === activeOrgId;
            return (
              <div
                key={school.id}
                className={`bg-white rounded-3xl p-6 border-2 transition-all shadow-sm flex flex-col justify-between h-52 relative ${
                  isActive ? "border-[#4A3ABA] shadow-purple-50 shadow-md" : "border-gray-100 hover:border-gray-200"
                }`}
              >
                {isActive && (
                  <div className="absolute top-4 right-4 bg-[#4A3ABA]/10 text-[#4A3ABA] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#4A3ABA]/20">
                    Active Context
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate pr-20">{school.name}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-1">/{school.slug}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${school.is_active ? "bg-green-500" : "bg-red-400"}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      {school.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {isActive ? (
                    <button
                      disabled
                      className="flex-1 py-2 px-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold uppercase cursor-not-allowed text-center"
                    >
                      Selected
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitch(school.id)}
                      disabled={!school.is_active}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase text-center transition-all ${
                        school.is_active
                          ? "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
                          : "bg-gray-100 text-gray-450 cursor-not-allowed"
                      }`}
                    >
                      Switch
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setSelectedSchool(school);
                      setEditName(school.name);
                      setIsEditOpen(true);
                    }}
                    className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-gray-900 cursor-pointer transition-all"
                    title="Rename School"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSchool(school);
                      setIsDeactivateOpen(true);
                    }}
                    disabled={!school.is_active}
                    className={`p-2 border rounded-xl transition-all ${
                      school.is_active
                        ? "border-rose-100 text-rose-500 hover:bg-rose-50 cursor-pointer"
                        : "border-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                    title="Deactivate School"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create School Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]" />
            <form onSubmit={handleCreateSchool} className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Create School</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Add a new organization/school to the Solutiions LMS platform.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-650 uppercase tracking-wider mb-2">School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swaminarayan Academy"
                    value={schoolName}
                    onChange={(e) => {
                      setSchoolName(e.target.value);
                      setSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-650 uppercase tracking-wider mb-2">Slug (URL identifier)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. swaminarayan"
                    value={schoolSlug}
                    onChange={(e) => setSchoolSlug(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#4A3ABA] hover:bg-[#3A2A9A] rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating..." : "Create School"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsEditOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#4A3ABA]" />
            <form onSubmit={handleEditSchool} className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Rename School</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Update the name of the school.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-650 uppercase tracking-wider mb-2">School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swaminarayan Academy"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#4A3ABA] hover:bg-[#3A2A9A] rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate School Modal */}
      {isDeactivateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsDeactivateOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Deactivate School</h3>
                <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
                  Are you sure you want to deactivate <span className="font-bold text-gray-900">{selectedSchool?.name}</span>? 
                  This will temporarily disable access to all courses, classrooms, and rosters under this school branch.
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeactivateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:text-gray-900 cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateSchool}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Deactivating..." : "Deactivate School"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
