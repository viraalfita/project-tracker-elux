"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { pb } from "@/lib/pocketbase";
import { Invite, Role, User } from "@/lib/types";
import {
  Clock,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Manager: "bg-blue-100 text-blue-700",
  Member: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-600",
};

const INVITE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  expired: "bg-slate-100 text-slate-500",
};

export default function WorkspacePage() {
  const { currentUser } = useAuth();
  const { users, refreshUsers } = useDataStore();
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showAccessManagement, setShowAccessManagement] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const isAdmin = currentUser?.role === "Admin";

  const fetchInvites = useCallback(async () => {
    if (!isAdmin) return;
    setInvitesLoading(true);
    try {
      const res = await fetch("/api/admin/invites", {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: Invite[] = data.map((r: any) => ({
          id: r.id,
          email: r.email,
          role: r.role,
          invitedBy: r.expand?.invited_by ?? {
            id: r.invited_by,
            name: "Admin",
            email: "",
            initials: "A",
            avatarColor: "#6366f1",
            role: "Admin",
            weeklyCapacity: 40,
          },
          status: r.status,
          expiresAt: r.expires_at,
          created: r.created,
        }));
        setInvites(mapped);
      }
    } finally {
      setInvitesLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  async function handleCancelInvite(inviteId: string) {
    if (!confirm("Cancel this invite? The user will no longer be able to join.")) return;
    const res = await fetch(`/api/admin/invites/${inviteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
    });
    if (res.ok) {
      await fetchInvites();
      await refreshUsers();
    }
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "Workspace" }]} />
      </div>

      <div className="px-6 py-6 space-y-8 overflow-auto flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-foreground">Workspace Members</h1>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowInviteUser(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Invite User
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

        {/* Active members */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Members — {users.length}
          </h2>
          <div className="max-w-lg space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending invites (Admin only) */}
        {isAdmin && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Pending Invites — {pendingInvites.length}
            </h2>
            {invitesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            ) : (
              <div className="max-w-lg space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <UserPlus className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[invite.role]}`}>
                      {invite.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVITE_STATUS_STYLES[invite.status]}`}>
                      {invite.status}
                    </span>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Cancel invite"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isAdmin && (
          <p className="text-xs text-muted-foreground">
            Only Admins can invite users and manage access.
          </p>
        )}
      </div>

      {showInviteUser && (
        <InviteUserDialog
          onClose={() => setShowInviteUser(false)}
          onSuccess={async () => {
            await fetchInvites();
            await refreshUsers();
          }}
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
// INVITE USER DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function InviteUserDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
      setSuccess(true);
      await onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-foreground">Invite User</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-foreground">Invite sent!</p>
            <p className="text-xs text-muted-foreground">
              A sign-in code has been sent to <strong>{email}</strong>.
              They can use it to set up their account.
            </p>
            <button
              onClick={onClose}
              className="w-full mt-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="colleague@company.com"
                required
                autoFocus
                className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A sign-in code will be sent to this address.
              </p>
            </div>

            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Member">Member — Can create and edit tasks</option>
                <option value="Manager">Manager — Can manage team and review</option>
                <option value="Admin">Admin — Full control</option>
                <option value="Viewer">Viewer — Read-only access</option>
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 rounded-md border border-border bg-white text-foreground hover:bg-accent transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="flex-1 px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Sending..." : <><Mail className="h-4 w-4" />Send invite</>}
              </button>
            </div>
          </form>
        )}
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
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRevokeAccess(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (!confirm(`Revoke access for ${user.name}? They will lose all workspace access immediately.`)) return;

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
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-foreground">Access Management</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
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
            <div key={user.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
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
                Revoke
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
