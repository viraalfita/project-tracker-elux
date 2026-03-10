"use client";

import { AvatarChip } from "@/components/shared/AvatarChip";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { canManageWatchers } from "@/lib/permissions";
import { Epic, User } from "@/lib/types";
import { Plus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface WatchersSectionProps {
  watchers: User[];
  epic: Epic;
  onUpdate: (watcherIds: string[]) => void;
}

export function WatchersSection({
  watchers,
  epic,
  onUpdate,
}: WatchersSectionProps) {
  const { currentUser } = useAuth();
  const { users } = useDataStore();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const canEdit = canManageWatchers(currentUser, epic);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  function handleRemove(userId: string) {
    onUpdate(watchers.filter((w) => w.id !== userId).map((w) => w.id));
  }

  function handleAdd(userId: string) {
    if (!watchers.some((w) => w.id === userId)) {
      onUpdate([...watchers.map((w) => w.id), userId]);
    }
    setShowPicker(false);
  }

  const addableUsers = users.filter(
    (u) => !watchers.some((w) => w.id === u.id),
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Members</span>
          <span className="text-sm text-muted-foreground">
            ({watchers.length})
          </span>
        </div>
        {canEdit && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-sm font-semibold text-foreground hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
            {showPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-white shadow-lg py-1">
                {addableUsers.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    All users are already members
                  </p>
                ) : (
                  addableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAdd(user.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      <AvatarChip user={user} size="sm" showName />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Member list */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {watchers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No members</p>
        ) : (
          <div className="divide-y divide-border">
            {watchers.map((watcher) => (
              <div
                key={watcher.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <AvatarChip user={watcher} size="sm" showName />
                {canEdit && (
                  <button
                    onClick={() => handleRemove(watcher.id)}
                    className="text-red-400 hover:text-red-600 transition-colors ml-2"
                    aria-label={`Remove ${watcher.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
