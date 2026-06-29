"use client";

import React, { useState } from "react";
import { createInvite, sendInviteEmail } from "../../lib/mutations";
import { stepUpMfa } from "../../lib/mfa";
import { Button } from "../ui/Button";
import { useToast } from "../../hooks/useToast";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess?: () => void;
}

export default function InviteModal({ isOpen, onClose, orgId, onSuccess }: InviteModalProps) {
  const { showToast } = useToast();
  
  // Tab states: 'invite' | 'instant'
  const [activeTab, setActiveTab] = useState<"invite" | "instant">("invite");
  
  // Common states
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState("student");
  
  // Invite-only states
  const [sendEmailMethod, setSendEmailMethod] = useState(true);
  
  // Instant-only states
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("password123");
  const [branch, setBranch] = useState("Main Campus");
  
  // UI Steps: 'form' | 'mfa' | 'success'
  const [step, setStep] = useState<"form" | "mfa" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // MFA step state (only used for RLS step-up on Invite generation)
  const [mfaCode, setMfaCode] = useState("");
  
  // Success states
  const [inviteUrl, setInviteUrl] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string } | null>(null);

  if (!isOpen) return null;

  // Invite Flow
  const performInvitation = async () => {
    if (sendEmailMethod) {
      try {
        await sendInviteEmail(email, orgId, roleCode);
        setEmailSent(true);
        setInviteUrl("");
        setRawToken("");
        setStep("success");
        showToast("Invitation email sent successfully!", "success");
      } catch (err: any) {
        console.warn("Edge Function send-invite failed. Falling back to direct link...", err);
        showToast("Email function unavailable, generating direct secure link...", "info");
        
        const inviteData = await createInvite(email, orgId, roleCode);
        if (inviteData) {
          const url = `${window.location.origin}/accept-invite?token=${inviteData.raw_token}`;
          setInviteUrl(url);
          setRawToken(inviteData.raw_token);
          setEmailSent(false);
          setStep("success");
          showToast("Direct invite token created successfully!", "success");
        }
      }
    } else {
      const inviteData = await createInvite(email, orgId, roleCode);
      if (inviteData) {
        const url = `${window.location.origin}/accept-invite?token=${inviteData.raw_token}`;
        setInviteUrl(url);
        setRawToken(inviteData.raw_token);
        setEmailSent(false);
        setStep("success");
        showToast("Direct invite token created successfully!", "success");
      }
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await performInvitation();
    } catch (err: any) {
      if (err.message && err.message.includes("MFA_REQUIRED")) {
        setStep("mfa");
        showToast("MFA Step-up authentication required", "warning");
      } else {
        setError(err.message || "Failed to create invite");
        showToast(err.message || "Invitation failed", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await stepUpMfa(mfaCode);
      showToast("Security code verified, retrying invitation...", "info");
      await performInvitation();
    } catch (err: any) {
      setError(err.message || "MFA Verification failed");
      showToast(err.message || "MFA validation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Instant Creation Flow
  const handleInstantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          roleCode,
          organizationId: orgId,
          branch: roleCode === "student" ? branch : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create user account");
      }

      setCreatedCredentials({ email, pass: password });
      setStep("success");
      showToast("User account created successfully in DB!", "success");
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Internal Server Error");
      showToast(err.message || "Creation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast("Invite URL copied to clipboard!", "success");
  };

  const handleCopyCreds = () => {
    if (createdCredentials) {
      navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.pass}`);
      showToast("Credentials copied to clipboard!", "success");
    }
  };

  const handleClose = () => {
    setEmail("");
    setRoleCode("student");
    setFullName("");
    setPassword("password123");
    setBranch("Main Campus");
    setSendEmailMethod(true);
    setStep("form");
    setMfaCode("");
    setInviteUrl("");
    setRawToken("");
    setEmailSent(false);
    setCreatedCredentials(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity" 
        onClick={step !== "success" && !loading ? handleClose : undefined}
      />

      {/* Modal Content */}
      <div 
        className="relative bg-white w-full max-w-md rounded-3xl p-8 border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />

        {step === "form" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Add User</h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Add a trainer, team member, student, or owner to this school.</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-150 gap-1">
              <button
                type="button"
                onClick={() => { setActiveTab("invite"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                  activeTab === "invite"
                    ? "bg-[#4A3ABA] text-white shadow"
                    : "text-gray-400 hover:text-gray-900"
                }`}
              >
                Send Invite
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("instant"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                  activeTab === "instant"
                    ? "bg-[#4A3ABA] text-white shadow"
                    : "text-gray-400 hover:text-gray-900"
                }`}
              >
                Instant Creation
              </button>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {activeTab === "invite" ? (
              <form onSubmit={handleInviteSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none text-gray-900 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Platform Role</label>
                    <select
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-semibold capitalize"
                    >
                      <option value="student">Student</option>
                      <option value="trainer">Trainer</option>
                      <option value="core_team">Core Team</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-150">
                    <input
                      type="checkbox"
                      id="send-email-checkbox"
                      checked={sendEmailMethod}
                      onChange={(e) => setSendEmailMethod(e.target.checked)}
                      className="w-4.5 h-4.5 text-[#4A3ABA] border-gray-300 rounded focus:ring-[#4A3ABA] cursor-pointer"
                    />
                    <label htmlFor="send-email-checkbox" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                      Send secure invite email automatically
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isLoading={loading}>
                    Send Invite
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleInstantSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none text-gray-900 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none text-gray-900 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Password</label>
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-semibold font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Role Code</label>
                    <select
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-semibold capitalize"
                    >
                      <option value="student">Student</option>
                      <option value="trainer">Trainer</option>
                      <option value="core_team">Core Team</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                </div>

                {roleCode === "student" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-555 uppercase tracking-wider mb-2">Campus Branch</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Swaminarayan Campus"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] outline-none text-gray-900 transition-all font-medium"
                    />
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isLoading={loading}>
                    Create Account
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === "mfa" && (
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                <svg className="w-8 h-8 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Step-up MFA Required</h3>
              <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
                Creating invites is a privileged action. Enter the 6-digit verification code from your authenticator app to authorize this request.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white focus:border-[#4A3ABA] outline-none text-gray-900 text-center tracking-widest text-xl font-bold"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("form")} disabled={loading}>
                Back
              </Button>
              <Button type="submit" variant="secondary" className="flex-1" isLoading={loading} disabled={mfaCode.length !== 6}>
                Verify & Submit
              </Button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            {createdCredentials ? (
              <>
                <div>
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 .5a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Account Created!</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">The account was directly registered in Supabase Auth & LMS.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-left">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email Address</div>
                    <div className="text-xs text-gray-650 font-mono truncate font-semibold mt-1">
                      {createdCredentials.email}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-left">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Login Password</div>
                    <div className="text-xs text-gray-650 font-mono truncate font-semibold mt-1">
                      {createdCredentials.pass}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={handleCopyCreds}>
                    Copy Credentials
                  </Button>
                  <Button type="button" variant="primary" className="flex-1" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </>
            ) : emailSent ? (
              <>
                <div>
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12zM3 7l9 6 9-6" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Email Sent!</h3>
                  <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
                    An invitation email has been successfully sent to <span className="font-bold text-gray-900">{email}</span>. 
                    They will receive activation instructions in their inbox shortly.
                  </p>
                </div>

                <div className="pt-2">
                  <Button type="button" variant="primary" className="w-full" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Direct Token Generated</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">Copy this invitation link and send it manually.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-left">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Invitation Link</div>
                    <div className="text-xs text-gray-650 font-mono break-all font-semibold select-all mt-1">
                      {inviteUrl}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 text-left">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Raw Secure Token</div>
                    <div className="text-xs text-gray-650 font-mono truncate font-semibold mt-1">
                      {rawToken}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={handleCopy}>
                    Copy Link
                  </Button>
                  <Button type="button" variant="primary" className="flex-1" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
