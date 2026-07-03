"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchTrainerSubmissions, fetchTrainerCohorts } from "../../../lib/queries";
import { gradeSubmission, createAssignment } from "../../../lib/mutations";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function TrainerAssignmentsPage() {
  const { user, claims } = useAuth();
  const { showToast } = useToast();
  
  const activeOrgId = claims?.active_org_id || "";
  const graderId = user?.id || "";

  // Local state
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "graded">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<number | "">("");

  // Create Assignment Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCohortId, setNewCohortId] = useState("");
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [deployLoading, setDeployLoading] = useState(false);

  // Fetch student submissions
  const { data: submissions, loading, refetch } = useQuery(fetchTrainerSubmissions, [activeOrgId]);

  // Fetch trainer cohorts for dropdown
  const [cohorts, setCohorts] = useState<any[]>([]);
  useEffect(() => {
    if (activeOrgId) {
      fetchTrainerCohorts(activeOrgId).then(setCohorts).catch(console.error);
    }
  }, [activeOrgId]);

  // Mutation helper for grading
  const { mutate: executeGrade, loading: grading } = useMutation(
    async (submissionId: string, score: number) => gradeSubmission(activeOrgId, submissionId, score, graderId),
    {
      onSuccess: () => {
        showToast("Grade submitted successfully!", "success");
        refetch();
      },
      onError: (err) => {
        showToast(err.message || "Failed to record grade", "error");
      }
    }
  );

  const handleGradeSubmit = async (e: React.FormEvent, submissionId: string, maxScore: number) => {
    e.preventDefault();
    if (scoreInput === "") {
      showToast("Please enter a valid numeric grade score", "warning");
      return;
    }
    
    if (scoreInput < 0 || scoreInput > maxScore) {
      showToast(`Grade must be between 0 and the maximum score of ${maxScore}`, "error");
      return;
    }

    await executeGrade(submissionId, scoreInput);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortId) {
      showToast("Please select a cohort batch", "warning");
      return;
    }
    if (!newTitle.trim()) {
      showToast("Assignment title is required", "warning");
      return;
    }
    setDeployLoading(true);
    try {
      await createAssignment(activeOrgId, newCohortId, newTitle, newMaxScore);
      showToast("Assignment deployed successfully!", "success");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewCohortId("");
      setNewMaxScore(100);
      refetch();
    } catch (err: any) {
      showToast(err.message || "Failed to create assignment", "error");
    } finally {
      setDeployLoading(false);
    }
  };

  const list = (submissions ?? []).map((s) => {
    const isGraded = s.grades !== null && s.grades !== undefined;
    const maxScore = s.assignments?.max_score ?? 100;
    const score = isGraded ? `${s.grades?.score} / ${maxScore}` : null;
    const studentName = s.student_profiles?.users?.full_name || "Invited Student";
    const studentEmail = s.student_profiles?.users?.email || "";

    return {
      ...s,
      isGraded,
      maxScore,
      score,
      studentName,
      studentEmail,
    };
  });

  const counts = {
    all: list.length,
    pending: list.filter((s) => !s.isGraded).length,
    graded: list.filter((s) => s.isGraded).length,
  };

  const filteredList = list.filter((item) => {
    if (filterTab === "all") return true;
    if (filterTab === "pending") return !item.isGraded;
    return item.isGraded;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Trainer Assignments Desk</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Review written answers or code repositories submitted by cohort students, leave feedback, and publish grades.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-5 py-3 rounded-xl bg-[#F5A623] text-gray-900 font-bold text-sm shadow-md hover:bg-[#E09000] transition-all flex items-center gap-2 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Deploy Assignment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1.5 border border-gray-250 shadow-inner gap-1 max-w-md">
        {(["all", "pending", "graded"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilterTab(tab);
              setExpandedId(null);
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer ${
              filterTab === tab
                ? "bg-[#4A3ABA] text-white shadow-lg"
                : "text-gray-400 hover:text-gray-900 hover:bg-white/50"
            }`}
          >
            {tab === "pending" ? "Awaiting Review" : tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-sm font-semibold">No student submissions matching this filter.</p>
          </div>
        ) : (
          filteredList.map((submission) => {
            const isExpanded = expandedId === submission.id;
            
            return (
              <Card 
                key={submission.id}
                hoverEffect={!isExpanded}
                className={`transition-all duration-300 ${isExpanded ? "ring-2 ring-[#4A3ABA]/20 shadow-md" : ""}`}
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : submission.id);
                    setScoreInput(submission.grades?.score ?? "");
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base">
                        {submission.assignments?.title || "Assignment Submission"}
                      </h3>
                      <p className="text-xs text-gray-500 font-semibold mt-1">
                        Student: {submission.studentName} ({submission.studentEmail})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {submission.isGraded ? (
                      <Badge variant="success" size="md" className="font-bold py-1 px-3">
                        Graded: {submission.score}
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="md" className="font-bold py-1 px-3">
                        Awaiting Review
                      </Badge>
                    )}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className={`text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180 text-[#4A3ABA]" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-100 space-y-6 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Solution text and metadata */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Solution Submission</h4>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-sm font-medium font-mono text-gray-800 break-all whitespace-pre-wrap mt-1.5">
                            {submission.content}
                          </div>
                        </div>

                        <div className="flex gap-4 text-xs font-medium text-gray-405">
                          <span>Submitted: {new Date(submission.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Right: Grading Panel */}
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 self-start">
                        <h4 className="text-sm font-bold text-gray-900 mb-4">Grading & Score Board</h4>
                        
                        <form onSubmit={(e) => handleGradeSubmit(e, submission.id, submission.maxScore)} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">
                              Awarded Score (0 - {submission.maxScore})
                            </label>
                            <input
                              type="number"
                              required
                              min={0}
                              max={submission.maxScore}
                              step="any"
                              placeholder={`max: ${submission.maxScore}`}
                              value={scoreInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setScoreInput(val === "" ? "" : parseFloat(val));
                              }}
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-base focus:border-[#4A3ABA] outline-none text-gray-900 font-bold"
                            />
                          </div>

                          <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-3"
                            isLoading={grading}
                          >
                            {submission.isGraded ? "Update published Grade" : "Publish Grade Score"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Deploy Assignment Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Deploy Assignment</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Create a new task, set point scales, and deploy it to a student cohort batch.</p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Target Cohort / Batch</label>
                <select
                  required
                  value={newCohortId}
                  onChange={(e) => setNewCohortId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                >
                  <option value="">-- Choose Cohort --</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.courses?.name || "Active Batch"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Assignment Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Build a Responsive Landing Page"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Maximum Points Score</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deployLoading}
                  className="flex-1 py-3 text-sm font-bold text-gray-900 bg-[#F5A623] hover:bg-[#E09000] rounded-xl shadow-lg shadow-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deployLoading ? "Deploying..." : "Deploy Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
