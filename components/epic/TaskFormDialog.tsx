"use client";

import { UserSelect } from "@/components/shared/UserSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { canAssignTask, getAssignableUsers } from "@/lib/permissions";
import { Epic, Priority, Task, TaskStatus, User } from "@/lib/types";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High"];

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  epicId: string;
  epic: Epic;
  /** When set, the dialog is in edit mode. */
  task?: Task;
}

export function TaskFormDialog({
  open,
  onClose,
  epicId,
  epic,
  task,
}: TaskFormDialogProps) {
  const { createTask, updateTask, users } = useDataStore();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "To Do");
  const [priority, setPriority] = useState<Priority>(
    task?.priority ?? "Medium",
  );
  const [assignee, setAssignee] = useState<User | null>(task?.assignee ?? null);

  // Get assignable users based on permissions
  const canAssign = canAssignTask(currentUser, epic);
  const assignableUserIds = getAssignableUsers(currentUser, epic, users);
  const assignableUsers = users.filter((u) => assignableUserIds.includes(u.id));

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "To Do");
      setPriority(task?.priority ?? "Medium");
      setAssignee(task?.assignee ?? null);
    }
  }, [open, task]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEdit && task) {
      updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assignee?.id,
      });
      toast(`Task "${title.trim()}" updated.`);
    } else {
      createTask({
        title: title.trim(),
        description: description.trim(),
        epicId,
        status,
        priority,
        assigneeId: assignee?.id,
      });
      toast(`Task "${title.trim()}" created.`);
    }
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold text-foreground">
              {isEdit ? "Edit Task" : "New Task"}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement OAuth callback handler"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs to be done…"
                rows={3}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Assignee
              </label>
              {canAssign ? (
                <UserSelect
                  users={assignableUsers}
                  value={assignee}
                  onChange={setAssignee}
                  placeholder="Select assignee..."
                  allowUnassigned={true}
                />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md bg-slate-50">
                  {assignee ? (
                    <>
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: assignee.avatarColor }}
                      >
                        {assignee.initials}
                      </div>
                      <span>{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isEdit ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
