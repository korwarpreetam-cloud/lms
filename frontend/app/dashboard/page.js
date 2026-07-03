"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { useQuery } from "../../lib/hooks";
import { fetchAdminMetrics } from "../../lib/queries";

export default function DashboardPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  const { data: metrics, loading: metricsLoading } = useQuery(
    () => fetchAdminMetrics(activeOrgId),
    [activeOrgId]
  );

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-purple-950 rounded-3xl p-8 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full uppercase tracking-wider">
            Control Panel
          </span>
          <h1 className="text-3xl font-black mt-3 text-white tracking-tight">
            Owner Console
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-xl">
            High-level platform oversight. Manage school tenants, core team roles, and platform content guidelines.
          </p>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-12 mb-2" />
            </div>
          ))
        ) : (metrics ?? []).map((metric) => (
          <div
            key={metric.label}
            className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm"
          >
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              {metric.label}
            </p>
            <p className="text-2xl font-black mt-1 text-gray-900">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Owner Scope Operations ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Content (Curriculum Connection) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
            </div>
            <h3 className="text-lg font-black text-gray-900">Content & Curriculum Flow</h3>
            <p className="text-xs text-gray-500 mt-2">
              Access the dynamic curriculum path: Courses (e.g. 6-7class, 8-9class) with Chapters and Lectures (PDF, Assignments, Quizzes).
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/courses")}
            className="w-full bg-[#4A3ABA] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#3A2A9A] transition-all"
          >
            Open Curriculum flow →
          </button>
        </div>

        {/* School Management */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            </div>
            <h3 className="text-lg font-black text-gray-900">School Provisioning</h3>
            <p className="text-xs text-gray-500 mt-2">
              Provision, rename, or temporarily suspend school branches and organizational tenants.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/schools")}
            className="w-full bg-amber-500 text-gray-950 py-2.5 rounded-xl text-xs font-bold hover:bg-amber-650 transition-all"
          >
            Manage School Tenants →
          </button>
        </div>

        {/* Core Team Management */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h3 className="text-lg font-black text-gray-900">Core Team & Trainers</h3>
            <p className="text-xs text-gray-500 mt-2">
              Invite administrators, operational team members, and class trainers into the workspace.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/team")}
            className="w-full bg-[#4A3ABA] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#3A2A9A] transition-all"
          >
            Invite Members →
          </button>
        </div>

      </div>
    </div>
  );
}
