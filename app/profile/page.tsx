"use client";

import { BackupCodesModal } from "@/components/shared/BackupCodesModal";
import { useAuth } from "@/contexts/AuthContext";
import { pb } from "@/lib/pocketbase";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function deriveInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const { currentUser, isLoading } = useAuth();
  const searchParams = useSearchParams();

  // Name form state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Email change state
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Backup codes state
  const [backupStatus, setBackupStatus] = useState<{
    total: number;
    remaining: number;
    hasActive: boolean;
  } | null>(null);
  const [backupStatusLoading, setBackupStatusLoading] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const codesExhausted = searchParams.get("backupCodesExhausted") === "1";

  async function fetchBackupStatus() {
    setBackupStatusLoading(true);
    try {
      const res = await fetch("/api/backup-codes", {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      const data = await res.json();
      setBackupStatus(data);
    } catch {
      // silent — non-critical
    } finally {
      setBackupStatusLoading(false);
    }
  }

  // Sync name field when currentUser loads or changes
  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name);
  }, [currentUser?.name]);

  // Load backup code status once user is ready
  useEffect(() => {
    if (currentUser) fetchBackupStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // AppShell handles the unauthenticated redirect; this is a safety guard.
  if (!currentUser) return null;

  // pb.authStore.record holds the raw PocketBase record including
  // created, updated, and verified fields not present in the mapped User type.
  const rawRecord = pb.authStore.record as {
    verified?: boolean;
    created?: string;
    updated?: string;
  } | null;
  const isVerified = rawRecord?.verified === true;

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError("");
    setNameSaving(true);
    setNameSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          initials: deriveInitials(name),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update name");
      // Refresh authStore so AuthContext (and navbar) reflect the new name.
      await pb.collection("users").authRefresh();
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: unknown) {
      setNameError(
        err instanceof Error ? err.message : "Failed to update name",
      );
    } finally {
      setNameSaving(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) {
      setEmailError("New email is required.");
      return;
    }
    setEmailError("");
    setEmailSending(true);
    try {
      // TODO: Wire up email verification confirmation.
      // PocketBase sends a verification link to the new address.
      // The user must click it to complete the change.
      // Consider adding a /api/auth/confirm-email route that calls
      // pb.collection("users").confirmEmailChange(token) using the
      // token extracted from the confirmation URL.
      await pb.collection("users").requestEmailChange(newEmail.trim());
      setEmailSent(true);
      setEmailExpanded(false);
      setNewEmail("");
    } catch (err: unknown) {
      setEmailError(
        err instanceof Error
          ? err.message
          : "Failed to send verification email",
      );
    } finally {
      setEmailSending(false);
    }
  }

  const nameUnchanged = name.trim() === currentUser.name;

  return (
    <div className="max-w-xl py-10 px-6 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information
        </p>
      </div>

      {/* Avatar + identity header (read-only) */}
      <div className="bg-white border border-border rounded-xl p-6 flex items-center gap-5">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ backgroundColor: currentUser.avatarColor }}
        >
          {currentUser.initials || "?"}
        </div>
        <div>
          <div className="font-semibold text-lg text-foreground">
            {currentUser.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {currentUser.email}
          </div>
          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Editable: Name */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Name</h2>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
                setNameSuccess(false);
              }}
              placeholder="Your full name"
              className={`w-full px-3 py-2 rounded-lg border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm ${
                nameError ? "border-red-400" : "border-border"
              }`}
            />
            {nameError && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">{nameError}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nameSaving || !name.trim() || nameUnchanged}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {nameSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save name"
              )}
            </button>
            {nameSuccess && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Editable: Email */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Email</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {currentUser.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailExpanded((v) => !v);
              setEmailError("");
              setNewEmail("");
            }}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
          >
            Change email{" "}
            {emailExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {emailSent && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Mail className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Verification email sent. Check your inbox and click the link to
              confirm the change.
            </p>
          </div>
        )}

        {emailExpanded && (
          <form onSubmit={handleEmailChange} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                New email address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError("");
                }}
                placeholder="new@example.com"
                autoFocus
                className={`w-full px-3 py-2 rounded-lg border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm ${
                  emailError ? "border-red-400" : "border-border"
                }`}
              />
              {emailError && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-xs text-red-700">{emailError}</p>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={emailSending || !newEmail.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {emailSending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send verification email"
              )}
            </button>
          </form>
        )}
      </div>

      {/* Backup codes management */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-600 shrink-0" />
            <h2 className="text-sm font-semibold text-foreground">
              Backup codes
            </h2>
          </div>
          {backupStatus && (
            <button
              type="button"
              onClick={() => setShowRegenerateModal(true)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
        </div>

        {codesExhausted && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              All your backup codes have been used. Generate a new set below so
              you have a fallback for future logins.
            </p>
          </div>
        )}

        {backupStatusLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking status…
          </div>
        )}

        {!backupStatusLoading && backupStatus !== null && (
          <>
            <p className="text-xs text-muted-foreground">
              One-time fallback codes for when email delivery is unavailable.
              Each code can be used only once. Store them somewhere safe.
            </p>

            {backupStatus.total === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-800">
                    No backup codes configured
                  </p>
                  <p className="text-xs text-amber-700">
                    You won&apos;t be able to sign in if email OTP is
                    unavailable.
                  </p>
                </div>
              </div>
            ) : backupStatus.remaining === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  All {backupStatus.total} codes have been used. Regenerate a
                  new set now.
                </p>
              </div>
            ) : backupStatus.remaining <= 3 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>{backupStatus.remaining}</strong> of{" "}
                  {backupStatus.total} codes remaining — consider regenerating
                  soon.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-800">
                  <strong>{backupStatus.remaining}</strong> of{" "}
                  {backupStatus.total} codes remaining
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowRegenerateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              {backupStatus.total === 0
                ? "Set up backup codes"
                : "Regenerate backup codes"}
            </button>
            {backupStatus.total > 0 && (
              <p className="text-xs text-muted-foreground">
                Regenerating will permanently invalidate all existing codes.
              </p>
            )}
          </>
        )}
      </div>

      {/* Regenerate backup codes modal */}
      <BackupCodesModal
        open={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          fetchBackupStatus();
        }}
        isFirstTime={false}
      />

      {/* Read-only: Account details */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Account details
        </h2>
        <dl className="space-y-3 divide-y divide-border">
          <div className="flex justify-between items-center text-sm py-2 first:pt-0 last:pb-0">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-foreground">{currentUser.role}</dd>
          </div>
          <div className="flex justify-between items-center text-sm py-2">
            <dt className="text-muted-foreground">Account status</dt>
            <dd>
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Pending Verification
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between items-center text-sm py-2">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-medium text-foreground">
              {formatDate(rawRecord?.created)}
            </dd>
          </div>
          <div className="flex justify-between items-center text-sm py-2 last:pb-0">
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="font-medium text-foreground">
              {formatDate(rawRecord?.updated)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
