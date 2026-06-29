"use client";

import { useState } from "react";
import { useQuery } from "../../lib/hooks";
import { fetchAdminMetrics } from "../../lib/queries";

/* ── Feature Data ──────────────────────────────────────────── */

const featureCards = [
  {
    id: "students",
    title: "Student Management",
    description: "Manage day-to-day student records, enrollments, and statuses",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    features: [
      { name: "Add Student", desc: "Register a new student with contact details and branch assignments" },
      { name: "Update Student", desc: "Modify student profiles, contact details, and enrolled classes" },
      { name: "Move Student", desc: "Transfer students between schools, branches, or classes" },
      { name: "Deactivate Student", desc: "Temporarily or permanently disable student access and enrollments" },
    ],
  },
  {
    id: "scheduling",
    title: "Scheduling & Allocation",
    description: "Assign classes, manage timetables, and allocate trainers to schools",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    features: [
      { name: "Assign Classes", desc: "Schedule courses and batches into specific classrooms and slots" },
      { name: "Manage Timetable", desc: "Create, view, and adjust the weekly timetable across schools" },
      { name: "Trainer Allocation", desc: "Assign qualified trainers to courses based on schedules and availability" },
    ],
  },
  {
    id: "courses",
    title: "Course Support",
    description: "Upload resources, update course materials, and manage assignments",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    features: [
      { name: "Upload Resources", desc: "Upload lectures, worksheets, PDFs, and reading guides for courses" },
      { name: "Update Content", desc: "Refresh syllabus materials, update links, and edit lesson content" },
      { name: "Manage Assignments", desc: "Create, schedule, and assign projects and homework to batches" },
    ],
  },
  {
    id: "reports",
    title: "Operational Reports",
    description: "Track progress, compile attendance, and export course progress reports",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    features: [
      { name: "Attendance Reports", desc: "Compile daily, weekly, and monthly attendance reports across schools" },
      { name: "Course Progress Reports", desc: "Review curriculum completion rates and batch learning velocity" },
    ],
  },
];

const announcements = [
  "🏫 Operations checklist updated for school onboarding",
  "📅 Trainer allocation schedules for next term must be finalized by Friday",
  "📊 All dashboards now show live data from your Supabase backend",
];

/* ── Dashboard Component ───────────────────────────────────── */

export default function DashboardPage() {
  const [activeCard, setActiveCard] = useState(null);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const { data: metrics, loading: metricsLoading } = useQuery(fetchAdminMetrics);
  const handleCardClick = (id) => {
    setActiveCard(activeCard === id ? null : id);
  };

  const activeFeature = featureCards.find((c) => c.id === activeCard);

  return (
    <div className="space-y-8">
      {/* ── Announcement Banner ── */}
      <div className="bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7] rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Today&apos;s News
              </span>
            </div>
            <p className="text-sm md:text-base font-medium text-white/90 mt-2">
              {announcements[announcementIndex]}
            </p>
          </div>
          <div className="flex gap-1 ml-4">
            <button
              onClick={() =>
                setAnnouncementIndex(
                  (announcementIndex - 1 + announcements.length) %
                    announcements.length
                )
              }
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button
              onClick={() =>
                setAnnouncementIndex(
                  (announcementIndex + 1) % announcements.length
                )
              }
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-12 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-10" />
            </div>
          ))
        ) : (metrics ?? []).map((metric) => (
          <div
            key={metric.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {metric.label}
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                metric.color === "purple" ? "text-[#4A3ABA]" : "text-[#E09000]"
              }`}
            >
              {metric.value}
            </p>
            {metric.trend && (
              <div className="flex items-center gap-1 mt-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                <span className="text-xs font-semibold text-green-600">Live</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Feature Cards Grid ── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Quick Actions
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
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Feature list */}
          <div className="p-8">
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
                  <div className="mt-3 flex justify-end">
                    <span
                      className={`text-xs font-semibold flex items-center gap-1 ${
                        activeFeature.color === "purple"
                          ? "text-[#4A3ABA]"
                          : "text-[#F5A623]"
                      } opacity-0 group-hover:opacity-100 transition-opacity`}
                    >
                      Open
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </span>
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
