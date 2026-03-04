"use client";

import { AvatarChip } from "@/components/shared/AvatarChip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { UserSelect } from "@/components/shared/UserSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import {
  canAssignTask,
  canCreate,
  canDelete,
  getAssignableUsers,
} from "@/lib/permissions";
import { Epic, Subtask, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, CheckSquare, Plus, Square, Trash2 } from "lucide-react";
import { useState } from "react";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  epic?: Epic;
}

export function SubtaskList({
  taskId,
  subtasks,
  epic,
}: SubtaskListProps) {
  const { createSubtask, deleteSubtask, toggleSubtask, users } = useDataStore();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subtask | null>(null);

  const allowCreate = canCreate(currentUser, epic);
  const allowDelete = canDelete(currentUser, epic);
  const allowToggle = allowCreate;
  const canAssign = canAssignTask(currentUser, epic);
  const assignableUserIds = getAssignableUsers(currentUser, epic, users);
  const assignableUsers = users.filter((u) => assignableUserIds.includes(u.id));

  const doneCount = subtasks.filter((s) => s.done).length;
  const progress =
    subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  function handleToggle(subtaskId: string) {
    if (!allowToggle) return;
    toggleSubtask(taskId, subtaskId);
  }

  function handleAddSubmit() {
    if (!newTitle.trim()) return;
    createSubtask(taskId, {
      title: newTitle.trim(),
      assigneeId: newAssignee?.id,
    });
    toast(`Subtask "${newTitle.trim()}" added.`);
    setNewTitle("");
    setNewAssignee(null);
    setAddingNew(false);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteSubtask(taskId, deleteTarget.id);
    toast(`Subtask deleted.`, "info");
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Subtasks</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {doneCount} / {subtasks.length} done · {progress}%
          </span>
          {allowCreate && !addingNew && (
            <button
              onClick={() => setAddingNew(true)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {subtasks.length === 0 && !addingNew ? (
        <p className="text-sm text-muted-foreground py-2">No subtasks yet.</p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="flex items-center gap-3 rounded-md px-3 py-2 group/subtask transition-colors hover:bg-accent"
            >
              <button
                type="button"
                onClick={() => handleToggle(subtask.id)}
                className={cn(
                  "shrink-0",
                  allowToggle ? "cursor-pointer" : "cursor-default",
                )}
              >
                {subtask.done ? (
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground group-hover/subtask:text-indigo-400 transition-colors" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  subtask.done
                    ? "line-through text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {subtask.title}
              </span>
              {subtask.assignee && (
                <AvatarChip user={subtask.assignee} size="sm" />
              )}
              {/* Delete button — appears on row hover */}
              {allowDelete && (
                <button
                  onClick={() => setDeleteTarget(subtask)}
                  className="hidden group-hover/subtask:inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Inline add row */}
      {addingNew && (
        <div className="space-y-2 mt-2 px-3 py-2 border border-border rounded-md bg-slate-50">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleAddSubmit();
              if (e.key === "Escape") {
                setAddingNew(false);
                setNewTitle("");
                setNewAssignee(null);
              }
            }}
            placeholder="Subtask title…"
            autoFocus
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {canAssign && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Assignee
              </label>
              <UserSelect
                users={assignableUsers}
                value={newAssignee}
                onChange={setNewAssignee}
                placeholder="Select assignee..."
                allowUnassigned={true}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddSubmit}
              disabled={!newTitle.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="h-4 w-4" />
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingNew(false);
                setNewTitle("");
                setNewAssignee(null);
              }}
              className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Delete subtask?"
        description={`"${deleteTarget?.title}" will be permanently removed.`}
      />
    </div>
  );
}
