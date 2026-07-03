"use client";

import React, { useState } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchStudents, fetchPendingStudentInvites } from "../../../lib/queries";
import { revokeMembership } from "../../../lib/mutations";
import { stepUpMfa } from "../../../lib/mfa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";
import InviteModal from "../../../components/auth/InviteModal";

export default function CoreTeamStudentsPage() {
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // Queries
  const { data: students, loading: studentsLoading, refetch: refetchStudents } = useQuery(fetchStudents, [activeOrgId]);
  const { data: pendingInvites, loading: invitesLoading, refetch: refetchInvites } = useQuery(fetchPendingStudentInvites, [activeOrgId]);

  // UI States
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Revocation states
  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeStep, setRevokeStep] = useState<"confirm" | "mfa">("confirm");
  const [revokeMfaCode, setRevokeMfaCode] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

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

  // Revocation Mutation
  const { mutate: executeRevoke, loading: revoking } = useMutation(
    async (id: string, reason: string) => revokeMembership(id, reason),
    {
      onSuccess: () => {
        showToast("Student membership revoked successfully", "success");
        refetchStudents();
        closeRevoke();
      },
      onError: (err) => {
        if (err.message && err.message.includes("MFA_REQUIRED")) {
          setRevokeStep("mfa");
          showToast("MFA authentication required to revoke student access", "warning");
        } else {
          setRevokeError(err.message || "Failed to revoke student access");
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

  // Filtering students
  const filteredStudents = (students ?? []).filter((student: any) => {
    const orgMatches = student.organization_id === activeOrgId;
    const name = student.users?.full_name || "";
    const email = student.users?.email || "";
    const queryMatches =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase());
    const branchMatches = branchFilter === "all" || student.branch === branchFilter;
    
    // Only show active memberships for the registry
    const statusMatches = student.memberships?.status === "active";
    
    return orgMatches && queryMatches && branchMatches && statusMatches;
  });

  // Unique branches for filter dropdown
  const branches = Array.from(new Set((students ?? []).map((s: any) => s.branch).filter(Boolean)));

  const handleCopyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    showToast("Invite URL copied to clipboard!", "success");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Student Directory</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Manage your student cohort enrollment registry, profiles, and campus authorizations.
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
          Add Student
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-200/50 p-1.5 rounded-2xl w-fit border border-gray-250 gap-1.5 shadow-inner">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === "active"
              ? "bg-white text-gray-950 shadow-sm border border-gray-150"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Active Students ({filteredStudents.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === "pending"
              ? "bg-white text-gray-950 shadow-sm border border-gray-150"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Pending Invites ({pendingInvites?.length || 0})
        </button>
      </div>

      {/* Main Board */}
      <Card accentBar>
        {activeTab === "active" ? (
          <>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Enrolled Roster</CardTitle>
                  <CardDescription>
                    Roster of learners currently enrolled in active academy cohorts.
                  </CardDescription>
                </div>
                {/* Search & Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder="Search name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#4A3ABA] outline-none text-gray-900 font-medium"
                    />
                  </div>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs outline-none text-gray-900 font-bold bg-white"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((b: any) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="space-y-4">
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 bg-gray-55 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-500 text-sm font-semibold">No enrolled students found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student: any) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center font-bold text-sm shrink-0">
                              {(student.users?.full_name || student.users?.email || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-sm">
                                {student.users?.full_name || "Enrolling Student"}
                              </div>
                              <div className="text-xs text-gray-500 font-medium">
                                {student.users?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-gray-700">{student.branch || "General"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold text-gray-500">
                            {new Date(student.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openRevokeConfirm(student.memberships?.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Pending Student Invitations</CardTitle>
              <CardDescription>
                Invitations sent to students who have not completed password setup yet. Direct links are provided below for offline registration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitesLoading ? (
                <div className="space-y-4">
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </div>
              ) : !pendingInvites || pendingInvites.length === 0 ? (
                <div className="text-center py-12 bg-gray-55 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-500 text-sm font-semibold">No pending student invites found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email Address</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((invite: any) => (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <span className="font-bold text-gray-800 text-sm">{invite.email}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-400 font-semibold">
                            {new Date(invite.expires_at).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning" size="sm" className="uppercase font-bold tracking-wider text-[9px]">
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyInviteLink(invite.id)}
                          >
                            Copy Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* Invite Modal Overlay */}
      <InviteModal 
        isOpen={isInviteOpen} 
        onClose={() => {
          setIsInviteOpen(false);
          refetchInvites();
        }} 
        orgId={activeOrgId} 
        onSuccess={() => {
          refetchStudents();
          refetchInvites();
        }}
      />

      {/* Revocation Overlay Dialog */}
      {revokingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={!revoking && !revokeLoading ? closeRevoke : undefined} />
          
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-150 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
            
            {revokeStep === "confirm" && (
              <form onSubmit={handleRevokeSubmit} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Revoke Student Access</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">Are you sure you want to disable this student membership? They will lose access to courses and cohorts immediately.</p>
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
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Completed cohort, withdrew from course"
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
                    Revoking student memberships requires security verification. Enter the 6-digit authenticator code.
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
    </div>
  );
}
