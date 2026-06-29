"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "../../lib/hooks";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { 
  fetchStudentMetrics, 
  fetchStudentAssignments, 
  fetchCurrentStudentProfile, 
  fetchStudentAttendance 
} from "../../lib/queries";
import { submitAssignment } from "../../lib/mutations";

/* ── Feature Data ──────────────────────────────────────────── */

const featureCards = [
  {
    id: "courses",
    title: "Courses Structure",
    description: "Navigate through course modules, lectures, and final capstone projects",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    features: [
      { name: "Module 1", desc: "Foundations & Environment setup (Completed)" },
      { name: "Module 2", desc: "Frontend frameworks & state management (Completed)" },
      { name: "Module 3", desc: "Database bindings & API design (Active)" },
      { name: "Final Project", desc: "Integrate review features & deploy (Locked)" },
    ],
  },
  {
    id: "assignments",
    title: "Assignments Board",
    description: "Track assignments, view due dates, and review feedback",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    features: [
      { name: "Pending Tasks", desc: "Assignments requiring submission before deadine" },
      { name: "Completed Tasks", desc: "Graded submissions and feedback records" },
      { name: "Overdue Tasks", desc: "Assignments past deadlines with late policies applied" },
    ],
  },
  {
    id: "projects",
    title: "Projects Lab",
    description: "Upload snapshots, project walkthroughs, and repository source code",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    features: [
      { name: "Upload Photos", desc: "Upload UI design screenshots and wireframes" },
      { name: "Upload Videos", desc: "Upload 2-minute project demo walkthrough screen recordings" },
      { name: "Upload Code", desc: "Submit repository links or zip file payloads" },
      { name: "View Feedback", desc: "Read comments and criteria ratings left by trainers" },
    ],
  },
  {
    id: "certificates",
    title: "Certificates & Badges",
    description: "Acquire completion credentials and unlock earned milestone achievements",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
    features: [
      { name: "Download Certificates", desc: "Acquire PDF credential upon 100% curriculum completion" },
      { name: "Achievement Badges", desc: "Unlock earned milestone achievements" }
    ]
  }
];

/* ── Interactive Sub-Module Components ────────────────────────── */

function CourseTimeline() {
  const modules = [
    { id: 1, name: "Module 1: Foundations", topics: ["HTML5 & Semantics", "CSS Layouts & Flexbox", "Command Line & Git"], status: "completed" },
    { id: 2, name: "Module 2: Frontend Frameworks", topics: ["Javascript ES6+", "React Components & State", "Next.js Core Concepts"], status: "completed" },
    { id: 3, name: "Module 3: Database & API Design", topics: ["PostgreSQL & Supabase Bindings", "REST & Row Level Security", "Next API Routes"], status: "active" },
    { id: 4, name: "Module 4: Capstone Deployments", topics: ["Vercel Pipeline", "SSL Setup & Optimization", "System Walkthrough Review"], status: "locked" },
  ];

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
      <h4 className="font-bold text-gray-900 text-base mb-6">Course Milestone Stepper</h4>
      <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-6">
        {modules.map((m) => (
          <div key={m.id} className="relative">
            <div className={`absolute -left-[35px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
              m.status === "completed"
                ? "bg-green-500 border-green-500 text-white"
                : m.status === "active"
                ? "bg-white border-[#4A3ABA] text-[#4A3ABA] animate-pulse"
                : "bg-white border-gray-300 text-gray-400"
            }`}>
              {m.status === "completed" ? "✓" : m.id}
            </div>

            <div>
              <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                {m.name}
                {m.status === "active" && (
                  <span className="bg-purple-100 text-[#4A3ABA] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Active</span>
                )}
                {m.status === "locked" && (
                  <span className="bg-gray-150 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Locked</span>
                )}
              </h5>
              <ul className="mt-2 space-y-1">
                {m.topics.map((t) => (
                  <li key={t} className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentTracker({ activeOrgId, refreshTrigger }) {
  const [filter, setFilter] = useState("all");
  const { data: assignments, loading, refetch } = useQuery(() => fetchStudentAssignments(activeOrgId), [activeOrgId, refreshTrigger]);

  useEffect(() => {
    refetch();
  }, [refreshTrigger, refetch]);

  const list = (assignments ?? []).map((a) => {
    if (a.submission?.grades) {
      return { name: a.title, date: new Date(a.submission.created_at).toLocaleDateString(), status: "completed", score: `${a.submission.grades.score}/${a.max_score}` };
    } else if (a.submission) {
      return { name: a.title, date: new Date(a.submission.created_at).toLocaleDateString(), status: "submitted", score: null };
    } else {
      return { name: a.title, deadline: new Date(a.created_at).toLocaleDateString(), status: "pending", score: null };
    }
  });

  const filtered = filter === "all" ? list : list.filter((item) => item.status === filter);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto text-center">
        <p className="text-sm text-gray-500">No assignments yet. They’ll appear here once your trainer creates them.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
      <h4 className="font-bold text-gray-900 text-base mb-4">Assignments Ledger</h4>
      <div className="flex bg-white rounded-xl p-1 border border-gray-150 shadow-inner gap-1 mb-5">
        {["all", "pending", "completed", "submitted"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              filter === status
                ? "bg-[#4A3ABA] text-white shadow"
                : "text-gray-400 hover:text-gray-950 hover:bg-gray-50"
            }`}
          >
            {status} ({status === "all" ? list.length : list.filter((x) => x.status === status).length})
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {filtered.map((item) => (
          <div key={item.name} className="flex justify-between items-center p-3.5 bg-white rounded-xl border border-gray-150 shadow-sm">
            <div>
              <span className="font-semibold text-gray-800 text-sm block">{item.name}</span>
              <span className="text-xs text-gray-400 mt-1 block">
                {item.status === "completed" ? `Submitted on: ${item.date}` : `Deadline: ${item.deadline}`}
              </span>
            </div>
            {item.status === "completed" ? (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">{item.score}</span>
            ) : item.status === "submitted" ? (
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Submitted</span>
            ) : (
              <span className="bg-purple-100 text-[#4A3ABA] text-xs font-bold px-3 py-1 rounded-full">Todo</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectUploader({ activeOrgId, studentProfileId, onUploadSuccess }) {
  const { showToast } = useToast();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissionContent, setSubmissionContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch student's assignments to populate dropdown
  const { data: assignments, loading: assignmentsLoading } = useQuery(() => fetchStudentAssignments(activeOrgId), [activeOrgId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentId) {
      showToast("Please select an assignment", "warning");
      return;
    }
    if (!submissionContent.trim()) {
      showToast("Submission content cannot be empty", "warning");
      return;
    }
    setIsUploading(true);
    try {
      await submitAssignment(activeOrgId, selectedAssignmentId, studentProfileId, submissionContent);
      showToast("Project submission successful!", "success");
      setSuccess(true);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      showToast(err.message || "Failed to submit project", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
      {!success ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h4 className="font-bold text-gray-900 text-base mb-4">Project Asset Submission Desk</h4>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Select Assignment</label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
              required
            >
              <option value="">-- Select Assignment --</option>
              {assignments && assignments.filter(a => !a.submission).map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Submission Content (URL, Link, or Answers)</label>
            <textarea
              required
              rows={4}
              value={submissionContent}
              onChange={(e) => setSubmissionContent(e.target.value)}
              placeholder="e.g., https://github.com/myusername/my-project-repo or enter project summary..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full bg-[#4A3ABA] text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-[#3A2A9A] transition-all flex items-center justify-center gap-2"
          >
            {isUploading ? "Uploading to Server..." : "Upload & Register Project Asset"}
          </button>
        </form>
      ) : (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h5 className="text-lg font-bold text-gray-900">Upload Process Successful!</h5>
          <p className="text-sm text-gray-500 mt-2">
            Your file or repo URL was uploaded successfully. Syncing state is set to `Pending Verification` on the Trainer Dashboard.
          </p>
          <button
            onClick={() => {
              setSubmissionContent("");
              setSelectedAssignmentId("");
              setSuccess(false);
            }}
            className="mt-6 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all uppercase tracking-wider"
          >
            Submit Another Link
          </button>
        </div>
      )}
    </div>
  );
}

function CertificatesAndBadges({ activeOrgId, studentProfileId, refreshTrigger }) {
  const { data: assignments, refetch: refetchAssignments } = useQuery(() => fetchStudentAssignments(activeOrgId), [activeOrgId, refreshTrigger]);
  const { data: attendance, refetch: refetchAttendance } = useQuery(() => fetchStudentAttendance(studentProfileId, activeOrgId), [studentProfileId, activeOrgId, refreshTrigger]);

  useEffect(() => {
    refetchAssignments();
    refetchAttendance();
  }, [refreshTrigger, refetchAssignments, refetchAttendance]);

  const totalAssignments = assignments?.length || 0;
  const gradedAssignments = assignments?.filter(a => a.submission?.grades).length || 0;
  const completionPct = totalAssignments > 0 ? Math.round((gradedAssignments / totalAssignments) * 100) : 100;

  const totalDays = attendance?.length || 0;
  const presentDays = attendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  return (
    <div className="mb-8 max-w-xl mx-auto space-y-6">
      {/* Certificate progress */}
      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 text-[#E09000]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>
        </div>
        <div>
          <h5 className="font-bold text-gray-900 text-sm">Course Certificate Eligibility</h5>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Certificates are enabled once course completion reaches 100%. (Current: {completionPct}%). Complete all assignments and verify they are graded by your instructor.
          </p>
          <button 
            disabled={completionPct < 100}
            className={`mt-3 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
              completionPct >= 100
                ? "bg-[#4A3ABA] text-white hover:bg-[#3A2A9A]"
                : "bg-gray-250 text-gray-400 cursor-not-allowed"
            }`}
          >
            {completionPct >= 100 ? "Download PDF Certificate" : "Download PDF (Locked)"}
          </button>
        </div>
      </div>

      {/* Attendance history */}
      <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
        <h5 className="font-bold text-gray-900 text-sm mb-3">Attendance History</h5>
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3 text-xs font-semibold">
          <div>Total Classes: <span className="font-bold text-gray-900">{totalDays}</span></div>
          <div>Present: <span className="font-bold text-green-700">{presentDays}</span></div>
          <div>Attendance Ratio: <span className="font-bold text-[#4A3ABA]">{attendancePct}%</span></div>
        </div>
        {attendance && attendance.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {attendance.map((log) => (
              <div key={log.id} className="flex justify-between items-center py-2 px-3 bg-gray-50/50 rounded-lg text-xs font-medium">
                <span className="font-mono text-gray-500">{new Date(log.date).toLocaleDateString()}</span>
                <span className="text-gray-500 truncate max-w-[150px]">{log.cohorts?.name || "Session"}</span>
                <span className={`font-bold capitalize ${
                  log.status === "present" ? "text-green-600" :
                  log.status === "absent" ? "text-red-500" : "text-amber-600"
                }`}>{log.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-150 rounded-xl font-medium">No attendance logs found.</p>
        )}
      </div>

      {/* Badges */}
      <div>
        <h5 className="font-bold text-gray-900 text-sm mb-3">Unlocked Achievements</h5>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Attendance Star", desc: "Maintain >90% ratio", unlocked: attendancePct >= 90 && totalDays > 0 },
            { name: "First Steps", desc: "Submit first assignment", unlocked: totalAssignments > 0 },
            { name: "Curriculum Hero", desc: "Unlock 100% progress", unlocked: completionPct >= 100 },
          ].map((badge) => (
            <div key={badge.name} className={`p-3.5 rounded-xl border text-center shadow-sm transition-all ${
              badge.unlocked 
                ? "bg-white border-purple-200 text-gray-900" 
                : "bg-gray-55/55 border-gray-200 text-gray-400 opacity-60"
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2 text-base font-bold ${
                badge.unlocked ? "bg-purple-100 text-[#4A3ABA]" : "bg-gray-200 text-gray-400"
              }`}>✦</div>
              <div className="font-bold text-xs">{badge.name}</div>
              <div className="text-[9px] mt-0.5 leading-tight">{badge.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function DashboardPage() {
  const [activeCard, setActiveCard] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";

  // 1. Fetch current student profile
  const { data: studentProfile, loading: profileLoading } = useQuery(fetchCurrentStudentProfile);
  const studentProfileId = studentProfile?.id || "";

  // 2. Fetch metrics reactively
  const { data: metrics, loading: metricsLoading, refetch: refetchMetrics } = useQuery(
    () => fetchStudentMetrics(activeOrgId), 
    [activeOrgId, studentProfileId, refreshTrigger]
  );

  const handleCardClick = (id) => {
    setActiveCard(activeCard === id ? null : id);
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    refetchMetrics();
  };

  const activeFeature = featureCards.find((c) => c.id === activeCard);

  return (
    <div className="space-y-8">
      {/* ── Header Intro ── */}
      <div className="bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h3 className="text-lg md:text-xl font-bold mb-2">Student Portal Desk</h3>
          <p className="text-sm text-white/80 max-w-xl">
            Access your course lectures, track homework statuses, submit project repositories, download certified completion documents, and review scores.
          </p>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metricsLoading || profileLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          ))
        ) : (metrics ?? []).map((metric) => (
          <div
            key={metric.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {metric.label}
            </p>
            <p
              className={`text-xl font-bold mt-2 ${
                metric.color === "purple" ? "text-[#4A3ABA]" : "text-[#E09000]"
              }`}
            >
              {metric.value}
            </p>
            <span className="text-[11px] text-gray-550 font-medium mt-1.5 block leading-tight">
              {metric.detail}
            </span>
          </div>
        ))}
      </div>

      {/* ── Feature Cards Grid ── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Learning Pathways
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featureCards.map((card) => {
            const isActive = activeCard === card.id;
            const isPurple = card.color === "purple";
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? isPurple
                      ? "bg-[#4A3ABA] border-[#4A3ABA] text-white shadow-xl shadow-purple-200"
                      : "bg-[#F5A623] border-[#F5A623] text-gray-900 shadow-xl shadow-amber-200"
                    : "bg-white border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300 ${
                    isActive
                      ? "bg-white/20"
                      : isPurple
                      ? "bg-[#4A3ABA]/10"
                      : "bg-[#F5A623]/10"
                  }`}
                >
                  <span
                    className={`transition-colors duration-300 ${
                      isActive
                        ? isPurple
                          ? "text-white"
                          : "text-gray-900"
                        : isPurple
                        ? "text-[#4A3ABA]"
                        : "text-[#F5A623]"
                    }`}
                  >
                    {card.icon}
                  </span>
                </div>
                <h4
                  className={`text-lg font-bold mb-1 transition-colors duration-300 ${
                    isActive
                      ? isPurple
                        ? "text-white"
                        : "text-gray-900"
                      : "text-gray-900"
                  }`}
                >
                  {card.title}
                </h4>
                <p
                  className={`text-sm transition-colors duration-300 ${
                    isActive
                      ? isPurple
                        ? "text-white/70"
                        : "text-gray-700"
                      : "text-gray-500"
                  }`}
                >
                  {card.description}
                </p>
                <div
                  className={`mt-4 flex items-center gap-1 text-xs font-semibold transition-colors duration-300 ${
                    isActive
                      ? isPurple
                        ? "text-[#FFC857]"
                        : "text-[#4A3ABA]"
                      : isPurple
                      ? "text-[#4A3ABA]"
                      : "text-[#F5A623]"
                  }`}
                >
                  {isActive ? "Click to close" : "Click to expand"}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-300 ${
                      isActive ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Expanded Feature Panel ── */}
      {activeFeature && (
        <div
          className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden"
          style={{ animation: "fade-in-up 0.4s ease-out forwards" }}
        >
          {/* Panel header */}
          <div
            className={`px-8 py-6 ${
              activeFeature.color === "purple"
                ? "bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]"
                : "bg-gradient-to-r from-[#F5A623] to-[#FFC857]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className={`text-xl font-bold ${
                    activeFeature.color === "purple"
                      ? "text-white"
                      : "text-gray-900"
                  }`}
                >
                  {activeFeature.title}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    activeFeature.color === "purple"
                      ? "text-white/70"
                      : "text-gray-700"
                  }`}
                >
                  {activeFeature.description}
                </p>
              </div>
              <button
                onClick={() => setActiveCard(null)}
                className={`p-2 rounded-xl transition-colors ${
                  activeFeature.color === "purple"
                    ? "hover:bg-white/10 text-white"
                    : "hover:bg-black/10 text-gray-900"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Interactive tools or lists */}
          <div className="p-8">
            {activeFeature.id === "courses" && (
              <div className="mb-8">
                <CourseTimeline />
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            {activeFeature.id === "assignments" && (
              <div className="mb-8">
                <AssignmentTracker activeOrgId={activeOrgId} refreshTrigger={refreshTrigger} />
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            {activeFeature.id === "projects" && (
              <div className="mb-8">
                {studentProfileId ? (
                  <ProjectUploader 
                    activeOrgId={activeOrgId} 
                    studentProfileId={studentProfileId} 
                    onUploadSuccess={handleUploadSuccess} 
                  />
                ) : (
                  <div className="text-center py-6 text-sm text-gray-500">
                    No active student profile found for this school context.
                  </div>
                )}
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            {activeFeature.id === "certificates" && (
              <div className="mb-8">
                {studentProfileId ? (
                  <CertificatesAndBadges 
                    activeOrgId={activeOrgId} 
                    studentProfileId={studentProfileId} 
                    refreshTrigger={refreshTrigger} 
                  />
                ) : (
                  <div className="text-center py-6 text-sm text-gray-550">
                    No student profile associated with this organization.
                  </div>
                )}
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            <h4 className="font-bold text-gray-900 text-sm mb-4">Module Details</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeFeature.features.map((feat, idx) => (
                <div
                  key={feat.name}
                  className={`group p-5 rounded-xl border-2 border-gray-100 hover:border-${
                    activeFeature.color === "purple"
                      ? "[#4A3ABA]/30"
                      : "[#F5A623]/30"
                  } transition-all duration-300 cursor-pointer hover:shadow-md`}
                  style={{
                    animation: `fade-in-up 0.4s ease-out forwards`,
                    animationDelay: `${idx * 100}ms`,
                    opacity: 0,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        activeFeature.color === "purple"
                          ? "bg-[#4A3ABA]/10 text-[#4A3ABA]"
                          : "bg-[#F5A623]/10 text-[#E09000]"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm group-hover:text-[#4A3ABA] transition-colors">
                        {feat.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
