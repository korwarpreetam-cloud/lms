"use client";

import React, { useState } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchMembers } from "../../../lib/queries";
import { revokeMembership, updateMemberRole } from "../../../lib/mutations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";
import InviteModal from "../../../components/auth/InviteModal";

export default function TeamPage() {
  const { user, claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // Fetch team members list
  const { data: members, loading, refetch } = useQuery(fetchMembers, [activeOrgId]);

  // Tab state: "core" vs "trainers"
  const [activeSubTab, setActiveSubTab] = useState<"core" | "trainers">("core");

  // Selection states
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Edit / Revoke Actions state
  const [newRoleId, setNewRoleId] = useState<number>(3);
  const [actionLoading, setActionLoading] = useState(false);

  // Update role
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);
    try {
      await updateMemberRole(selectedMember.id, newRoleId);
      showToast("Member role updated successfully!", "success");
      refetch();
      setSelectedMember(null);
    } catch (err: any) {
      showToast(err.message || "Failed to update role", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke membership
  const handleRevoke = async () => {
    if (!selectedMember) return;
    if (confirm("Are you sure you want to revoke access?")) {
      setActionLoading(true);
      try {
        await revokeMembership(selectedMember.id, "Revoked by Owner");
        showToast("Membership revoked successfully", "success");
        refetch();
        setSelectedMember(null);
      } catch (err: any) {
        showToast(err.message || "Failed to revoke membership", "error");
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Filter members
  const coreTeamMembers = (members || []).filter(m => m.roles?.code === "core_team" || m.roles?.code === "owner");
  const trainerMembers = (members || []).filter(m => m.roles?.code === "trainer");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Core Team & Trainers</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Manage administrative core team roles and assigned training personnel.
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => setIsInviteOpen(true)}
          leftIcon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          }
        >
          Invite Member
        </Button>
      </div>

      {/* Divided Sections Tab switcher */}
      <div className="flex gap-4 border-b border-gray-150 pb-2">
        <button
          onClick={() => setActiveSubTab("core")}
          className={`pb-2 text-sm font-black transition-all relative ${
            activeSubTab === "core" ? "text-purple-700" : "text-gray-400 hover:text-gray-650"
          }`}
        >
          Core Team List ({coreTeamMembers.length})
          {activeSubTab === "core" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
        </button>
        <button
          onClick={() => setActiveSubTab("trainers")}
          className={`pb-2 text-sm font-black transition-all relative ${
            activeSubTab === "trainers" ? "text-purple-700" : "text-gray-400 hover:text-gray-650"
          }`}
        >
          Trainers Directory ({trainerMembers.length})
          {activeSubTab === "trainers" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
        </button>
      </div>

      {/* Directory Board */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-4">
              <TableRowSkeleton />
              <TableRowSkeleton />
            </div>
          ) : (activeSubTab === "core" ? coreTeamMembers : trainerMembers).length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">No active members found in this category.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeSubTab === "core" ? coreTeamMembers : trainerMembers).map(member => (
                <button
                  key={member.id}
                  onClick={() => {
                    setSelectedMember(member);
                    setNewRoleId(member.role_id);
                  }}
                  className="text-left w-full p-4 bg-gray-50 hover:bg-purple-50/20 border border-gray-150 hover:border-purple-600 rounded-2xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                      {(member.users?.full_name || member.users?.email || "?").charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-gray-905 block text-xs truncate max-w-[150px]">{member.users?.full_name || "Seeded User"}</span>
                      <span className="text-[10px] text-gray-400 block font-mono truncate max-w-[150px]">{member.users?.email}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 group-hover:underline">View details →</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dynamic Member Details Drawer/Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl space-y-4 relative animate-fade-in">
            <h3 className="text-lg font-black text-gray-900">Member Details & Scope</h3>
            
            <div className="space-y-2 p-3 bg-gray-50 rounded-2xl border border-gray-150 text-xs">
              <div>
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Full Name</span>
                <span className="font-bold text-gray-850">{selectedMember.users?.full_name || "Seeded User"}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Email Address</span>
                <span className="font-mono text-gray-850">{selectedMember.users?.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Access Status</span>
                <span className="inline-block bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase mt-0.5">{selectedMember.status}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Adjust Role</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none"
                >
                  <option value={1}>Owner (All Access)</option>
                  <option value={2}>Core Team (Operations)</option>
                  <option value={3}>Trainer (Instruction)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedMember(null)}>Close</Button>
                <Button type="button" variant="danger" onClick={handleRevoke} disabled={actionLoading}>Revoke Access</Button>
                <Button type="submit" variant="primary" isLoading={actionLoading}>Update Role</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal Overlay */}
      <InviteModal 
        isOpen={isInviteOpen} 
        onClose={() => setIsInviteOpen(false)} 
        orgId={activeOrgId} 
        onSuccess={refetch}
      />
    </div>
  );
}
