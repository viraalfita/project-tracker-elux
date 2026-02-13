"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { Clock, X } from "lucide-react";
import { FormEvent, useState } from "react";

interface LogTimeDialogProps {
  taskId: string;
  onClose: () => void;
}

export function LogTimeDialog({ taskId, onClose }: LogTimeDialogProps) {
  const { addTimeEntry, tasks } = useDataStore();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const task = tasks.find((t) => t.id === taskId);
  const subtasks = task?.subtasks || [];

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string>("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!currentUser) {
      toast("You must be logged in to log time", "error");
      return;
    }

    const totalMinutes = parseInt(hours || "0") * 60 + parseInt(minutes || "0");

    if (totalMinutes <= 0) {
      toast("Duration must be greater than 0", "error");
      return;
    }

    addTimeEntry(
      taskId,
      {
        date,
        minutes: totalMinutes,
        note: note.trim() || undefined,
        subtaskId: selectedSubtaskId || undefined,
      },
      currentUser,
    );

    const subtaskLabel = selectedSubtaskId
      ? ` (${subtasks.find((s) => s.id === selectedSubtaskId)?.title || "Subtask"})`
      : "";
    toast(
      `Logged ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m${subtaskLabel}`,
      "success",
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-foreground">Log Time</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Date */}
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Subtask Selection */}
          {subtasks.length > 0 && (
            <div>
              <label
                htmlFor="subtask"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Subtask <span className="text-muted-foreground">(optional)</span>
              </label>
              <select
                id="subtask"
                value={selectedSubtaskId}
                onChange={(e) => setSelectedSubtaskId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None - Log to main task</option>
                {subtasks.map((subtask) => (
                  <option key={subtask.id} value={subtask.id}>
                    {subtask.done ? "✓ " : ""}
                    {subtask.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Link time entry to a specific subtask
              </p>
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Hours
                </span>
              </div>
              <div>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  min="0"
                  max="59"
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Minutes
                </span>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Note <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-border bg-white text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
            >
              Log Time
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
