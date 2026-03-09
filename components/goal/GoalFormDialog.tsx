"use client";

import { useDataStore } from "@/contexts/DataStore";
import { useAuth } from "@/contexts/AuthContext";
import { Goal } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface GoalFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the dialog edits this goal instead of creating a new one. */
  goal?: Goal;
}

export function GoalFormDialog({ open, onClose, goal }: GoalFormDialogProps) {
  const { createGoal, updateGoal } = useDataStore();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(goal?.title ?? "");
      setDescription(goal?.description ?? "");
      setErrors({});
    }
  }, [open, goal]);

  if (!open) return null;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Goal title is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !currentUser) return;
    setSubmitting(true);
    if (goal) {
      updateGoal(goal.id, { title: title.trim(), description: description.trim() });
    } else {
      createGoal({ title: title.trim(), description: description.trim(), ownerId: currentUser.id });
    }
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {goal ? "Edit Goal" : "New Goal"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Increase user retention by 20%"
              className={`w-full rounded border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                errors.title ? "border-red-400" : "border-border"
              }`}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this strategic goal..."
              rows={3}
              className="w-full rounded border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {goal ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
