"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { createClient } from "../../lib/auth";

export default function TeamDashboardPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";
  const userEmail = claims?.email || "team@member.com";
  const userRole = claims?.active_role || "core_team";

  // Trainer Console States
  const [trainerMessages, setTrainerMessages] = useState([]);
  const [newTrainerMsg, setNewTrainerMsg] = useState("");
  const [loadingTrainerMsgs, setLoadingTrainerMsgs] = useState(false);
  const [sendingTrainerMsg, setSendingTrainerMsg] = useState(false);
  const [schoolsCount, setSchoolsCount] = useState(0);

  const fetchStats = async () => {
    const supabase = createClient();
    try {
      const { count } = await supabase
        .from("organizations")
        .select("id", { count: "exact", head: true });
      setSchoolsCount(count || 0);
    } catch (err) {
      console.warn("Error fetching stats:", err.message);
    }
  };

  const loadTrainerMessages = async () => {
    setLoadingTrainerMsgs(true);
    const localMsgs = localStorage.getItem(`trainer_coordination_${activeOrgId}`);
    if (localMsgs) {
      setTrainerMessages(JSON.parse(localMsgs));
    } else {
      setTrainerMessages([
        { id: 1, sender: "trainer@robotics.com", role: "trainer", content: "Hi Core Team, I noticed that Chapter 2 is missing the Lab PDF manual. Could you upload it?", created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, sender: "team@robotics.com", role: "core_team", content: "Sure, we are uploading it under PDF materials right now.", created_at: new Date(Date.now() - 3600000).toISOString() }
      ]);
    }
    setLoadingTrainerMsgs(false);
  };

  useEffect(() => {
    if (activeOrgId) {
      fetchStats();
      loadTrainerMessages();
    }
  }, [activeOrgId]);

  const handleSendTrainerMessage = (e) => {
    e.preventDefault();
    if (!newTrainerMsg.trim()) return;
    setSendingTrainerMsg(true);

    const newMsg = {
      id: Date.now(),
      sender: userEmail,
      role: userRole,
      content: newTrainerMsg,
      created_at: new Date().toISOString()
    };

    const updated = [...trainerMessages, newMsg];
    setTrainerMessages(updated);
    localStorage.setItem(`trainer_coordination_${activeOrgId}`, JSON.stringify(updated));
    setNewTrainerMsg("");
    setSendingTrainerMsg(false);
    showToast("Message sent to trainer board!", "success");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-purple-950 rounded-3xl p-8 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full uppercase tracking-wider">
            Operations Center
          </span>
          <h1 className="text-3xl font-black mt-3 text-white tracking-tight">
            Core Team Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-xl">
            Coordinate and edit curriculum syllabus structures, schedule class batches, and align with trainers.
          </p>
        </div>
      </div>

      {/* ── Oversight Nodes ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Node 1: Own-Team Discussion */}
        <button
          onClick={() => router.push("/dashboard-team/discussion")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-650 flex justify-between items-center">
            <span>own-team</span>
            <span className="text-[10px] text-purple-700 hover:underline">Discuss →</span>
          </div>
          <p className="text-xs text-gray-500">Live communication and alignment tunnel with the school owner.</p>
          <div className="text-xs bg-purple-50 text-purple-700 font-bold px-2.5 py-1.5 rounded-lg flex justify-between items-center">
            <span>Tunnel Status:</span>
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </button>

        {/* Node 2: Content Hub */}
        <button 
          onClick={() => router.push("/dashboard-team/courses")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-650 flex justify-between items-center">
            <span>content</span>
            <span className="text-[10px] text-purple-700 hover:underline">Open Builder →</span>
          </div>
          <p className="text-xs text-gray-500">Manage course levels, syllabus modules, and chapter flows.</p>
          <div className="text-xs bg-purple-50 text-purple-700 font-bold px-2.5 py-1.5 rounded-lg flex justify-between items-center">
            <span>Editor Link:</span>
            <span className="text-[10px] font-bold">New Page</span>
          </div>
        </button>

        {/* Node 3: School Operations */}
        <button 
          onClick={() => router.push("/dashboard-team/courses")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-650 flex justify-between items-center">
            <span>school operations</span>
            <span className="text-[10px] text-purple-700 hover:underline">Plan Batches →</span>
          </div>
          <p className="text-xs text-gray-500">Manage course levels, syllabus modules, and chapter flows (Editable).</p>
          <div className="text-xs bg-purple-50 text-purple-700 font-bold px-2.5 py-1.5 rounded-lg flex justify-between items-center">
            <span>Planner Link:</span>
            <span className="text-[10px] font-bold">New Page</span>
          </div>
        </button>

        {/* Node 4: School Status */}
        <button 
          onClick={() => router.push("/dashboard-team/schools")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-650 flex justify-between items-center">
            <span>school status</span>
            <span className="text-[10px] text-purple-700 hover:underline">View Schools →</span>
          </div>
          <p className="text-xs text-gray-500">Dashboard overview of registered schools, description and active status.</p>
          <div className="text-xs bg-purple-50 text-purple-700 font-bold px-2.5 py-1.5 rounded-lg flex justify-between items-center">
            <span>Total Schools:</span>
            <span>{schoolsCount} Registered</span>
          </div>
        </button>
      </div>

      {/* ── Sub-console: Personal Trainer chat ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div>
          <h4 className="text-base font-black text-gray-900">Personal Trainer Console</h4>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Discussion and alignment channel between the Core Team and the Trainers.</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col h-[380px]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3.5 mb-4 pr-1">
            {loadingTrainerMsgs ? (
              <div className="text-xs text-gray-450 text-center py-8">Loading trainer logs...</div>
            ) : trainerMessages.length === 0 ? (
              <div className="text-xs text-gray-450 text-center py-8">No messages. Type below to start discussion.</div>
            ) : (
              trainerMessages.map(tmsg => {
                const isMe = tmsg.sender === userEmail;
                return (
                  <div key={tmsg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[9px] font-bold text-gray-450 mb-0.5 px-1">{tmsg.sender} ({tmsg.role})</span>
                    <div className={`p-3 rounded-xl text-xs max-w-md ${isMe ? "bg-purple-600 text-white" : "bg-white text-gray-900 border border-gray-200"}`}>
                      {tmsg.content}
                    </div>
                    <span className="text-[8px] text-gray-400 mt-0.5 px-1">{new Date(tmsg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendTrainerMessage} className="border-t border-gray-200/60 pt-4 flex gap-2">
            <input
              type="text"
              required
              placeholder="Ask a trainer or coordinate task allocations..."
              value={newTrainerMsg}
              onChange={(e) => setNewTrainerMsg(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 font-medium"
            />
            <button
              type="submit"
              disabled={sendingTrainerMsg}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {sendingTrainerMsg ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
