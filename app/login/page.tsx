"use client";

import { useAuth } from "@/contexts/AuthContext";
import { USERS } from "@/lib/mock";
import { AlertCircle, FolderKanban, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";

// Hardcoded fake credentials (in-memory only)
const FAKE_CREDENTIALS: Record<string, { password: string; userId: string }> = {
  arya: { password: "admin123", userId: "u1" },
  lintang: { password: "manager123", userId: "u2" },
  dewi: { password: "manager123", userId: "u3" },
  ahrasya: { password: "manager123", userId: "u4" },
  vira: { password: "member123", userId: "u5" },
  aurel: { password: "member123", userId: "u6" },
};

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Validate credentials
    const credentials = FAKE_CREDENTIALS[username.toLowerCase()];

    if (!credentials || credentials.password !== password) {
      setError("Invalid username or password");
      return;
    }

    // Find user by ID
    const user = USERS.find((u) => u.id === credentials.userId);

    if (!user) {
      setError("User account not found");
      return;
    }

    // Simulate loading
    setIsLoading(true);

    // Login after brief delay for UX
    setTimeout(() => {
      login(user);
      setIsLoading(false);
    }, 300);
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

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Enter your username"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                autoFocus
                required
              />
            </div>

            {/* Password Input */}
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
                className="w-full px-4 py-3 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-white/50 rounded-lg border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-2">
            Demo Credentials:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                arya
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                admin123
              </span>
            </div>
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                lintang
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                manager123
              </span>
            </div>
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                dewi
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                manager123
              </span>
            </div>
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                ahrasya
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                manager123
              </span>
            </div>
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                vira
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                member123
              </span>
            </div>
            <div>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                aurel
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                member123
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No real authentication — demo purposes only
        </p>
      </div>
    </div>
  );
}
