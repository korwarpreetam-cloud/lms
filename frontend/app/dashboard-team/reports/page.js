"use client";

import { useQuery } from "../../../lib/hooks";
import { fetchAdminMetrics, fetchMembers, fetchCourses } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { Card, CardContent } from "../../../components/ui/Card";

export default function CoreTeamReportsPage() {
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";

  // Queries
  const { data: metrics, loading: metricsLoading } = useQuery(() => fetchAdminMetrics(activeOrgId), [activeOrgId]);
  const { data: members, loading: membersLoading } = useQuery(() => fetchMembers(activeOrgId), [activeOrgId]);
  const { data: courses, loading: coursesLoading } = useQuery(() => fetchCourses(activeOrgId), [activeOrgId]);

  const trainers = (members ?? []).filter(m => m.roles?.code === 'trainer');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Analytics & Reports</h1>
        <p className="text-sm text-gray-555 font-medium mt-1">
          Review operational metrics, active course counts, and organization-wide KPIs.
        </p>
      </div>

      {/* Metrics Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse h-28" />
          ))
        ) : (metrics ?? []).slice(0, 4).map((metric) => (
          <div key={metric.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">{metric.label}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-black ${metric.color === "purple" ? "text-[#4A3ABA]" : "text-[#E09000]"}`}>
                {metric.value}
              </span>
              <span className="text-xs text-green-600 font-bold">Live</span>
            </div>
            <span className="text-xs text-gray-500 font-medium block mt-1">{metric.detail}</span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Courses Inventory card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900">Curricula Breakdown</h3>
          <div className="space-y-3">
            {coursesLoading ? (
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ) : !courses || courses.length === 0 ? (
              <p className="text-xs text-gray-500 font-semibold">No courses created yet.</p>
            ) : (
              courses.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">{c.name}</span>
                    <span className="text-xs text-gray-400 max-w-xs truncate block">{c.description || "No description"}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Trainers workload card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900">Active Instructors</h3>
          <div className="space-y-3">
            {membersLoading ? (
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ) : trainers.length === 0 ? (
              <p className="text-xs text-gray-500 font-semibold">No trainers assigned.</p>
            ) : (
              trainers.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#4A3ABA] flex items-center justify-center font-bold text-sm">
                    {(t.users?.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">{t.users?.full_name}</span>
                    <span className="text-xs text-gray-400 block">{t.users?.email}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
