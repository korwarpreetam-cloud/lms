"use client";

import React, { useState } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchTrainerSubmissions } from "../../../lib/queries";
import { gradeSubmission } from "../../../lib/mutations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
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

  // Fetch student submissions
  const { data: submissions, loading, refetch } = useQuery(fetchTrainerSubmissions, [activeOrgId]);

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
      <div>
        <h1 className="text-3xl font-black text-gray-905 tracking-tight">Trainer Assignments Desk</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Review written answers or code repositories submitted by cohort students, leave feedback, and publish grades.
        </p>
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
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-xl transition-all ${
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

                        <div className="flex gap-4 text-xs font-medium text-gray-500">
                          <span>Submitted: {new Date(submission.created_at).toLocaleString()}</span>
                          <span>•</span>
                          <span>Last updated: {new Date(submission.updated_at).toLocaleString()}</span>
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
    </div>
  );
}
