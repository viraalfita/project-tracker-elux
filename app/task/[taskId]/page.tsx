"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AvatarChip, UnassignedChip } from "@/components/shared/AvatarChip";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserSelect } from "@/components/shared/UserSelect";
import { WatchersSection } from "@/components/shared/WatchersSection";
import { AttachmentsSection } from "@/components/task/AttachmentsSection";
import { CommentsSection } from "@/components/task/CommentsSection";
import { ExternalLinksSection } from "@/components/task/ExternalLinksSection";
import { LogTimeDialog } from "@/components/task/LogTimeDialog";
import { SubtaskList } from "@/components/task/SubtaskList";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { USERS } from "@/lib/mock";
import {
  canAssignTask,
  canUpdateStatus,
  canViewEpic,
  getAssignableUsers,
} from "@/lib/permissions";
import { TaskStatus, User } from "@/lib/types";
import { AlertTriangle, CalendarDays, Clock, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useEffect, useState } from "react";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default function TaskPage({ params }: TaskPageProps) {
  const { taskId } = use(params);
  const { tasks, epics, updateTask, updateTaskWatchers, deleteTimeEntry } = useDataStore();
  const { currentUser } = useAuth();

  const task = tasks.find((t) => t.id === taskId);
  if (!task) notFound();

  const epic = epics.find((e) => e.id === task.epicId);

  // Authorization check: ensure user can view this epic/task
  if (epic && !canViewEpic(currentUser, epic.id)) {
    notFound(); // Return 404 for unauthorized access (security best practice)
  }

  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignee, setAssignee] = useState<User | null>(task.assignee);
  const [showLogTime, setShowLogTime] = useState(false);

  const canEditStatus = canUpdateStatus(currentUser, epic?.id);
  const canAssign = canAssignTask(currentUser, epic?.id);
  const assignableUserIds = getAssignableUsers(currentUser, epic?.id ?? "");
  const assignableUsers = USERS.filter((u) => assignableUserIds.includes(u.id));

  // Time tracking calculations
  const totalMinutesLogged = task.timeEntries.reduce(
    (sum, entry) => sum + entry.minutes,
    0,
  );
  const totalHoursLogged = totalMinutesLogged / 60;
  const estimateHours = task.estimate || 0;
  const remainingHours = estimateHours - totalHoursLogged;

  // At Risk logic: time logged > estimate * 1.2
  const isOverBudget = totalHoursLogged > estimateHours * 1.2;

  // Permission to log time: Admin can always, Members can if they have access
  const canLogTime =
    currentUser &&
    (currentUser.role === "Admin" ||
      (currentUser.role === "Member" &&
        epic &&
        canViewEpic(currentUser, epic.id)));

  // Check for overdue and notify watchers (MVP: on page load)
  useEffect(() => {
    if (task.dueDate && task.status !== "Done" && task.watchers.length > 0) {
      const NOW = new Date("2026-02-10");
      const dueDate = new Date(task.dueDate);
      if (NOW > dueDate) {
        console.log(
          `[Overdue Alert] Task "${task.title}" is overdue (due: ${task.dueDate}). Notifying:`,
          task.watchers.map((w) => w.name),
        );
      }
    }
  }, [task]);

  function handleStatusChange(newStatus: TaskStatus) {
    setStatus(newStatus);
    if (task) updateTask(task.id, { status: newStatus });
  }

  function handleAssigneeChange(newAssignee: User | null) {
    setAssignee(newAssignee);
    if (task) updateTask(task.id, { assigneeId: newAssignee?.id });
  }

  function handleDeleteTimeEntry(entryId: string) {
    if (task && confirm("Delete this time entry?")) {
      deleteTimeEntry(task.id, entryId);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
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
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {task.title}
                  </h1>
                  {isOverBudget && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      <AlertTriangle className="h-3 w-3" />
                      At Risk
                    </span>
                  )}
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

              {/* Estimate */}
              {task.estimate && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Estimate
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {task.estimate}h
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
              
              {/* Watchers */}
              {epic && (
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <WatchersSection
                    watchers={task.watchers}
                    epicId={epic.id}
                    onUpdate={updateTaskWatchers.bind(null, task.id)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Time Tracking */}
          <div className="rounded-lg border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Time Tracking
              </h2>
              {canLogTime && (
                <button
                  onClick={() => setShowLogTime(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  Log Time
                </button>
              )}
            </div>

            {/* Time Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-muted-foreground mb-1">Estimate</p>
                <p className="text-lg font-semibold text-foreground">
                  {estimateHours.toFixed(1)}h
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <p className="text-xs text-muted-foreground mb-1">
                  Time Logged
                </p>
                <p className="text-lg font-semibold text-blue-700">
                  {totalHoursLogged.toFixed(1)}h
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${remainingHours < 0 ? "bg-red-50" : "bg-green-50"}`}
              >
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p
                  className={`text-lg font-semibold ${remainingHours < 0 ? "text-red-700" : "text-green-700"}`}
                >
                  {remainingHours.toFixed(1)}h
                </p>
              </div>
            </div>

            {/* Time Entries List */}
            {task.timeEntries.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
                  Time Entries
                </p>
                {task.timeEntries
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((entry) => {
                    const hours = Math.floor(entry.minutes / 60);
                    const mins = entry.minutes % 60;
                    const canDelete =
                      currentUser &&
                      (currentUser.role === "Admin" ||
                        entry.user.id === currentUser.id);
                    
                    // Find subtask if entry is linked to one
                    const subtask = entry.subtaskId
                      ? task.subtasks.find((s) => s.id === entry.subtaskId)
                      : null;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between p-3 rounded-lg border border-border bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white flex-shrink-0"
                              style={{
                                backgroundColor: entry.user.avatarColor,
                              }}
                            >
                              {entry.user.initials}
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {entry.user.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.date}
                            </span>
                          </div>
                          {subtask && (
                            <div className="ml-8 mb-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                <span className="font-semibold">Subtask:</span>
                                {subtask.title}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 ml-8">
                            <span className="text-sm font-semibold text-indigo-600">
                              {hours > 0 && `${hours}h `}
                              {mins > 0 && `${mins}m`}
                            </span>
                            {entry.note && (
                              <span className="text-sm text-muted-foreground">
                                {entry.note}
                              </span>
                            )}
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteTimeEntry(entry.id)}
                            className="text-muted-foreground hover:text-red-600 transition-colors p-1"
                            title="Delete time entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No time logged yet
              </p>
            )}
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
              epicId={epic?.id}
            />
          </div>

          {/* Comments */}
          <div className="rounded-lg border border-border bg-white p-6">
            <CommentsSection
              taskId={task.id}
              comments={task.comments}
              epicId={epic?.id}
            />
          </div>

          {/* Attachments */}
          <div className="rounded-lg border border-border bg-white p-6">
            <AttachmentsSection
              taskId={task.id}
              attachments={task.attachments}
              canEdit={canEditStatus}
            />
          </div>

          {/* External Links */}
          <div className="rounded-lg border border-border bg-white p-6">
            <ExternalLinksSection
              taskId={task.id}
              links={task.externalLinks}
              canEdit={canEditStatus}
            />
          </div>
        </div>
      </div>

      {/* Log Time Dialog */}
      {showLogTime && (
        <LogTimeDialog taskId={task.id} onClose={() => setShowLogTime(false)} />
      )}
    </div>
  );
}
