"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export default function StudentProfilePage() {
  const { user, claims, refreshClaims } = useAuth();
  const { showToast } = useToast();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  const activeOrgName = claims?.memberships?.find(
    (m) => m.org_id === claims.active_org_id
  )?.org_name || "LMS Platform";

  const activeRoleLabel = claims?.active_role
    ? claims.active_role.replace("_", " ")
    : "Student";

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast("Full name cannot be empty", "warning");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (error) throw error;

      showToast("Profile settings updated successfully!", "success");
      // Refresh context claims to reload active JWT state
      await refreshClaims();
    } catch (err: any) {
      showToast(err.message || "Failed to update profile settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Student Profile</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Review your tenant permissions, platform roles, and edit your profile credentials.
        </p>
      </div>

      {/* Profile Form */}
      <Card accentBar>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>
            Update the credentials associated with your active learning portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-5">
            {/* Read-only school tenant */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Active Organization
              </label>
              <div className="px-4 py-3 rounded-xl border border-gray-150 bg-gray-50 text-sm font-semibold text-gray-650 select-none">
                {activeOrgName}
              </div>
            </div>

            {/* Read-only account email */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Account Email
              </label>
              <div className="px-4 py-3 rounded-xl border border-gray-150 bg-gray-50 text-sm font-mono text-gray-500 select-none">
                {user?.email}
              </div>
            </div>

            {/* Read-only active role */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Assigned Platform Role
              </label>
              <div className="px-4 py-3 rounded-xl border border-gray-150 bg-gray-50 text-sm font-semibold text-gray-650 capitalize select-none">
                {activeRoleLabel}
              </div>
            </div>

            <hr className="border-gray-100 my-2" />

            {/* Changeable Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-semibold"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 mt-2"
              isLoading={saving}
            >
              Save Profile Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
