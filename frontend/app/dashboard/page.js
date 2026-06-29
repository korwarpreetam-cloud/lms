"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../lib/hooks";
import { fetchAdminMetrics, fetchMembers, fetchCourses } from "../../lib/queries";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { createClient } from "../../lib/auth";

/* ── Feature Data ──────────────────────────────────────────── */

const featureCards = [
  {
    id: "schools",
    title: "School Management",
    description: "Create, edit, and manage all schools on the platform",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    features: [
      { name: "Create School", desc: "Set up a new school with name, location, and configuration" },
      { name: "Edit School", desc: "Update school details, branding, and settings" },
      { name: "Deactivate School", desc: "Temporarily disable a school and all its operations" },
    ],
  },
  {
    id: "team",
    title: "Core Team",
    description: "Manage team members, roles, and permissions",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    features: [
      { name: "Add Team Member", desc: "Invite new members to your core team with email invitations" },
      { name: "Assign Roles", desc: "Set admin, manager, or viewer roles for each member" },
      { name: "Manage Permissions", desc: "Fine-tune access controls and feature permissions" },
    ],
  },
  {
    id: "trainers",
    title: "Trainer Management",
    description: "Add, assign, and manage trainers across schools",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    features: [
      { name: "Add Trainer", desc: "Register new trainers with their qualifications and expertise" },
      { name: "Assign Trainer", desc: "Assign trainers to specific schools and courses" },
      { name: "Transfer Trainer", desc: "Move trainers between schools or departments" },
    ],
  },
  {
    id: "courses",
    title: "Course Management",
    description: "Create courses, modules, and upload learning content",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    features: [
      { name: "Create Course", desc: "Design new courses with titles, descriptions, and enrollment criteria" },
      { name: "Create Modules", desc: "Break courses into structured learning modules and lessons" },
      { name: "Upload Videos", desc: "Add video lectures and tutorials to course modules" },
      { name: "Upload PDFs", desc: "Attach documents, worksheets, and reading materials" },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    description: "View detailed analytics and generate reports",
    color: "purple",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    features: [
      { name: "School Reports", desc: "Performance metrics and analytics for each school" },
      { name: "Trainer Reports", desc: "Trainer activity, hours, and effectiveness reports" },
      { name: "Student Reports", desc: "Student progress, grades, and attendance tracking" },
      { name: "Revenue Reports", desc: "Financial analytics, billing, and revenue breakdowns" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Configure platform settings and preferences",
    color: "amber",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1.003 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    features: [
      { name: "Platform Settings", desc: "General configuration, branding, and appearance" },
      { name: "Notification Settings", desc: "Configure email, SMS, and push notification preferences" },
      { name: "API Keys", desc: "Manage API keys and third-party integrations" },
    ],
  },
];

const announcements = [
  "🎓 New course curriculum guidelines published — review before next Monday",
  "🏫 Welcome to solutiions LMS — add your first school, trainers, and students",
  "📊 All dashboards now pull live data from your Supabase backend",
];

/* ── Dashboard Component ───────────────────────────────────── */

export default function DashboardPage() {
  const [activeCard, setActiveCard] = useState(null);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  
  const { claims, switchOrg, refreshClaims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  useEffect(() => {
    refreshClaims();
  }, [refreshClaims]);

  const { data: metrics, loading: metricsLoading, refetch: refetchMetrics } = useQuery(() => fetchAdminMetrics(activeOrgId), [activeOrgId]);
  const { data: members, refetch: refetchMembers } = useQuery(() => fetchMembers(activeOrgId), [activeOrgId]);
  const { data: courses, refetch: refetchCourses } = useQuery(() => fetchCourses(activeOrgId), [activeOrgId]);

  // Modal states
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [isEditSchoolOpen, setIsEditSchoolOpen] = useState(false);
  const [isDeactivateSchoolOpen, setIsDeactivateSchoolOpen] = useState(false);

  // Form states
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolSlug, setNewSchoolSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleCreateSchoolSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { data: newOrgId, error } = await supabase.rpc('create_organization', {
        p_name: newSchoolName,
        p_slug: newSchoolSlug
      });

      if (error) throw error;

      showToast("School created successfully!", "success");
      setIsCreateSchoolOpen(false);
      setNewSchoolName("");
      setNewSchoolSlug("");

      if (refetchMetrics) refetchMetrics();
      if (refetchMembers) refetchMembers();
      if (refetchCourses) refetchCourses();

      // Switch to new school
      if (newOrgId) {
        showToast("Switching to new school...", "info");
        await switchOrg(newOrgId);
      }
    } catch (err) {
      showToast(err.message || "Failed to create school. Make sure the database migration is applied.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSchoolSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: editName, updated_at: new Date().toISOString() })
        .eq('id', activeOrgId);

      if (error) throw error;

      showToast("School name updated successfully!", "success");
      setIsEditSchoolOpen(false);
      setEditName("");
      await switchOrg(activeOrgId);
      if (refetchMetrics) refetchMetrics();
      if (refetchCourses) refetchCourses();
    } catch (err) {
      showToast(err.message || "Failed to edit school", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateSchool = async () => {
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', activeOrgId);

      if (error) throw error;

      showToast("School deactivated successfully", "success");
      setIsDeactivateSchoolOpen(false);
      
      const otherOrg = claims?.memberships?.find(m => m.org_id !== activeOrgId);
      if (otherOrg) {
        await switchOrg(otherOrg.org_id);
      } else {
        window.location.reload();
      }
    } catch (err) {
      showToast(err.message || "Failed to deactivate school", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeatureActionClick = (featName) => {
    if (featName === "Create School") {
      setNewSchoolName("");
      setNewSchoolSlug("");
      setIsCreateSchoolOpen(true);
    } else if (featName === "Edit School") {
      const activeOrg = claims?.memberships?.find(m => m.org_id === activeOrgId);
      setEditName(activeOrg?.org_name || "");
      setIsEditSchoolOpen(true);
    } else if (featName === "Deactivate School") {
      setIsDeactivateSchoolOpen(true);
    } else {
      showToast(`Action "${featName}" mapped successfully!`, "info");
    }
  };

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
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                <span className="text-xs font-semibold text-green-600">Live</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Live Data Summary ── */}
      {members && members.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Team Members</h3>
          <div className="space-y-2">
            {members.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#4A3ABA]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#4A3ABA]">
                      {(m.users?.full_name || m.users?.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.users?.full_name || m.users?.email}</p>
                    <p className="text-xs text-gray-400">{m.users?.email}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  m.roles?.code === 'owner' ? 'bg-purple-100 text-[#4A3ABA]' :
                  m.roles?.code === 'core_team' ? 'bg-blue-100 text-blue-700' :
                  m.roles?.code === 'trainer' ? 'bg-amber-100 text-[#E09000]' :
                  'bg-green-100 text-green-700'
                }`}>{m.roles?.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {courses && courses.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Courses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((c) => (
              <div key={c.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h4 className="font-semibold text-gray-900 text-sm">{c.name}</h4>
                {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>{c.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Feature Cards Grid ── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeFeature.features.map((feat, idx) => (
                <div
                  key={feat.name}
                  onClick={() => handleFeatureActionClick(feat.name)}
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

      {/* Create School Modal */}
      {isCreateSchoolOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsCreateSchoolOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-150 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]" />
            <form onSubmit={handleCreateSchoolSubmit} className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Create School</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Add a new organization/school to the Solutiions LMS platform.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swaminarayan Academy"
                    value={newSchoolName}
                    onChange={(e) => {
                      setNewSchoolName(e.target.value);
                      setNewSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Slug (URL identifier)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. swaminarayan"
                    value={newSchoolSlug}
                    onChange={(e) => setNewSchoolSlug(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#4A3ABA] outline-none text-gray-900 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSchoolOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-250 rounded-xl cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#4A3ABA] hover:bg-[#3A2A9A] rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating..." : "Create School"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {isEditSchoolOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsEditSchoolOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-150 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#F5A623] to-[#FFC857]" />
            <form onSubmit={handleEditSchoolSubmit} className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Edit School</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Update the name of the active organization.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swaminarayan Academy"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-[#F5A623] outline-none text-gray-900 font-semibold"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditSchoolOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-250 rounded-xl cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#F5A623] hover:bg-[#E09000] rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate School Modal */}
      {isDeactivateSchoolOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsDeactivateSchoolOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-150 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Deactivate School</h3>
                <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed text-gray-650">
                  Are you sure you want to deactivate the active school? This will temporarily disable access to all courses, classrooms, and rosters under this school.
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeactivateSchoolOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-550 border border-gray-250 rounded-xl hover:text-gray-900 cursor-pointer"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateSchool}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Deactivating..." : "Deactivate School"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
