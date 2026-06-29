"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "../../lib/hooks";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { 
  fetchTrainerMetrics, 
  fetchTrainerCohorts, 
  fetchCohortStudents, 
  fetchTrainerSubmissions 
} from "../../lib/queries";
import { 
  submitAttendance, 
  createAssignment, 
  gradeSubmission 
} from "../../lib/mutations";

/* ── Feature Data ──────────────────────────────────────────── */

const featureCards = [
  {
    id: "attendance",
    title: "Attendance Module",
    description: "Mark and register daily student attendance across branches",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    features: [
      { name: "Select School", desc: "Choose the target school branch for classes" },
      { name: "Select Class", desc: "Select active training batch or classroom session" },
      { name: "Mark Attendance", desc: "Flag students as Present, Absent, or Late" },
      { name: "Save & Submit", desc: "Publish attendance log to the operations database" },
    ],
  },
  {
    id: "assignments",
    title: "Assignment Module",
    description: "Create course assignments, specify deadlines, and upload resources",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    features: [
      { name: "Create Assignment", desc: "Formulate task titles, guidelines, and point scales" },
      { name: "Set Deadline", desc: "Establish hard submission cutoffs and late penalty policies" },
      { name: "Upload Files", desc: "Attach reference manuals, task assets, and starter templates" },
    ],
  },
  {
    id: "reviews",
    title: "Project Review Module",
    description: "Review student code, review images/videos, and grade submissions",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    features: [
      { name: "View Submission", desc: "Inspect student-uploaded assets, code files, and portfolios" },
      { name: "Provide Feedback", desc: "Draft performance commentary and constructive suggestions" },
      { name: "Approve Project", desc: "Certify submission completion and record final scores" },
    ],
  },
  {
    id: "tracking",
    title: "Student Tracking",
    description: "Analyze grades, monitor overall attendance stats, and view metrics",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    features: [
      { name: "Attendance logs", desc: "Analyze student attendance ratios and punctuality metrics" },
      { name: "Assignment Status", desc: "Check pending vs completed student submissions" },
      { name: "Project Status", desc: "Track progress through modules towards final projects" },
      { name: "Performance analytics", desc: "Assess aggregate academic strength and velocity charts" },
    ],
  },
];



/* ── Interactive Sub-Module Components ────────────────────────── */

function AttendanceWizard({ activeOrgId }) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [selectedCohortName, setSelectedCohortName] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // student_profile_id -> status
  const [submitLoading, setSubmitLoading] = useState(false);

  // Fetch cohorts for the trainer
  const { data: cohorts, loading: cohortsLoading } = useQuery(() => fetchTrainerCohorts(activeOrgId), [activeOrgId]);

  // Fetch students when a cohort is selected
  useEffect(() => {
    if (!selectedCohortId) return;
    setStudentsLoading(true);
    fetchCohortStudents(selectedCohortId)
      .then(data => {
        setStudents(data);
        // Initialize all status to 'present'
        const initial = {};
        data.forEach(s => {
          initial[s.id] = "present";
        });
        setAttendanceRecords(initial);
      })
      .catch(err => {
        console.error(err);
        showToast("Failed to fetch students for cohort", "error");
      })
      .finally(() => {
        setStudentsLoading(false);
      });
  }, [selectedCohortId, showToast]);

  const toggleStatus = (studentId) => {
    setAttendanceRecords(prev => {
      const current = prev[studentId];
      let next = "present";
      if (current === "present") next = "absent";
      else if (current === "absent") next = "late";
      return { ...prev, [studentId]: next };
    });
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        studentId,
        status
      }));
      if (records.length === 0) {
        showToast("No students to mark attendance for", "warning");
        return;
      }
      await submitAttendance(activeOrgId, selectedCohortId, attendanceDate, records);
      showToast("Attendance submitted successfully!", "success");
      setStep(3);
    } catch (err) {
      showToast(err.message || "Failed to submit attendance", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedCohortId("");
    setSelectedCohortName("");
    setStudents([]);
    setAttendanceRecords({});
    setStep(1);
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-bold text-gray-900 text-base">Attendance Capture Tool</h4>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((sNum) => (
            <div
              key={sNum}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= sNum
                  ? "bg-[#4A3ABA] text-white"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {sNum}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Select Cohort / Class</label>
          {cohortsLoading ? (
            <div className="text-sm text-gray-500 animate-pulse">Loading assigned cohorts...</div>
          ) : !cohorts || cohorts.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-xl">
              No active cohorts assigned to you in this school.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  onClick={() => {
                    setSelectedCohortId(cohort.id);
                    setSelectedCohortName(cohort.name);
                    setStep(2);
                  }}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-750 hover:border-[#4A3ABA]/55 hover:bg-purple-50/20 transition-all font-semibold"
                >
                  <div className="text-sm font-bold text-gray-900">{cohort.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{cohort.courses?.name || "Active Batch"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-[#4A3ABA]/5 rounded-xl p-3 text-xs text-[#4A3ABA] font-bold flex justify-between items-center">
            <span>Class: {selectedCohortName}</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="bg-white px-2 py-1 rounded border border-gray-200 text-xs font-mono text-gray-900 focus:outline-none"
            />
          </div>

          <label className="block text-sm font-semibold text-gray-750">Mark Attendance status (Click badge to cycle: present → absent → late)</label>
          
          {studentsLoading ? (
            <div className="text-sm text-gray-500 animate-pulse text-center py-4">Loading students list...</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-xl">
              No students enrolled in this cohort.
            </div>
          ) : (
            <div className="space-y-2.5">
              {students.map((student) => {
                const status = attendanceRecords[student.id] || "present";
                return (
                  <div key={student.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-150 shadow-sm">
                    <div>
                      <span className="font-semibold text-gray-800 text-sm block">{student.users?.full_name || "Enrolling Student"}</span>
                      <span className="text-xs text-gray-400 font-mono">{student.users?.email}</span>
                    </div>
                    <button
                      onClick={() => toggleStatus(student.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all min-w-[90px] text-center ${
                        status === "present" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                        status === "absent" ? "bg-red-100 text-red-600 hover:bg-red-200" :
                        "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      {status}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <button onClick={() => setStep(1)} className="text-sm font-semibold text-[#4A3ABA] hover:underline" disabled={submitLoading}>
              ← Back
            </button>
            {students.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="bg-[#4A3ABA] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3A2A9A] transition-all disabled:opacity-55"
              >
                {submitLoading ? "Submitting..." : "Save & Submit"}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h5 className="text-lg font-bold text-gray-900">Attendance Logged Successfully!</h5>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            Log uploaded to database. Synced with student portals live.
          </p>
          <button
            onClick={handleReset}
            className="mt-6 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all uppercase tracking-wider"
          >
            Mark Another Class
          </button>
        </div>
      )}
    </div>
  );
}

function AssignmentCreator({ activeOrgId }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [isCreated, setIsCreated] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);

  // Fetch cohorts for dropdown
  const { data: cohorts, loading: cohortsLoading } = useQuery(() => fetchTrainerCohorts(activeOrgId), [activeOrgId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCohortId) {
      showToast("Please select a cohort batch", "warning");
      return;
    }
    setDeployLoading(true);
    try {
      await createAssignment(activeOrgId, selectedCohortId, title, maxScore);
      showToast("Assignment deployed successfully!", "success");
      setIsCreated(true);
    } catch (err) {
      showToast(err.message || "Failed to create assignment. Make sure the SQL migrations are applied.", "error");
    } finally {
      setDeployLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-xl mx-auto">
      {!isCreated ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h4 className="font-bold text-gray-900 text-base mb-4">New Assignment Designer</h4>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Target Cohort / Batch</label>
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
              required
            >
              <option value="">-- Select Cohort --</option>
              {cohorts && cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.courses?.name || "LMS Course"})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Assignment Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build a Responsive Navbar with CSS Grid"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Max Points Score</label>
              <input
                type="number"
                required
                min={1}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Starter File / Mock</label>
              <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 bg-white text-xs text-center text-gray-500 font-semibold flex items-center justify-center gap-1.5 opacity-55">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                DB Attachment Enabled
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={deployLoading}
            className="w-full bg-[#F5A623] hover:bg-[#E09000] text-gray-900 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-100 transition-all duration-300 disabled:opacity-55"
          >
            {deployLoading ? "Deploying..." : "Deploy Assignment to Batch"}
          </button>
        </form>
      ) : (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="3">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
            </svg>
          </div>
          <h5 className="text-lg font-bold text-gray-900">Assignment Deployed!</h5>
          <p className="text-sm text-gray-500 mt-2">
            <strong>{title}</strong> has been uploaded to the database and is visible on student dashboards.
          </p>
          <button
            onClick={() => {
              setTitle("");
              setMaxScore(100);
              setIsCreated(false);
            }}
            className="mt-6 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all uppercase tracking-wider"
          >
            Create Another
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectReviewPanel({ activeOrgId }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState({}); // submissionId -> score
  const [saveLoading, setSaveLoading] = useState({}); // submissionId -> boolean

  const refetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTrainerSubmissions(activeOrgId);
      setSubmissions(data);
      const initialGrades = {};
      data.forEach(s => {
        if (s.grades) {
          initialGrades[s.id] = s.grades.score;
        } else {
          initialGrades[s.id] = "";
        }
      });
      setGrades(initialGrades);
    } catch (err) {
      showToast("Failed to load submissions", "error");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, showToast]);

  useEffect(() => {
    refetchSubmissions();
  }, [refetchSubmissions]);

  const handleScoreChange = (submissionId, value) => {
    setGrades(prev => ({ ...prev, [submissionId]: value }));
  };

  const handleSaveGrade = async (submissionId, maxScore) => {
    const score = Number(grades[submissionId]);
    if (isNaN(score) || score < 0 || score > maxScore) {
      showToast(`Please enter a valid grade between 0 and ${maxScore}`, "warning");
      return;
    }
    setSaveLoading(prev => ({ ...prev, [submissionId]: true }));
    try {
      await gradeSubmission(activeOrgId, submissionId, score, user.id);
      showToast("Grade saved successfully!", "success");
      refetchSubmissions();
    } catch (err) {
      showToast(err.message || "Failed to save grade", "error");
    } finally {
      setSaveLoading(prev => ({ ...prev, [submissionId]: false }));
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse text-center py-6">Loading student submissions...</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 max-w-xl mx-auto">
        <p className="text-gray-500 text-sm font-semibold">No student submissions found in this organization.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-w-3xl mx-auto space-y-4">
      <h4 className="font-bold text-gray-900 text-base mb-2">Student Project Submissions</h4>
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {submissions.map((sub) => {
          const maxScore = sub.assignments?.max_score ?? 100;
          const score = grades[sub.id];
          const isSaving = saveLoading[sub.id] || false;
          return (
            <div key={sub.id} className="p-4 bg-white rounded-xl border border-gray-150 shadow-sm flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-sm">
                    {sub.student_profiles?.users?.full_name || "Enrolled Student"}
                  </span>
                  <span className="text-xs font-mono text-gray-405">{sub.student_profiles?.users?.email}</span>
                </div>
                <div className="text-xs bg-[#4A3ABA]/5 text-[#4A3ABA] font-bold px-2 py-1 rounded inline-block">
                  Task: {sub.assignments?.title || "Assignment"}
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-750 font-mono break-all whitespace-pre-wrap">
                  {sub.content}
                </div>
                <div className="text-[10px] text-gray-400">
                  Submitted: {new Date(sub.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                <div className="space-y-1 w-full md:w-auto">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Grade (Max {maxScore})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      value={score}
                      onChange={(e) => handleScoreChange(sub.id, e.target.value)}
                      placeholder="--"
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded font-semibold text-sm text-gray-900 text-center"
                    />
                    <span className="text-xs font-semibold text-gray-400">/ {maxScore}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveGrade(sub.id, maxScore)}
                  disabled={isSaving}
                  className="bg-[#4A3ABA] text-white px-3.5 py-2 rounded text-xs font-bold hover:bg-[#3A2A9A] transition-all shrink-0 w-full md:w-auto text-center"
                >
                  {isSaving ? "Saving..." : sub.grades ? "Update Grade" : "Submit Grade"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function DashboardPage() {
  const [activeCard, setActiveCard] = useState(null);
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  const { data: metrics, loading: metricsLoading } = useQuery(() => fetchTrainerMetrics(activeOrgId), [activeOrgId]);

  const handleCardClick = (id) => {
    setActiveCard(activeCard === id ? null : id);
  };

  const activeFeature = featureCards.find((c) => c.id === activeCard);

  return (
    <div className="space-y-8">
      {/* ── Header Intro ── */}
      <div className="bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h3 className="text-lg md:text-xl font-bold mb-2">Trainer Classroom Console</h3>
          <p className="text-sm text-white/80 max-w-xl">
            A comprehensive portal configured to deliver structured modules, review assignment deadlines, register branch attendance, and provide final reviews on student portfolios.
          </p>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-14" />
            </div>
          ))
        ) : (metrics ?? []).map((metric) => (
          <div
            key={metric.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {metric.label}
            </p>
            <p
              className={`text-2xl font-bold mt-2 ${
                metric.color === "purple" ? "text-[#4A3ABA]" : "text-[#E09000]"
              }`}
            >
              {metric.value}
            </p>
            <span className="text-xs text-gray-500 font-medium mt-1.5 block">
              {metric.detail}
            </span>
          </div>
        ))}
      </div>

      {/* ── Feature Cards Grid ── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Training Modules
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
            {activeFeature.id === "attendance" && (
              <div className="mb-8">
                <AttendanceWizard activeOrgId={activeOrgId} />
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            {activeFeature.id === "assignments" && (
              <div className="mb-8">
                <AssignmentCreator activeOrgId={activeOrgId} />
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            {activeFeature.id === "reviews" && (
              <div className="mb-8">
                <ProjectReviewPanel activeOrgId={activeOrgId} />
                <hr className="my-8 border-gray-100" />
              </div>
            )}

            <h4 className="font-bold text-gray-900 text-sm mb-4">Module Operations</h4>
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
                      <p className="text-xs text-gray-550 mt-1 leading-relaxed">
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
