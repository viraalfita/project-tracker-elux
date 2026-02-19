"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EPICS, USERS } from "@/lib/mock";
import { Task } from "@/lib/types";
import { Download, X } from "lucide-react";
import { useState } from "react";

interface CSVExportButtonProps {
  tasks: Task[];
  filename?: string;
}

export function CSVExportButton({
  tasks,
  filename = "export",
}: CSVExportButtonProps) {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEpics, setSelectedEpics] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<
    "all" | "week" | "month" | "lastMonth"
  >("all");

  // Only Admin and Manager can export
  const canExport =
    currentUser &&
    (currentUser.role === "Admin" || currentUser.role === "Manager");

  function exportToCSV() {
    // Filter tasks based on selected criteria
    let filteredTasks = [...tasks];

    if (selectedEpics.length > 0) {
      filteredTasks = filteredTasks.filter((t) =>
        selectedEpics.includes(t.epicId),
      );
    }

    if (selectedAssignees.length > 0) {
      filteredTasks = filteredTasks.filter((t) =>
        selectedAssignees.includes(t.assignee?.id || "unassigned"),
      );
    }

    // Date range filter (simplified - based on due date)
    const now = new Date();
    if (dateRange === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTasks = filteredTasks.filter(
        (t) => new Date(t.dueDate) >= weekAgo,
      );
    } else if (dateRange === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTasks = filteredTasks.filter(
        (t) => new Date(t.dueDate) >= monthAgo,
      );
    } else if (dateRange === "lastMonth") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      filteredTasks = filteredTasks.filter((t) => {
        const due = new Date(t.dueDate);
        return due >= twoMonthsAgo && due < monthAgo;
      });
    }

    // Build CSV content
    const headers = [
      "Task ID",
      "Title",
      "Epic",
      "Assignee",
      "Status",
      "Priority",
      "Due Date",
    ];

    const rows = filteredTasks.map((task) => {
      const epic = EPICS.find((e) => e.id === task.epicId);

      return [
        task.id,
        `"${task.title.replace(/"/g, '""')}"`, // Escape quotes
        epic?.title || "",
        task.assignee?.name || "Unassigned",
        task.status,
        task.priority,
        task.dueDate,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}-${date}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsOpen(false);
  }

  function toggleEpic(epicId: string) {
    setSelectedEpics((prev) =>
      prev.includes(epicId)
        ? prev.filter((id) => id !== epicId)
        : [...prev, epicId],
    );
  }

  function toggleAssignee(userId: string) {
    setSelectedAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  if (!canExport) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Export Tasks to CSV
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) =>
                    setDateRange(
                      e.target.value as "all" | "week" | "month" | "lastMonth",
                    )
                  }
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </select>
              </div>

              {/* Epic Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Filter by Epic (optional)
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded p-2">
                  {EPICS.map((epic) => (
                    <label
                      key={epic.id}
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-slate-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEpics.includes(epic.id)}
                        onChange={() => toggleEpic(epic.id)}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      {epic.title}
                    </label>
                  ))}
                </div>
              </div>

              {/* Assignee Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Filter by Assignee (optional)
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded p-2">
                  {USERS.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-slate-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssignees.includes(user.id)}
                        onChange={() => toggleAssignee(user.id)}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      {user.name}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes("unassigned")}
                      onChange={() => toggleAssignee("unassigned")}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    Unassigned
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export {tasks.length} tasks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
