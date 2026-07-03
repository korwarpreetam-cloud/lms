"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { createClient } from "../../lib/auth";

export default function TrainerDashboardPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";
  const userEmail = claims?.email || "trainer@member.com";
  const userRole = claims?.active_role || "trainer";

  // State
  const [activeTab, setActiveTab] = useState("personaltrainer"); // personaltrainer, schooloperations
  const [cohorts, setCohorts] = useState([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);

  // Chat States (Personal Trainer Console)
  const [trainerMessages, setTrainerMessages] = useState([]);
  const [newTrainerMsg, setNewTrainerMsg] = useState("");
  const [loadingTrainerMsgs, setLoadingTrainerMsgs] = useState(false);
  const [sendingTrainerMsg, setSendingTrainerMsg] = useState(false);

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
      loadCohorts();
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
    showToast("Message sent to team coordination board!", "success");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-purple-950 rounded-3xl p-8 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full uppercase tracking-wider">
            Trainer Console Workspace
          </span>
          <h1 className="text-3xl font-black mt-3 text-white tracking-tight">
            Trainer Space
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-xl">
            Cooperate with the Core Team, review student tasks, and manage class schedule logs.
          </p>
        </div>
      </div>

      {/* ── Trainer Architecture Nodes ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Node 1: Personal Trainer Console */}
        <button 
          onClick={() => setActiveTab("personaltrainer")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 flex justify-between items-center">
            <span>persnaltrainer console</span>
            <span className="text-[10px] text-purple-750 hover:underline">Chat →</span>
          </div>
          <p className="text-xs text-gray-500">Real-time chat alignment with the school's Core Team.</p>
          <div className="text-xs bg-purple-50 text-purple-750 font-bold px-2 py-1 rounded text-center">
            Active Workspace
          </div>
        </button>

        {/* Node 2: School Operations */}
        <button 
          onClick={() => router.push("/dashboard-trainer/courses")}
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 text-left w-full hover:border-purple-300 transition-all cursor-pointer block"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 flex justify-between items-center">
            <span>schooloperation</span>
            <span className="text-[10px] text-purple-750 hover:underline">Explore →</span>
          </div>
          <p className="text-xs text-gray-500">Pipeline inputs connected from Core Team & Owner planners (Read-Only).</p>
          <div className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded text-center">
            View Syllabus
          </div>
        </button>

        {/* Node 3: School Dash */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600">school status</div>
          <p className="text-xs text-gray-500">Overview of assigned student progress and attendance logs.</p>
          <div className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-1.5 rounded-lg flex justify-between items-center">
            <span>Active Batches:</span>
            <span className="text-amber-800">{cohorts.length} Batches</span>
          </div>
        </div>
      </div>

      {/* ── Active Module Content Workspace ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex gap-4 border-b border-gray-100 pb-3">
          <button
            onClick={() => setActiveTab("personaltrainer")}
            className={`pb-2.5 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === "personaltrainer" ? "text-gray-900" : "text-gray-400 hover:text-gray-650"
            }`}
          >
            Personal Trainer Console (Chat with Team)
            {activeTab === "personaltrainer" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600" />}
          </button>
          <button
            onClick={() => setActiveTab("schooloperations")}
            className={`pb-2.5 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === "schooloperations" ? "text-gray-900" : "text-gray-400 hover:text-gray-650"
            }`}
          >
            School Operations (Class Batches)
            {activeTab === "schooloperations" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600" />}
          </button>
        </div>

        {activeTab === "personaltrainer" ? (
          <div className="space-y-6">
            <div>
              <h4 className="text-base font-black text-gray-900">Personal Trainer Chat Console</h4>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Discussion and alignment channel between the Core Team and the Trainers.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col h-[380px]">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3.5 mb-4 pr-1">
                {loadingTrainerMsgs ? (
                  <div className="text-xs text-gray-450 text-center py-8">Loading messages...</div>
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
                  placeholder="Ask the Core Team or coordinate task allocations..."
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
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-black text-gray-900">Active Classroom Cohorts (Read-Only)</h4>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Class schedules planner. All content is read-only. Contact Core Team for updates.</p>
            </div>

            {loadingCohorts ? (
              <div className="text-xs text-gray-400">Loading active batches...</div>
            ) : cohorts.length === 0 ? (
              <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
                No active cohorts scheduled.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cohorts.map((cohort) => (
                  <div key={cohort.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-gray-900 block">{cohort.name}</span>
                      <span className="text-[10px] text-purple-600 font-bold block mt-0.5">Course: {cohort.courses?.name}</span>
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
          </div>
        )}
      </div>

    </div>
  );
}
