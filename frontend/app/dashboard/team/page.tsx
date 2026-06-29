"use client";

import React, { useState } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchMembers } from "../../../lib/queries";
import { revokeMembership, updateMemberRole } from "../../../lib/mutations";
import { stepUpMfa } from "../../../lib/mfa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
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
  
  // Dialogs & Modal states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  // Revocation states
  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeStep, setRevokeStep] = useState<"confirm" | "mfa">("confirm");
  const [revokeMfaCode, setRevokeMfaCode] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Edit role states
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [newRoleId, setNewRoleId] = useState<number>(3); // 1 = owner, 2 = core_team, 3 = trainer
  const [editStep, setEditStep] = useState<"form" | "mfa">("form");
  const [editMfaCode, setEditMfaCode] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditRole = (member: any) => {
    setEditingMember(member);
    setNewRoleId(member.role_id);
    setEditStep("form");
    setEditMfaCode("");
    setEditError(null);
  };

  const closeEditRole = () => {
    setEditingMember(null);
    setEditStep("form");
    setEditMfaCode("");
    setEditError(null);
  };

  // Mutation helper for updating roles
  const { mutate: executeUpdateRole, loading: updatingRole } = useMutation(
    async (params: { id: string; roleId: number }) => updateMemberRole(params.id, params.roleId),
    {
      onSuccess: () => {
        showToast("Member role updated successfully", "success");
        refetch();
        closeEditRole();
      },
      onError: (err) => {
        if (err.message && err.message.includes("MFA_REQUIRED")) {
          setEditStep("mfa");
          showToast("MFA authentication required to change roles", "warning");
        } else {
          setEditError(err.message || "Failed to update role");
          showToast(err.message || "Role update failed", "error");
        }
      }
    }
  );

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    await executeUpdateRole({ id: editingMember.id, roleId: newRoleId });
  };

  const handleEditMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setEditLoading(true);
    setEditError(null);

    try {
      await stepUpMfa(editMfaCode);
      showToast("MFA verified, updating role...", "info");
      await executeUpdateRole({ id: editingMember.id, roleId: newRoleId });
    } catch (err: any) {
      setEditError(err.message || "MFA validation failed");
      showToast(err.message || "MFA validation failed", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const openRevokeConfirm = (membershipId: string) => {
    setRevokingMemberId(membershipId);
    setRevokeReason("");
    setRevokeStep("confirm");
    setRevokeMfaCode("");
    setRevokeError(null);
  };

  const closeRevoke = () => {
    setRevokingMemberId(null);
    setRevokeReason("");
    setRevokeStep("confirm");
    setRevokeMfaCode("");
    setRevokeError(null);
  };

  // Mutation helper for revoking memberships
  const { mutate: executeRevoke, loading: revoking } = useMutation(
    async (id: string, reason: string) => revokeMembership(id, reason),
    {
      onSuccess: () => {
        showToast("Membership revoked successfully", "success");
        refetch();
        closeRevoke();
      },
      onError: (err) => {
        if (err.message && err.message.includes("MFA_REQUIRED")) {
          setRevokeStep("mfa");
          showToast("MFA authentication required for this action", "warning");
        } else {
          setRevokeError(err.message || "Failed to revoke membership");
          showToast(err.message || "Revocation failed", "error");
        }
      }
    }
  );

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingMemberId) return;
    await executeRevoke(revokingMemberId, revokeReason);
  };

  const handleRevokeMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingMemberId) return;

    setRevokeLoading(true);
    setRevokeError(null);

    try {
      await stepUpMfa(revokeMfaCode);
      showToast("MFA verified, retrying revocation...", "info");
      
      await executeRevoke(revokingMemberId, revokeReason);
    } catch (err: any) {
      setRevokeError(err.message || "MFA validation failed");
      showToast(err.message || "MFA validation failed", "error");
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Core Team & Trainers</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Manage your administration core team and trainers memberships inside this school tenant.
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

      {/* Members Board */}
      <Card accentBar>
        <CardHeader>
          <CardTitle>Team Directory</CardTitle>
          <CardDescription>
            List of members authorized to access administrative panels and student classrooms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </div>
          ) : !members || members.filter(m => m.roles?.code !== 'student').length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-250">
              <p className="text-gray-500 text-sm font-semibold">No active team memberships found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Details</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.filter(m => m.roles?.code !== 'student').map((member) => {
                  const isSelf = member.user_id === user?.id;
                  
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center font-bold text-sm shrink-0">
                            {(member.users.full_name || member.users.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">
                              {member.users.full_name || "Invited User"}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              {member.users.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            member.roles.code === "owner" 
                              ? "danger" 
                              : member.roles.code === "core_team"
                              ? "primary"
                              : "secondary"
                          } 
                          size="sm"
                          className="font-bold uppercase tracking-wider text-[9px]"
                        >
                          {member.roles.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" size="sm" className="capitalize">
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2 font-sans">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => openEditRole(member)}
                          title={isSelf ? "You cannot change your own role" : "Edit member role"}
                        >
                          Edit Role
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => openRevokeConfirm(member.id)}
                          title={isSelf ? "You cannot revoke your own membership" : "Revoke membership access"}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal Overlay */}
      <InviteModal 
        isOpen={isInviteOpen} 
        onClose={() => setIsInviteOpen(false)} 
        orgId={activeOrgId} 
        onSuccess={refetch}
      />

      {/* Revocation Overlay Dialog */}
      {revokingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={!revoking && !revokeLoading ? closeRevoke : undefined} />
          
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
            
            {revokeStep === "confirm" && (
              <form onSubmit={handleRevokeSubmit} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Revoke Access</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">Are you sure you want to disable this member? They will lose access immediately.</p>
                </div>

                {revokeError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{revokeError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Reason for Revocation (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Contract terminated, role reassigned"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-gray-900 transition-all font-medium"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={closeRevoke} disabled={revoking}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" isLoading={revoking}>
                    Revoke Member
                  </Button>
                </div>
              </form>
            )}

            {revokeStep === "mfa" && (
              <form onSubmit={handleRevokeMfaSubmit} className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                    <svg className="w-8 h-8 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Step-up MFA Required</h3>
                  <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
                    Revoking memberships requires step-up security validation. Enter the 6-digit authenticator code to proceed.
                  </p>
                </div>

                {revokeError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{revokeError}</span>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    value={revokeMfaCode}
                    onChange={(e) => setRevokeMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-rose-500 outline-none text-gray-900 text-center tracking-widest text-xl font-bold"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setRevokeStep("confirm")} disabled={revokeLoading}>
                    Back
                  </Button>
                  <Button type="submit" variant="danger" className="flex-1" isLoading={revokeLoading} disabled={revokeMfaCode.length !== 6}>
                    Verify & Submit
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Role Overlay Dialog */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={!updatingRole && !editLoading ? closeEditRole : undefined} />
          
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-150 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]" />
            
            {editStep === "form" && (
              <form onSubmit={handleEditRoleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Edit Member Role</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    Update the platform authorization level for <span className="font-bold text-gray-900">{editingMember.users?.full_name || editingMember.users?.email}</span>.
                  </p>
                </div>

                {editError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{editError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Select Role</label>
                  <select
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-semibold capitalize"
                  >
                    <option value={1}>Owner (Full Access)</option>
                    <option value={2}>Core Team (Operations)</option>
                    <option value={3}>Trainer (Instructor)</option>
                  </select>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={closeEditRole} disabled={updatingRole}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isLoading={updatingRole}>
                    Update Role
                  </Button>
                </div>
              </form>
            )}

            {editStep === "mfa" && (
              <form onSubmit={handleEditMfaSubmit} className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                    <svg className="w-8 h-8 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Step-up MFA Required</h3>
                  <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
                    Modifying team roles requires step-up security validation. Enter the 6-digit authenticator code to proceed.
                  </p>
                </div>

                {editError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{editError}</span>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    value={editMfaCode}
                    onChange={(e) => setEditMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-[#4A3ABA] outline-none text-gray-900 text-center tracking-widest text-xl font-bold"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditStep("form")} disabled={editLoading}>
                    Back
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1" isLoading={editLoading} disabled={editMfaCode.length !== 6}>
                    Verify & Submit
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
