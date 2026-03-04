"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { pb } from "@/lib/pocketbase";
import { Role, User } from "@/lib/types";
import { Shield, UserPlus, Users, X } from "lucide-react";
import { FormEvent, useState } from "react";

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Manager: "bg-blue-100 text-blue-700",
  Member: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-600",
};

const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

function deriveInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export default function WorkspacePage() {
  const { currentUser } = useAuth();
  const { users, refreshUsers } = useDataStore();
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAccessManagement, setShowAccessManagement] = useState(false);

  const isAdmin = currentUser?.role === "Admin";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Workspace" },
          ]}
        />
      </div>

      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-foreground">
              Workspace Members
            </h1>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </button>
              <button
                onClick={() => setShowAccessManagement(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-foreground text-sm font-medium hover:bg-accent transition-colors"
              >
                <Shield className="h-4 w-4" />
                Access Management
              </button>
            </div>
          )}
        </div>

        <div className="max-w-lg space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${ROLE_BADGE[user.role]}`}
              >
                {user.role}
              </span>
            </div>
          ))}
        </div>

        {!isAdmin && (
          <p className="mt-6 text-xs text-muted-foreground">
            Only Admins can invite users and manage access.
          </p>
        )}
      </div>

      {showAddUser && (
        <AddUserDialog
          onClose={() => setShowAddUser(false)}
          refreshUsers={refreshUsers}
        />
      )}

      {showAccessManagement && (
        <AccessManagementDialog
          users={users}
          currentUserId={currentUser?.id ?? ""}
          onClose={() => setShowAccessManagement(false)}
          refreshUsers={refreshUsers}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD USER DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AddUserDialog({
  onClose,
  refreshUsers,
}: {
  onClose: () => void;
  refreshUsers: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const initials = deriveInitials(name);
    const avatarColor =
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const password = "devPassword123!";

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          email,
          password,
          name,
          initials,
          avatarColor,
          role,
          weeklyCapacity: 40,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      await refreshUsers();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Add User to Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Member">Member — Can create and edit tasks</option>
              <option value="Manager">
                Manager — Can manage team and review
              </option>
              <option value="Admin">Admin — Full control</option>
              <option value="Viewer">Viewer — Read-only access</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Default password:{" "}
              <code className="bg-slate-100 px-1 rounded">devPassword123!</code>{" "}
              — user should change it on first login.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-md border border-border bg-white text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCESS MANAGEMENT DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AccessManagementDialog({
  users,
  currentUserId,
  onClose,
  refreshUsers,
}: {
  users: User[];
  currentUserId: string;
  onClose: () => void;
  refreshUsers: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: Role) {
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update role");
      await refreshUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      setError(msg);
    }
  }

  async function handleRevokeAccess(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (
      !confirm(
        `Revoke access for ${user.name}? They will lose all workspace access immediately.`,
      )
    ) {
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to revoke access");
      await refreshUsers();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to revoke access";
      setError(msg);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Access Management
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <select
                value={user.role}
                onChange={(e) =>
                  handleRoleChange(user.id, e.target.value as Role)
                }
                disabled={user.id === currentUserId}
                className="px-2.5 py-1.5 rounded-md border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button
                onClick={() => handleRevokeAccess(user.id)}
                disabled={user.id === currentUserId}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Revoke Access
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-3">
            <p className="text-xs text-amber-900">
              <strong>Warning:</strong> Role changes take effect immediately.
              Revoking access will remove the user from all projects and tasks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
