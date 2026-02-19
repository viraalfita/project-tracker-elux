"use client";

import { AvatarChip } from "@/components/shared/AvatarChip";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserSelect } from "@/components/shared/UserSelect";
import { WatchersSection } from "@/components/shared/WatchersSection";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { getEpicProgress, getTasksByEpic, USERS } from "@/lib/mock";
import { isAdmin } from "@/lib/permissions";
import { Epic, User } from "@/lib/types";
import { CalendarDays, ListChecks } from "lucide-react";
import { useState } from "react";

interface EpicHeaderProps {
  epic: Epic;
}

export function EpicHeader({ epic }: EpicHeaderProps) {
  const { currentUser } = useAuth();
  const { updateEpic, updateEpicWatchers } = useDataStore();
  const [owner, setOwner] = useState<User>(epic.owner);

  const progress = getEpicProgress(epic.id);
  const tasks = getTasksByEpic(epic.id);
  const doneTasks = tasks.filter((t) => t.status === "Done").length;

  // Only Admins can change epic owner
  const canChangeOwner = isAdmin(currentUser);

  function handleOwnerChange(newOwner: User | null) {
    if (!newOwner) return; // Owner is required
    setOwner(newOwner);
    updateEpic(epic.id, { ownerId: newOwner.id });
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {epic.title}
          </h1>
          <p className="text-sm text-muted-foreground">{epic.description}</p>
        </div>
        <StatusBadge status={epic.status} className="mt-1" />
      </div>

      <ProgressBar value={progress} className="mb-4" />

      <div className="flex items-start justify-between gap-6 text-sm text-muted-foreground">
        {/* Left side: Owner and Watchers */}
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <span className="text-xs uppercase tracking-wide font-medium">
              Owner
            </span>
            {canChangeOwner ? (
              <UserSelect
                users={USERS}
                value={owner}
                onChange={handleOwnerChange}
                placeholder="Select owner..."
                allowUnassigned={false}
              />
            ) : (
              <AvatarChip user={owner} size="sm" showName />
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-[220px]">
            <WatchersSection
              watchers={epic.watchers}
              epicMemberIds={epic.memberIds}
              onUpdate={updateEpicWatchers.bind(null, epic.id)}
            />
          </div>
        </div>

        {/* Right side: Task count and Dates */}
        <div className="flex flex-col gap-2 items-end text-right">
          <div className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span>
              <strong className="text-foreground">{doneTasks}</strong> /{" "}
              {tasks.length} tasks done
            </span>
          </div>
          {epic.startDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <span>
                {epic.startDate} → {epic.endDate ?? "—"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
