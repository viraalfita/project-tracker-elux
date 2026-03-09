"use client";

// NOTE: OTP login is temporarily disabled. Password login is active.
// To re-enable OTP: swap the form below for the OTP two-step flow
// using requestOTP / verifyOTP from useAuth().

import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, FolderKanban, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
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

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter your password"
                disabled={isLoading}
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
              disabled={isLoading || !email || !password}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Dev credentials */}
        <div className="mt-6 p-4 bg-white/50 rounded-lg border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-2">
            Dev Credentials — password:{" "}
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              devPassword123!
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {[
              { e: "arya.pradana@elux.space", role: "Admin" },
              { e: "lintang@elux.space", role: "Manager" },
              { e: "dewi@elux.space", role: "Manager" },
              { e: "ahrasya@elux.space", role: "Manager" },
              { e: "vira@elux.space", role: "Member" },
              { e: "aurelia@elux.space", role: "Member" },
            ].map(({ e, role }) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmail(e);
                  setPassword("devPassword123!");
                  setError("");
                }}
                className="text-left hover:text-indigo-600 transition-colors"
              >
                <span className="font-mono bg-slate-100 px-1 rounded">
                  {e.split("@")[0]}
                </span>
                <span className="ml-1 text-slate-400">({role})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
