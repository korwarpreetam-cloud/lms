"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { createClient } from "../../../lib/auth";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function TrainerClassesPage() {
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";
  const activeMembership = claims?.memberships?.find(m => m.org_id === activeOrgId);
  const trainerMemId = activeMembership?.membership_id;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClasses() {
      if (!trainerMemId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("cohort_trainers")
          .select(`
            id,
            is_lead,
            cohorts (
              id,
              name,
              status,
              start_date,
              end_date,
              courses (name)
            )
          `)
          .eq("membership_id", trainerMemId)
          .is("unassigned_at", null);

        if (error) throw error;
        setClasses(data || []);
      } catch (err) {
        console.error("Failed to load classes:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, [trainerMemId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Classes Portal</h1>
        <p className="text-sm text-gray-550 font-medium mt-1">
          Review all scheduled classes, cohort batches, course timelines, and instructor levels assigned to you.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-bold">
                  <th className="p-4">Cohort Class</th>
                  <th className="p-4">Assigned Course</th>
                  <th className="p-4">Start / End Dates</th>
                  <th className="p-4">Instructor Role</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-4"><TableRowSkeleton /></td>
                    </tr>
                  ))
                ) : classes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-semibold">
                      No cohort classes currently assigned to your instruction.
                    </td>
                  </tr>
                ) : (
                  classes.map((cls) => {
                    const cohort = cls.cohorts;
                    if (!cohort) return null;
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">{cohort.name}</td>
                        <td className="p-4 text-gray-700 font-semibold">{cohort.courses?.name || "—"}</td>
                        <td className="p-4 text-gray-500 font-mono text-xs">
                          {cohort.start_date ? new Date(cohort.start_date).toLocaleDateString() : "TBD"} –{" "}
                          {cohort.end_date ? new Date(cohort.end_date).toLocaleDateString() : "TBD"}
                        </td>
                        <td className="p-4">
                          <Badge variant={cls.is_lead ? "primary" : "secondary"}>
                            {cls.is_lead ? "Lead Trainer" : "Assistant Trainer"}
                          </Badge>
                        </td>
                        <td className="p-4 font-semibold uppercase text-xs">
                          <span
                            className={
                              cohort.status === "active"
                                ? "text-green-600"
                                : cohort.status === "completed"
                                ? "text-gray-400"
                                : "text-blue-500"
                            }
                          >
                            {cohort.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
