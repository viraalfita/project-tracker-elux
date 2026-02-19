"use client";

import { TaskFormDialog } from "@/components/epic/TaskFormDialog";
import { AvatarChip, UnassignedChip } from "@/components/shared/AvatarChip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { getTaskProgress } from "@/lib/mock";
import { canCreate, canDelete, canEdit } from "@/lib/permissions";
import { Task } from "@/lib/types";
import { CalendarDays, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface EpicTasksTabProps {
  tasks: Task[];
  epicId: string;
  epicMemberIds: string[];
}

export function EpicTasksTab({
  tasks,
  epicId,
  epicMemberIds,
}: EpicTasksTabProps) {
  const { deleteTask } = useDataStore();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [showNew, setShowNew] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const allowCreate = canCreate(currentUser, epicMemberIds);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteTask(deleteTarget.id);
    toast(`Task "${deleteTarget.title}" deleted.`, "info");
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} in this epic
        </p>
        {allowCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const progress = getTaskProgress(task);
            const doneSubtasks = task.subtasks.filter((s) => s.done).length;
            const allowEditTask = canEdit(currentUser, epicMemberIds);
            const allowDeleteTask = canDelete(currentUser, epicMemberIds);

            return (
              <div key={task.id} className="relative group/taskrow">
                <Link href={`/task/${task.id}`}>
                  <div className="group flex items-center gap-4 rounded-lg border border-border bg-white px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground group-hover:text-indigo-700 transition-colors truncate">
                          {task.title}
                        </span>
                        {!task.assignee && (
                          <span className="text-xs text-red-500 font-medium">
                            Unassigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        {task.subtasks.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {doneSubtasks}/{task.subtasks.length} subtasks ·{" "}
                            {progress}%
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {task.assignee ? (
                        <AvatarChip user={task.assignee} size="sm" />
                      ) : (
                        <UnassignedChip size="sm" />
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                </Link>

                {/* Inline action buttons — outside Link so they don't navigate */}
                {(allowEditTask || allowDeleteTask) && (
                  <div className="absolute top-2.5 right-10 hidden group-hover/taskrow:flex items-center gap-1 z-10">
                    {allowEditTask && (
                      <button
                        onClick={() => setEditTask(task)}
                        className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    )}
                    {allowDeleteTask && (
                      <button
                        onClick={() => setDeleteTarget(task)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <TaskFormDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        epicId={epicId}
        epicMemberIds={epicMemberIds}
      />

      {/* Edit dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onClose={() => setEditTask(null)}
          epicId={epicId}
          epicMemberIds={epicMemberIds}
          task={editTask}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Delete task?"
        description={`"${deleteTarget?.title}" and all its subtasks will be permanently deleted.`}
      />
    </div>
  );
}
