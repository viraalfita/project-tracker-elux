"use client";

import { pb } from "@/lib/pocketbase";
import { AlertCircle, CheckCircle2, FolderKanban, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ConfirmEmailChangeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auto-confirm as soon as the page loads with a valid token
  useEffect(() => {
    if (!token || isSubmitting || success) return;
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
        <p className="text-sm text-red-700">
          Invalid or missing confirmation token. Please request a new email
          change from your profile page.
        </p>
      </div>
    );
  }

  async function confirm() {
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/confirm-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Failed to confirm email change");
      setSuccess(true);
      // Clear the auth session — user must log in with the new email
      pb.authStore.clear();
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to confirm email change. The link may have expired.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Email updated!
        </h2>
        <p className="text-sm text-muted-foreground">
          Your email address has been changed. Redirecting you to login…
        </p>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-muted-foreground">
          Confirming your new email…
        </p>
      </div>
    );
  }

  // Only shown if auto-confirm failed
  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button
        onClick={confirm}
        disabled={isSubmitting}
        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        Try again
      </button>
    </div>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <FolderKanban className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Confirm email change
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifying your new email address…
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <ConfirmEmailChangeForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
