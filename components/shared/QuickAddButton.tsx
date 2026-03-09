"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { canCreate } from "@/lib/permissions";
import { AlertCircle, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface QuickAddButtonProps {
  contextEpicId?: string;
}

export function QuickAddButton({ contextEpicId }: QuickAddButtonProps) {
  const { currentUser } = useAuth();
  const { createTask, epics } = useDataStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedEpicId, setSelectedEpicId] = useState(contextEpicId || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update epic selection when context changes
  useEffect(() => {
    if (contextEpicId) {
      setSelectedEpicId(contextEpicId);
    }
  }, [contextEpicId]);

  // Keyboard shortcut: N key to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only trigger if user is not typing in an input/textarea
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        setIsOpen(true);
      }
      // ESC to close
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Check if user can create tasks in the currently selected epic
  const selectedEpic = epics.find((e) => e.id === selectedEpicId);
  const canCreateTask = canCreate(currentUser, selectedEpic);

  // Filter to epics the user can access (owner, watcher, or Admin)
  const availableEpics = epics.filter((e) => canCreate(currentUser, e));

  function handleClose() {
    setIsOpen(false);
    setTitle("");
    setErrors({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Task title is required";
    if (!selectedEpicId) newErrors.epic = "Please select an epic";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!canCreateTask) {
      toast("You don't have permission to create tasks in this epic", "error");
      return;
    }

    // Create task with minimal required fields
    createTask({
      epicId: selectedEpicId,
      title: title.trim(),
      description: "",
      assigneeId: currentUser?.id,
      status: "To Do",
      priority: "Medium",
    });

    toast(`Task created: ${title.trim()}`);
    handleClose();
  }

  if (!currentUser) return null;

  return (
    <>
      {/* Floating Quick Add Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all hover:scale-110 z-40"
        aria-label="Quick add task (N)"
        title="Quick add task (N)"
      >
        <Plus className="h-6 w-6 mx-auto" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

          {/* Modal content */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Quick Add Task
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">
                    N
                  </kbd>{" "}
                  to open ·{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">
                    ESC
                  </kbd>{" "}
                  to close
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: "" })); }}
                  placeholder="What needs to be done?"
                  autoFocus
                  className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.title ? "border-red-400" : "border-border"}`}
                />
                {errors.title && (
                  <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Epic selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Epic <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedEpicId}
                  onChange={(e) => { setSelectedEpicId(e.target.value); if (errors.epic) setErrors((p) => ({ ...p, epic: "" })); }}
                  className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.epic ? "border-red-400" : "border-border"}`}
                >
                  <option value="">Select epic...</option>
                  {availableEpics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.title}
                    </option>
                  ))}
                </select>
                {errors.epic && (
                  <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {errors.epic}
                  </p>
                )}
                {contextEpicId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pre-filled from current page
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !selectedEpicId}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
