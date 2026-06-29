"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "../../../hooks/useQuery";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { useMutation } from "../../../hooks/useMutation";
import { fetchStudentAssignments, fetchCurrentStudentProfile } from "../../../lib/queries";
import { submitAssignment, uploadAssignmentFile } from "../../../lib/mutations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function StudentAssignmentsPage() {
  const { claims, user } = useAuth();
  const { showToast } = useToast();
  
  const activeOrgId = claims?.active_org_id || "";
  
  // Local state
  const [filterTab, setFilterTab] = useState<"all" | "todo" | "review" | "graded">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<{ id: string; organization_id: string } | null>(null);
  const [solutionContent, setSolutionContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch student profile ID
  useEffect(() => {
    fetchCurrentStudentProfile()
      .then((profile) => setStudentProfile(profile))
      .catch((err) => {
        console.error("Failed to load student profile:", err);
        showToast("Error loading student profile details", "error");
      });
  }, [showToast]);

  // Fetch assignments with submissions
  const { data: assignments, loading, refetch } = useQuery(fetchStudentAssignments, [activeOrgId]);

  // Submit mutation helper
  const { mutate: executeSubmit, loading: submitting } = useMutation(submitAssignment, {
    onSuccess: () => {
      showToast("Solution submitted successfully!", "success");
      refetch();
    },
    onError: (err) => {
      showToast(err.message || "Failed to submit assignment", "error");
    }
  });

  const handleSubmit = async (e: React.FormEvent, assignmentId: string) => {
    e.preventDefault();
    if (!studentProfile) {
      showToast("Student profile not loaded yet", "error");
      return;
    }
    if (!solutionContent.trim() && !selectedFile) {
      showToast("Solution content or file must be provided", "warning");
      return;
    }
    if (!user) {
      showToast("User not authenticated", "error");
      return;
    }
    
    setUploading(true);
    try {
      let finalContent = solutionContent;
      if (selectedFile) {
        const fileUrl = await uploadAssignmentFile(assignmentId, user.id, selectedFile);
        finalContent += finalContent ? `\n\nAttached File: ${fileUrl}` : `Attached File: ${fileUrl}`;
      }
      await executeSubmit(activeOrgId, assignmentId, studentProfile.id, finalContent);
      setSelectedFile(null);
    } catch (err: any) {
      showToast(err.message || "Failed to upload file", "error");
    } finally {
      setUploading(false);
    }
  };

  // Helper to compute state classification for each row
  const list = (assignments ?? []).map((a) => {
    let status: "todo" | "review" | "graded" = "todo";
    let score: string | null = null;
    
    if (a.submission?.grades) {
      status = "graded";
      score = `${a.submission.grades.score} / ${a.max_score}`;
    } else if (a.submission) {
      status = "review";
    }
    
    return {
      ...a,
      status,
      score,
    };
  });

  const counts = {
    all: list.length,
    todo: list.filter((a) => a.status === "todo").length,
    review: list.filter((a) => a.status === "review").length,
    graded: list.filter((a) => a.status === "graded").length,
  };

  const filteredList = list.filter((item) => {
    if (filterTab === "all") return true;
    return item.status === filterTab;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Assignments Desk</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Review tasks assigned to your cohort, submit code or summaries, and track grades.
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-gray-100 rounded-2xl p-1.5 border border-gray-250 shadow-inner gap-1 max-w-md">
        {(["all", "todo", "review", "graded"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilterTab(tab);
              setExpandedId(null);
              setSelectedFile(null);
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-xl transition-all ${
              filterTab === tab
                ? "bg-[#4A3ABA] text-white shadow-lg"
                : "text-gray-400 hover:text-gray-900 hover:bg-white/50"
            }`}
          >
            {tab === "review" ? "Awaiting Review" : tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-sm font-semibold">No assignments matching this filter found.</p>
          </div>
        ) : (
          filteredList.map((assignment) => {
            const isExpanded = expandedId === assignment.id;
            
            return (
              <Card 
                key={assignment.id} 
                hoverEffect={!isExpanded}
                className={`transition-all duration-300 ${isExpanded ? "ring-2 ring-[#4A3ABA]/20 shadow-md" : ""}`}
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : assignment.id);
                    setSolutionContent(assignment.submission?.content || "");
                    setSelectedFile(null);
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base">{assignment.title}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Posted: {new Date(assignment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {assignment.status === "graded" && (
                      <Badge variant="success" size="md" className="font-bold py-1 px-3">
                        Score: {assignment.score}
                      </Badge>
                    )}
                    {assignment.status === "review" && (
                      <Badge variant="info" size="md" className="font-bold py-1 px-3">
                        Awaiting Review
                      </Badge>
                    )}
                    {assignment.status === "todo" && (
                      <Badge variant="primary" size="md" className="font-bold py-1 px-3">
                        Todo
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
                      {/* Left: Metadata & Guidelines */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Guidelines</h4>
                          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed font-medium">
                            Complete the assignment requirements specified by your trainer. Double check your submission. Solutions remain editable until a grade has been published, after which they are locked.
                          </p>
                        </div>

                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                          <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Max Points Available</div>
                            <div className="text-lg font-black text-gray-900 mt-0.5">{assignment.max_score} pts</div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Submission Form */}
                      <div>
                        {assignment.status === "graded" ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Submitted Answer</h4>
                              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-sm font-medium font-mono text-gray-800 break-all mt-1.5">
                                {assignment.submission?.content}
                              </div>
                            </div>

                            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>This submission has been graded and locked.</span>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={(e) => handleSubmit(e, assignment.id)} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                {assignment.submission ? "Update Solution content" : "Solution Submission Text"}
                              </label>
                              <textarea
                                rows={5}
                                placeholder="Paste your repository URLs, walkthrough notes, or text answers here..."
                                value={solutionContent}
                                onChange={(e) => setSolutionContent(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none text-gray-900 transition-all font-medium font-mono"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Attach File (Optional)
                              </label>
                              <input
                                type="file"
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#4A3ABA] hover:file:bg-purple-100 transition-all"
                                accept=".pdf,.png,.jpg,.jpeg,.mp4,.zip"
                              />
                              {selectedFile && (
                                <p className="text-xs text-gray-500 mt-2 font-medium">
                                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                              )}
                            </div>

                            {assignment.status === "review" && (
                              <div className="p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Awaiting grading review. You can still modify and resubmit your solution.</span>
                              </div>
                            )}

                            <Button 
                              type="submit" 
                              variant={assignment.submission ? "secondary" : "primary"}
                              className="w-full py-3"
                              isLoading={submitting || uploading}
                            >
                              {assignment.submission ? "Resubmit Solution" : "Submit Solution"}
                            </Button>
                          </form>
                        )}
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
