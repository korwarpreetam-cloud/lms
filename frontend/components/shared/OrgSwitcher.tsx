"use client";

import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { Dropdown, DropdownItem } from "../ui/Dropdown";

export default function OrgSwitcher() {
  const { claims, switchOrg } = useAuth();
  const { showToast } = useToast();

  if (!claims || !claims.memberships || claims.memberships.length === 0) {
    return null;
  }

  // Find currently active organization details
  const activeOrg = claims.memberships.find(
    (m) => m.org_id === claims.active_org_id
  );

  if (claims.memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700/50 text-white select-none">
        <div className="w-8 h-8 rounded-lg bg-[#4A3ABA] flex items-center justify-center font-bold text-sm shrink-0">
          {activeOrg?.org_name?.charAt(0) || "S"}
        </div>
        <span className="text-sm font-semibold truncate">
          {activeOrg?.org_name || "Solutiions LMS"}
        </span>
      </div>
    );
  }

  const handleSwitch = async (orgId: string, orgName: string) => {
    if (orgId === claims.active_org_id) return;
    try {
      showToast(`Switching to ${orgName}...`, "info");
      await switchOrg(orgId);
      showToast(`Switched to ${orgName}`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to switch organization", "error");
    }
  };

  const trigger = (
    <button className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700/80 text-white border border-gray-700/50 transition-colors text-left group">
      <div className="w-8 h-8 rounded-lg bg-[#4A3ABA] flex items-center justify-center font-bold text-sm shrink-0 shadow-lg">
        {activeOrg?.org_name?.charAt(0) || "S"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate leading-tight">
          {activeOrg?.org_name || "Select School"}
        </div>
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-none mt-0.5">
          Switch Organization
        </div>
      </div>
      <svg className="w-4 h-4 text-gray-450 shrink-0 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <Dropdown trigger={trigger} className="w-full">
      {claims.memberships.map((membership) => (
        <DropdownItem
          key={membership.org_id}
          active={membership.org_id === claims.active_org_id}
          onClick={() => handleSwitch(membership.org_id, membership.org_name)}
        >
          <div className="flex flex-col">
            <span className="truncate font-semibold">{membership.org_name}</span>
            <span className="text-[10px] text-gray-400 font-medium capitalize mt-0.5">
              Role: {membership.role.replace("_", " ")}
            </span>
          </div>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
