"use client";

import { useQuery } from "../../../lib/hooks";
import { fetchTrainerSubmissions } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function OwnerProjectsPage() {
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";

  // Fetch all submissions for the organization
  const { data: submissions, loading, refetch } = useQuery(
    () => fetchTrainerSubmissions(activeOrgId),
    [activeOrgId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Organization Projects</h1>
        <p className="text-sm text-gray-550 font-medium mt-1">
          Monitor all student project submissions, code repositories, and grading feedback across cohorts.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-bold">
                  <th className="p-4">Student</th>
                  <th className="p-4">Assignment / Topic</th>
                  <th className="p-4">Submission Date</th>
                  <th className="p-4">Solution Content</th>
                  <th className="p-4">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-4"><TableRowSkeleton /></td>
                    </tr>
                  ))
                ) : !submissions || submissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-semibold">
                      No student submissions registered in this school context.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">
                          {sub.student_profiles?.users?.full_name || "Student"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {sub.student_profiles?.users?.email}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800">
                          {sub.assignments?.title || "LMS Assignment"}
                        </div>
                      </td>
                      <td className="p-4 text-gray-550">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="max-w-xs truncate font-mono text-xs bg-gray-50 p-2 rounded-lg border border-gray-150 text-gray-700" title={sub.content}>
                          {sub.content}
                        </div>
                      </td>
                      <td className="p-4">
                        {sub.grades ? (
                          <Badge variant="success" size="md">
                            {sub.grades.score} / {sub.assignments?.max_score || 100}
                          </Badge>
                        ) : (
                          <Badge variant="info" size="md">
                            Awaiting Grade
                          </Badge>
                        )}
                        {sub.grades?.feedback && (
                          <div className="text-[10px] text-gray-400 italic mt-1 max-w-[150px] truncate" title={sub.grades.feedback}>
                            &ldquo;{sub.grades.feedback}&rdquo;
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
