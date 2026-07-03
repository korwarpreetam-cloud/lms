"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import OrgSwitcher from "./OrgSwitcher";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon helper components for clean rendering
const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Schools: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Team: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Trainers: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Courses: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Students: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  Projects: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Reports: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Schedules: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Attendance: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  ),
  Assignments: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Certificates: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Profile: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

const navigationByRole: Record<string, { name: string; href: string; icon: React.ReactNode }[]> = {
  owner: [
    { name: "Dashboard", href: "/dashboard", icon: <Icons.Dashboard /> },
    { name: "Schools", href: "/dashboard/schools", icon: <Icons.Schools /> },
    { name: "Team", href: "/dashboard/team", icon: <Icons.Team /> },
    { name: "Trainers", href: "/dashboard/trainers", icon: <Icons.Trainers /> },
    { name: "Courses", href: "/dashboard/courses", icon: <Icons.Courses /> },
    { name: "Students", href: "/dashboard/students", icon: <Icons.Students /> },
    { name: "Projects", href: "/dashboard/projects", icon: <Icons.Projects /> },
    { name: "Reports", href: "/dashboard/reports", icon: <Icons.Reports /> },
    { name: "Settings", href: "/dashboard/settings", icon: <Icons.Settings /> },
  ],
  core_team: [
    { name: "Dashboard", href: "/dashboard-team", icon: <Icons.Dashboard /> },
    { name: "Students", href: "/dashboard-team/students", icon: <Icons.Students /> },
    { name: "Schedules", href: "/dashboard-team/schedules", icon: <Icons.Schedules /> },
    { name: "Courses", href: "/dashboard-team/courses", icon: <Icons.Courses /> },
    { name: "Schools", href: "/dashboard-team/schools", icon: <Icons.Schools /> },
    { name: "Reports", href: "/dashboard-team/reports", icon: <Icons.Reports /> },
  ],
  trainer: [
    { name: "Dashboard", href: "/dashboard-trainer", icon: <Icons.Dashboard /> },
    { name: "Attendance", href: "/dashboard-trainer/attendance", icon: <Icons.Attendance /> },
    { name: "Assignments", href: "/dashboard-trainer/assignments", icon: <Icons.Assignments /> },
    { name: "Students", href: "/dashboard-trainer/students", icon: <Icons.Students /> },
    { name: "Classes", href: "/dashboard-trainer/classes", icon: <Icons.Schedules /> },
    { name: "Projects", href: "/dashboard-trainer/projects", icon: <Icons.Projects /> },
  ],
};

const roleLabels: Record<string, string> = {
  owner: "Owner Panel",
  core_team: "Core Team",
  trainer: "Trainer Space",
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { claims, logout } = useAuth();
  
  const activeRole = claims?.active_role || "trainer";
  const navItems = navigationByRole[activeRole] || navigationByRole.trainer;

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col h-full border-r border-gray-800 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand Logo & Context Switcher */}
      <div className="px-6 py-6 border-b border-gray-850 flex flex-col space-y-4 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#4A3ABA] flex items-center justify-center shadow-lg shadow-purple-900/30">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              solutiions<span className="text-[#F5A623]">.com</span>
            </span>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">
              {roleLabels[activeRole]}
            </div>
          </div>
        </Link>

        {/* Tenant switcher */}
        <OrgSwitcher />
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isDashboardRoot = item.href === "/dashboard" || item.href === "/dashboard-team" || item.href === "/dashboard-trainer" || item.href === "/dashboard-student";
          const isActive = isDashboardRoot
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                isActive
                  ? "bg-[#4A3ABA] text-white shadow-lg shadow-purple-900/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <span
                className={`${
                  isActive
                    ? "text-white"
                    : "text-gray-500 group-hover:text-[#F5A623]"
                } transition-colors shrink-0`}
              >
                {item.icon}
              </span>
              {item.name}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer (Logout) */}
      <div className="px-4 py-4 border-t border-gray-850 shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-red-400 hover:bg-gray-800/60 transition-all duration-200 text-left"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
