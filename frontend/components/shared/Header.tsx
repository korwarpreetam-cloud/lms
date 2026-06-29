"use client";

import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";

interface HeaderProps {
  onMenuClick: () => void;
}

const roleBadgeConfigs: Record<
  string,
  { label: string; variant: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "gray" }
> = {
  owner: { label: "Owner", variant: "primary" },
  core_team: { label: "Core Team", variant: "info" },
  trainer: { label: "Trainer", variant: "secondary" },
  student: { label: "Student", variant: "success" },
};

const roleFriendlyNames: Record<string, string> = {
  owner: "Owner",
  core_team: "Core Team",
  trainer: "Trainer",
  student: "Student",
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, claims } = useAuth();
  
  const activeRole = claims?.active_role || "student";
  const badgeConfig = roleBadgeConfigs[activeRole] || { label: "User", variant: "gray" as const };
  const roleName = roleFriendlyNames[activeRole] || "User";

  // Use full name from metadata if available, otherwise role
  const displayName = user?.user_metadata?.full_name || roleName;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left section: Mobile menu toggle + Greeting */}
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Greetings */}
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-1.5">
            Hi, {displayName} 👋
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Welcome back to your dashboard
          </p>
        </div>
      </div>

      {/* Right section: Actions & Role Badge */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="relative p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-gray-200" />

        {/* Role status badge */}
        <div className="hidden sm:flex items-center gap-2">
          <Badge variant={badgeConfig.variant} size="md" className="font-bold uppercase tracking-wider py-1 px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-ping" />
            {badgeConfig.label}
          </Badge>
        </div>
      </div>
    </header>
  );
}
