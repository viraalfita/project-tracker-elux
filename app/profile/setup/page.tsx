"use client";

import { useAuth } from "@/contexts/AuthContext";
import { pb } from "@/lib/pocketbase";
import { AlertCircle, FolderKanban, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
];

function deriveInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export default function ProfileSetupPage() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Your name is required.");
      return;
    }
    setError("");
    setIsSubmitting(true);

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
          avatarColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save profile");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Preview initials from the current name input
  const previewInitials = name.trim() ? deriveInitials(name) : "?";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <FolderKanban className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Welcome to Project Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up your profile to get started
          </p>
          {currentUser?.email && (
            <p className="text-xs text-muted-foreground mt-1">
              Signed in as <span className="font-medium">{currentUser.email}</span>
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8 space-y-6">
          {/* Avatar preview */}
          <div className="flex justify-center">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-md transition-colors"
              style={{ backgroundColor: avatarColor }}
            >
              {previewInitials}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="e.g. Budi Santoso"
                autoFocus
                required
                className={`w-full px-4 py-3 rounded-lg border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                  error ? "border-red-400" : "border-border"
                }`}
              />
              {error && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Avatar color */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Avatar color
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                      avatarColor === color
                        ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                "Save and continue"
              )}
            </button>
          </form>

          <div className="border-t border-border pt-4 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
