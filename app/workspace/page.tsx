"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { USERS } from "@/lib/mock";
import { Role } from "@/lib/types";
import { Shield, UserPlus, Users, X } from "lucide-react";
import { FormEvent, useState } from "react";

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Manager: "bg-blue-100 text-blue-700",
  Member: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-600",
};

export default function WorkspacePage() {
  const { currentUser } = useAuth();
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

          {/* Admin Actions */}
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
          {USERS.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3"
            >
              {/* Avatar */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.name[0]}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>

              {/* Role Badge */}
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

      {/* Add User Dialog */}
      {showAddUser && <AddUserDialog onClose={() => setShowAddUser(false)} />}

      {/* Access Management Dialog */}
      {showAccessManagement && (
        <AccessManagementDialog
          onClose={() => setShowAccessManagement(false)}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD USER DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      alert(
        `User invitation sent!\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\n\nNote: This is a demo. In production, this would send an email invitation.`,
      );
      setIsSubmitting(false);
      onClose();
    }, 1000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
              <option value="Member">Member - Can create and edit tasks</option>
              <option value="Manager">
                Manager - Can manage team and review
              </option>
              <option value="Admin">Admin - Full control</option>
              <option value="Viewer">Viewer - Read-only access</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Role can be changed later in Access Management
            </p>
          </div>

          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-900">
              An invitation email will be sent to{" "}
              <strong>{email || "the user"}</strong> with instructions to join
              the workspace.
            </p>
          </div>

          {/* Actions */}
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
              {isSubmitting ? "Sending..." : "Send Invitation"}
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

function AccessManagementDialog({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState(USERS);

  function handleRoleChange(userId: string, newRole: Role) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    );
    alert(
      `Role updated for user ${userId} to ${newRole}\n\nNote: This is a demo. In production, this would update the database.`,
    );
  }

  function handleRevokeAccess(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const confirmed = confirm(
      `Are you sure you want to revoke access for ${user.name}?\n\nThey will be immediately removed from the workspace and lose all access.`,
    );

    if (confirmed) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      alert(
        `Access revoked for ${user.name}\n\nNote: This is a demo. In production, this would update the database.`,
      );
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
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

        {/* User List */}
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
                disabled={user.id === "u1"} // Prevent changing own role
                className="px-2.5 py-1.5 rounded-md border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button
                onClick={() => handleRevokeAccess(user.id)}
                disabled={user.id === "u1"} // Prevent removing self
                className="px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Revoke Access
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
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
