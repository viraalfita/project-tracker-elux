"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AvatarChip, UnassignedChip } from "@/components/shared/AvatarChip";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserSelect } from "@/components/shared/UserSelect";
import { CommentsSection } from "@/components/task/CommentsSection";
import { SubtaskList } from "@/components/task/SubtaskList";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import {
  canAssignTask,
  canUpdateStatus,
  canViewEpic,
  getAssignableUsers,
} from "@/lib/permissions";
import { TaskStatus, User } from "@/lib/types";
import { getTaskHealth } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { notFound } from "next/navigation";
import { use, useState } from "react";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default function TaskPage({ params }: TaskPageProps) {
  const { taskId } = use(params);
  const { tasks, epics, users, updateTask } = useDataStore();
  const { currentUser } = useAuth();

  const task = tasks.find((t) => t.id === taskId);
  if (!task) notFound();

  const epic = epics.find((e) => e.id === task.epicId);

  // Authorization check: Admin has full access; others must be owner or watcher
  if (epic && !canViewEpic(currentUser, epic)) {
    notFound(); // Return 404 for unauthorized access (security best practice)
  }

  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignee, setAssignee] = useState<User | null>(task.assignee);

  const canEditStatus = canUpdateStatus(currentUser, epic);
  const canAssign = canAssignTask(currentUser, epic);
  const assignableUserIds = getAssignableUsers(currentUser, epic, users);
  const assignableUsers = users.filter((u) => assignableUserIds.includes(u.id));

  function handleStatusChange(newStatus: TaskStatus) {
    setStatus(newStatus);
    if (task) updateTask(task.id, { status: newStatus });
  }

  function handleAssigneeChange(newAssignee: User | null) {
    setAssignee(newAssignee);
    if (task) updateTask(task.id, { assigneeId: newAssignee?.id });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Epics", href: "/epics" },
            ...(epic ? [{ label: epic.title, href: `/epic/${epic.id}` }] : []),
            { label: task.title },
          ]}
        />
      </div>

      <div className="flex-1 px-6 py-6">
        <div className="max-w-2xl space-y-6">
          {/* Task header */}
          <div className="rounded-lg border border-border bg-white p-6">
            {/* Title + status */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {task.title}
                  </h1>
                  {(() => {
                    const h = getTaskHealth(task);
                    if (h === "On Track")
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 shrink-0">
                          <TrendingUp className="h-3 w-3" />
                          On Track
                        </span>
                      );
                    if (h === "At Risk")
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200 shrink-0">
                          <AlertTriangle className="h-3 w-3" />
                          At Risk
                        </span>
                      );
                    if (h === "Delayed")
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 shrink-0">
                          <AlertTriangle className="h-3 w-3" />
                          Delayed
                        </span>
                      );
                    if (h === "Completed")
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </span>
                      );
                  })()}
                </div>
              </div>
              {/* Status selector — disabled for read-only roles */}
              <div className="shrink-0">
                {canEditStatus ? (
                  <select
                    value={status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as TaskStatus)
                    }
                    className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={status} />
                )}
              </div>
            </div>

            {/* Current status badge */}
            <div className="mb-4">
              <StatusBadge status={status} />
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {/* Assignee */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Assignee
                </span>
                {canAssign ? (
                  <UserSelect
                    users={assignableUsers}
                    value={assignee}
                    onChange={handleAssigneeChange}
                    placeholder="Select assignee..."
                    allowUnassigned={true}
                  />
                ) : assignee ? (
                  <AvatarChip user={assignee} showName />
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-red-500">
                    <UnassignedChip />
                    Unassigned
                  </span>
                )}
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Priority
                </span>
                <PriorityBadge priority={task.priority} />
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Due Date
                </span>
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {task.dueDate || "—"}
                </span>
              </div>

              {/* Start date */}
              {task.startDate && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Start Date
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-foreground">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {task.startDate}
                  </span>
                </div>
              )}

              {/* Epic */}
              {epic && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Epic
                  </span>
                  <span className="text-sm text-indigo-600 bg-indigo-50 rounded px-2 py-0.5">
                    {epic.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg border border-border bg-white p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Description
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          {/* Subtasks */}
          <div className="rounded-lg border border-border bg-white p-6">
            <SubtaskList
              taskId={task.id}
              subtasks={task.subtasks}
              epic={epic}
            />
          </div>

          {/* Comments */}
          <div className="rounded-lg border border-border bg-white p-6">
            <CommentsSection
              taskId={task.id}
              comments={task.comments}
              epic={epic}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
