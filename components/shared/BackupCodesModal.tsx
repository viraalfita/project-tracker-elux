"use client";

/**
 * BackupCodesModal
 *
 * Shown in two scenarios:
 *   1. First-time setup: after the user's first OTP login when they have no codes.
 *   2. Regeneration: triggered from the Profile page.
 *
 * On open it immediately calls POST /api/backup-codes to generate a fresh set.
 * The raw codes are rendered once and then discarded — they cannot be recovered.
 *
 * Props:
 *   open        — controls visibility
 *   onClose     — called after user confirms they've saved codes
 *   token       — PocketBase auth token (required for the API call)
 *   isFirstTime — if true, shows extra onboarding copy and hides the "Cancel" button
 */

import { pb } from "@/lib/pocketbase";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BackupCodesModalProps {
  open: boolean;
  onClose: () => void;
  isFirstTime?: boolean;
}

type Phase = "loading" | "display" | "error";

export function BackupCodesModal({
  open,
  onClose,
  isFirstTime = false,
}: BackupCodesModalProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [codes, setCodes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Generate codes whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setCodes([]);
    setCopied(false);
    setConfirmed(false);
    setErrorMsg("");

    (async () => {
      try {
        const res = await fetch("/api/backup-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pb.authStore.token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to generate codes");
        setCodes(data.codes ?? []);
        setPhase("display");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setPhase("error");
      }
    })();
  }, [open]);

  if (!open) return null;

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleCopyAll() {
    const text = codes.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleDownload() {
    const date = new Date().toISOString().slice(0, 10);
    const content = [
      "Project Tracker — Backup Codes",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Each code can be used ONCE to sign in when email OTP is unavailable.",
      "Keep this file somewhere safe and private.",
      "",
      ...codes,
      "",
      "Once all codes are used, generate new ones from your Profile page.",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-codes-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">
              {isFirstTime ? "Set up backup codes" : "New backup codes"}
            </h2>
            <p className="text-indigo-200 text-xs mt-0.5">
              {isFirstTime
                ? "One-time recovery codes for when email OTP is unavailable"
                : "Previous codes have been invalidated"}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Loading */}
          {phase === "loading" && (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Generating codes…</span>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">
                  Failed to generate codes
                </p>
                <p className="text-xs text-red-700">{errorMsg}</p>
                <p className="text-xs text-red-600">
                  Make sure the backup_codes collection exists in PocketBase
                  (run{" "}
                  <code className="bg-red-100 px-1 rounded">
                    npx tsx scripts/setup-backup-codes.ts
                  </code>
                  ).
                </p>
              </div>
            </div>
          )}

          {/* Codes display */}
          {phase === "display" && (
            <>
              {/* Info banner */}
              {isFirstTime && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">
                      Save these codes before continuing
                    </p>
                    <p>
                      Each code can be used <strong>once</strong> to sign in
                      when you can't receive email. We will never show them
                      again.
                    </p>
                  </div>
                </div>
              )}

              {/* Code grid */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Your {codes.length} backup codes
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {codes.map((code, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center tracking-widest text-slate-800 select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy all
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-foreground">
                  I have saved my backup codes in a secure location
                </span>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3">
          {/* Cancel — only shown on regeneration flow, not first-time */}
          {!isFirstTime && phase !== "loading" && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Error retry */}
          {phase === "error" && (
            <button
              type="button"
              onClick={() => {
                setPhase("loading");
                // Re-trigger useEffect by toggling a state — use closed/open
                // trick: just set phase to loading and call again
                setErrorMsg("");
                // Manually re-invoke generation
                (async () => {
                  try {
                    const res = await fetch("/api/backup-codes", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${pb.authStore.token}`,
                      },
                    });
                    const data = await res.json();
                    if (!res.ok)
                      throw new Error(data.error ?? "Failed to generate codes");
                    setCodes(data.codes ?? []);
                    setPhase("display");
                  } catch (err: unknown) {
                    setErrorMsg(
                      err instanceof Error ? err.message : "Unknown error",
                    );
                    setPhase("error");
                  }
                })();
              }}
              className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Try again
            </button>
          )}

          {/* Done / Continue */}
          {phase === "display" && (
            <button
              type="button"
              onClick={onClose}
              disabled={!confirmed}
              className="ml-auto px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isFirstTime ? "Continue to dashboard" : "Done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
