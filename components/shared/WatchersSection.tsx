"use client";

import { AvatarChip } from "@/components/shared/AvatarChip";
import { useAuth } from "@/contexts/AuthContext";
import { USERS } from "@/lib/mock";
import { canManageWatchers, isAdmin } from "@/lib/permissions";
import { User } from "@/lib/types";
import { Eye } from "lucide-react";
import { useState } from "react";

interface WatchersSectionProps {
  watchers: User[];
  epicMemberIds: string[];
  onUpdate: (watcherIds: string[]) => void;
}

export function WatchersSection({
  watchers,
  epicMemberIds,
  onUpdate,
}: WatchersSectionProps) {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    watchers.map((w) => w.id),
  );

  // Admin can watch/add any user; members can only add fellow epic members.
  const availableUsers = isAdmin(currentUser)
    ? USERS
    : USERS.filter((u) => epicMemberIds.includes(u.id));

  const canEdit = canManageWatchers(currentUser, epicMemberIds);

  function handleToggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  function handleSave() {
    onUpdate(selectedUserIds);
    setIsEditing(false);
  }

  function handleCancel() {
    setSelectedUserIds(watchers.map((w) => w.id));
    setIsEditing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
            Watchers
          </span>
        </div>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-3">
          <div className="text-xs text-muted-foreground mb-2">
            Select users to watch this item:
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {availableUsers.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => handleToggleUser(user.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <AvatarChip user={user} size="sm" showName />
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-1.5 rounded border border-border bg-white text-foreground text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {watchers.length > 0 ? (
            watchers.map((watcher) => (
              <AvatarChip key={watcher.id} user={watcher} size="sm" showName />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No watchers</span>
          )}
        </div>
      )}
    </div>
  );
}
