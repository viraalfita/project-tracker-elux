"use client";

import { BackupCodesModal } from "@/components/shared/BackupCodesModal";
import { useAuth } from "@/contexts/AuthContext";
import { pb } from "@/lib/pocketbase";
import {
  AlertCircle,
  ArrowLeft,
  FolderKanban,
  KeyRound,
  Loader2,
  Mail,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "email" | "otp" | "backup-code";

export default function LoginPage() {
  const { requestOTP, verifyOTP, loginWithBackupCode } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // First-time backup code setup modal — shown after OTP login when user has no codes
  const [showSetup, setShowSetup] = useState(false);

  async function handleRequestOTP(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const id = await requestOTP(email.trim());
      setOtpId(id);
      setStep("otp");
    } catch {
      setError("No account found for this email address.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await verifyOTP(otpId, code.trim());
      // After successful OTP login, check if backup codes are configured
      await checkAndPromptBackupSetup();
    } catch {
      setError("Invalid or expired code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function checkAndPromptBackupSetup() {
    try {
      const res = await fetch("/api/backup-codes", {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      const status = await res.json();
      if (!status.hasActive) {
        setShowSetup(true); // Show first-time setup modal
      } else {
        router.push("/dashboard");
      }
    } catch {
      // Non-fatal — proceed to dashboard if check fails
      router.push("/dashboard");
    }
  }

  async function handleBackupCodeLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { remaining } = await loginWithBackupCode(
        email.trim(),
        backupCode.trim(),
      );
      if (remaining === 0) {
        // All codes exhausted — direct user to regenerate
        router.push("/profile?backupCodesExhausted=1");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid email or backup code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
              <FolderKanban className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Project Tracker
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access your workspace
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
            {/* ── Email entry step ───────────────────────────────────────────── */}
            {step === "email" && (
              <form onSubmit={handleRequestOTP} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter your email"
                    disabled={isLoading}
                    autoFocus
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send sign-in code
                    </>
                  )}
                </button>

                {/* Backup code fallback */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("backup-code");
                      setError("");
                    }}
                    className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Use a backup code instead
                  </button>
                </div>
              </form>
            )}

            {/* ── OTP verification step ─────────────────────────────────────── */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <strong className="text-foreground">{email}</strong>
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Sign-in code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ""));
                      setError("");
                    }}
                    placeholder="000000"
                    disabled={isLoading}
                    autoFocus
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground text-center text-2xl tracking-widest font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Use a different email
                </button>
              </form>
            )}

            {/* ── Backup code login step ────────────────────────────────────── */}
            {step === "backup-code" && (
              <form onSubmit={handleBackupCodeLogin} className="space-y-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-600 shrink-0" />
                  <p className="text-sm font-medium text-foreground">
                    Sign in with a backup code
                  </p>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Enter your email and one of your saved one-time backup codes.
                  Each code can be used only once.
                </p>

                <div>
                  <label
                    htmlFor="bc-email"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="bc-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter your email"
                    disabled={isLoading}
                    autoFocus
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="backup-code-input"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Backup code
                  </label>
                  <input
                    id="backup-code-input"
                    type="text"
                    value={backupCode}
                    onChange={(e) => {
                      setBackupCode(e.target.value.toUpperCase());
                      setError("");
                    }}
                    placeholder="AAAAA-BBBBB-CCCCC-DDDDD"
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground font-mono tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim() || !backupCode.trim()}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Sign in with backup code
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setBackupCode("");
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to email sign-in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* First-time backup code setup modal shown after OTP login when no codes exist */}
      <BackupCodesModal
        open={showSetup}
        onClose={() => {
          setShowSetup(false);
          router.push("/dashboard");
        }}
        isFirstTime
      />
    </>
  );
}
