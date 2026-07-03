"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { fetchTrainerSubmissions } from "../../../lib/queries";
import { gradeSubmission } from "../../../lib/mutations";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";

export default function TrainerProjectsPage() {
  const { claims, user } = useAuth();
  const activeOrgId = claims?.active_org_id || "";
  const { showToast } = useToast();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState({}); // submissionId -> score
  const [saveLoading, setSaveLoading] = useState({}); // submissionId -> boolean

  const refetchSubmissions = useCallback(async () => {
    if (!activeOrgId) return;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Project Reviews</h1>
        <p className="text-sm text-gray-550 font-medium mt-1">
          Review student project solutions and code submissions, publish grades, and leave feedback comments.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-100 max-w-4xl mx-auto shadow-sm space-y-4">
        <h4 className="font-bold text-gray-900 text-base mb-4">Student Project Submissions</h4>
        
        {loading ? (
          <div className="text-sm text-gray-550 animate-pulse text-center py-12">Loading student submissions...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-500 text-sm font-semibold">No student submissions found in this organization.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
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
                      <span className="text-xs font-mono text-gray-400">{sub.student_profiles?.users?.email}</span>
                    </div>
                    <div className="text-xs bg-[#4A3ABA]/5 text-[#4A3ABA] font-bold px-2 py-1 rounded inline-block">
                      Task: {sub.assignments?.title || "Assignment"}
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-700 font-mono break-all whitespace-pre-wrap">
                      {sub.content}
                    </div>
                    <div className="text-[10px] text-gray-450">
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
                      className="bg-[#4A3ABA] text-white px-3.5 py-2 rounded text-xs font-bold hover:bg-[#3A2A9A] transition-all shrink-0 w-full md:w-auto text-center cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : sub.grades ? "Update Grade" : "Submit Grade"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
