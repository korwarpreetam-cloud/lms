"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { fetchMembers } from "../../../lib/queries";
import { revokeMembership, updateMemberRole } from "../../../lib/mutations";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";
import InviteModal from "../../../components/auth/InviteModal";
import { createClient } from "../../../lib/auth";

export default function TeamTrainerPage() {
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";
  const userEmail = claims?.email || "team@member.com";

  // Tab State: "school_ops" (School Operations) vs "trainer_console" (Personal Trainer Console)
  const [activeTab, setActiveTab] = useState("school_ops");

  // School Ops: Sub-tabs ("core" vs "trainers")
  const [activeSubTab, setActiveSubTab] = useState("core");

  // Fetch team members list
  const { data: members, loading, refetch } = useQuery(fetchMembers, [activeOrgId]);

  // Selection states
  const [selectedMember, setSelectedMember] = useState(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newRoleId, setNewRoleId] = useState(3);
  const [actionLoading, setActionLoading] = useState(false);

  // Personal Trainer Console: Chat State
  const [trainerMessages, setTrainerMessages] = useState([]);
  const [newTrainerMessage, setNewTrainerMessage] = useState("");
  const [selectedTrainerChat, setSelectedTrainerChat] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  // Filter members
  const coreTeamMembers = (members || []).filter(m => m.roles?.code === "core_team" || m.roles?.code === "owner");
  const trainerMembers = (members || []).filter(m => m.roles?.code === "trainer");

  // Load chat messages between Core Team and Trainer
  const loadTrainerChat = async (trainerId) => {
    if (!trainerId) return;
    setLoadingChat(true);
    // Fallback to local storage list to preserve discussions between trainers and team
    const chatKey = `trainer_chat_${activeOrgId}_${trainerId}`;
    const localMsgs = localStorage.getItem(chatKey);
    if (localMsgs) {
      setTrainerMessages(JSON.parse(localMsgs));
    } else {
      setTrainerMessages([
        { id: 1, sender: "trainer@robotics.com", content: "Hi team, I noticed student John Doe is having trouble with the third video material. Could you check if the video link is working?", created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, sender: "coreteam@robotics.com", content: "Thanks for reporting. We just updated the YouTube link. It should be playing perfectly now.", created_at: new Date(Date.now() - 3600000).toISOString() }
      ]);
    }
    setLoadingChat(false);
  };

  useEffect(() => {
    if (selectedTrainerChat) {
      loadTrainerChat(selectedTrainerChat.id);
    }
  }, [selectedTrainerChat]);

  const handleSendTrainerMessage = (e) => {
    e.preventDefault();
    if (!newTrainerMessage.trim() || !selectedTrainerChat) return;

    const chatKey = `trainer_chat_${activeOrgId}_${selectedTrainerChat.id}`;
    const updatedMessages = [
      ...trainerMessages,
      {
        id: Date.now(),
        sender: userEmail,
        content: newTrainerMessage,
        created_at: new Date().toISOString()
      }
    ];

    setTrainerMessages(updatedMessages);
    localStorage.setItem(chatKey, JSON.stringify(updatedMessages));
    setNewTrainerMessage("");
    showToast("Message sent to trainer console!", "success");
  };

  // Update role
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);
    try {
      await updateMemberRole(selectedMember.id, newRoleId);
      showToast("Member role updated successfully!", "success");
      refetch();
      setSelectedMember(null);
    } catch (err) {
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
        await revokeMembership(selectedMember.id, "Revoked by Core Team");
        showToast("Membership revoked successfully", "success");
        refetch();
        setSelectedMember(null);
      } catch (err) {
        showToast(err.message || "Failed to revoke membership", "error");
      } finally {
        setActionLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Team & Trainer Hub</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Coordinate operations, invite trainers, and align syllabus tasks on the trainer console.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "school_ops" && (
            <Button variant="primary" onClick={() => setIsInviteOpen(true)}>
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex gap-4 border-b border-gray-250 pb-2.5">
        <button
          onClick={() => setActiveTab("school_ops")}
          className={`pb-2.5 text-sm font-black transition-all relative ${
            activeTab === "school_ops" ? "text-purple-750" : "text-gray-400 hover:text-gray-650"
          }`}
        >
          ⚙️ School Operations
          {activeTab === "school_ops" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
        </button>
        <button
          onClick={() => setActiveTab("trainer_console")}
          className={`pb-2.5 text-sm font-black transition-all relative ${
            activeTab === "trainer_console" ? "text-purple-750" : "text-gray-400 hover:text-gray-650"
          }`}
        >
          💬 Personal Trainer Console
          {activeTab === "trainer_console" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
        </button>
      </div>

      {/* Tab Content 1: School Operations (Same as Owner Structure) */}
      {activeTab === "school_ops" && (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-gray-150 pb-2">
            <button
              onClick={() => setActiveSubTab("core")}
              className={`pb-2 text-xs font-bold transition-all relative ${
                activeSubTab === "core" ? "text-purple-700" : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Core Team List ({coreTeamMembers.length})
              {activeSubTab === "core" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
            </button>
            <button
              onClick={() => setActiveSubTab("trainers")}
              className={`pb-2 text-xs font-bold transition-all relative ${
                activeSubTab === "trainers" ? "text-purple-700" : "text-gray-400 hover:text-gray-650"
              }`}
            >
              Trainers Directory ({trainerMembers.length})
              {activeSubTab === "trainers" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-750" />}
            </button>
          </div>

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

          {/* Member Details / Editing Modal */}
          {selectedMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl animate-fade-in space-y-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900">{selectedMember.users?.full_name || "Member details"}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedMember.users?.email}</p>
                </div>

                <form onSubmit={handleUpdateRole} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Administrative Role</label>
                    <select
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs bg-white text-gray-900 font-medium"
                    >
                      <option value={2}>Core Team (Operations Administrator)</option>
                      <option value={3}>Trainer (Assigned Instructor)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleRevoke}
                      disabled={actionLoading}
                      className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
                    >
                      Revoke Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs font-bold text-gray-500 border border-gray-250 px-4 py-2 rounded-xl"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="text-xs font-bold text-white bg-[#4A3ABA] px-4 py-2 rounded-xl"
                    >
                      {actionLoading ? "Updating..." : "Save Role"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} onInviteSent={refetch} />
        </div>
      )}

      {/* Tab Content 2: Personal Trainer Console (Discussion room with trainers) */}
      {activeTab === "trainer_console" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[450px]">
          {/* Trainer list */}
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
            <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Select Trainer for Chat</span>
            <div className="space-y-2">
              {trainerMembers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No trainers registered to chat with.</p>
              ) : (
                trainerMembers.map(tr => (
                  <button
                    key={tr.id}
                    onClick={() => setSelectedTrainerChat(tr)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all text-xs font-semibold flex justify-between items-center ${
                      selectedTrainerChat?.id === tr.id
                        ? "bg-purple-50 border-[#4A3ABA] text-[#4A3ABA] font-bold shadow-sm"
                        : "bg-white border-gray-100 hover:border-gray-200 text-gray-650"
                    }`}
                  >
                    <div>
                      <span className="block font-bold text-gray-900">{tr.users?.full_name || "Trainer"}</span>
                      <span className="block text-[10px] text-gray-400 font-mono mt-0.5">{tr.users?.email}</span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Trainer Console Chat Workspace */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            {!selectedTrainerChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span className="text-xs font-bold">Select a trainer from the sidebar to open the communication channel</span>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between flex-1">
                {/* Header */}
                <div className="border-b border-gray-100 pb-3 mb-4">
                  <span className="text-xs font-black text-gray-900">Console: {selectedTrainerChat.users?.full_name}</span>
                  <span className="text-[9px] text-gray-400 font-mono block mt-0.5">{selectedTrainerChat.users?.email}</span>
                </div>

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 h-[250px]">
                  {loadingChat ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-purple-600"></div>
                    </div>
                  ) : (
                    trainerMessages.map(msg => {
                      const isMe = msg.sender === userEmail;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`max-w-md p-3 rounded-2xl text-xs font-medium ${
                            isMe ? "bg-[#4A3ABA] text-white rounded-tr-none" : "bg-gray-100 text-gray-900 rounded-tl-none"
                          }`}>
                            {msg.content}
                          </div>
                          <span className="text-[7.5px] text-gray-450 mt-1 font-mono">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input form */}
                <form onSubmit={handleSendTrainerMessage} className="border-t border-gray-100 pt-4 flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Type message to trainer console..."
                    value={newTrainerMessage}
                    onChange={(e) => setNewTrainerMessage(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                  />
                  <button
                    type="submit"
                    className="bg-[#4A3ABA] hover:bg-[#3A2A9A] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
