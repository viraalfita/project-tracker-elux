import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Task, User } from "./types";

/**
 * Calculate progress percentage for a task based on subtask completion.
 * If no subtasks exist, uses status to determine progress.
 */
export function getTaskProgress(task: Task): number {
  if (task.subtasks.length === 0) {
    if (task.status === "Done") return 100;
    if (task.status === "In Progress" || task.status === "Review") return 50;
    return 0;
  }
  const done = task.subtasks.filter((s) => s.done).length;
  return Math.round((done / task.subtasks.length) * 100);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM WORKLOAD (IDLE RESOURCE) UTILITIES
// Workload is measured by count of "In Progress" tasks per user
// ═══════════════════════════════════════════════════════════════════════════

export type DateRangeFilter = "this-week" | "next-week" | "all" | "none";

/**
 * Get date range bounds for weekly filters
 */
export function getWeekRange(type: "this-week" | "next-week") {
  const today = new Date("2026-02-11");
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  if (type === "this-week") {
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  } else {
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + mondayOffset + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    return { start: nextMonday, end: nextSunday };
  }
}

/**
 * Format date range for display
 */
export function formatDateRange(range: { start: Date; end: Date }) {
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `${fmt(range.start)} - ${fmt(range.end)}`;
}

/**
 * Filter tasks by date range
 * @param tasks - All tasks to filter
 * @param dateRange - Date range filter type
 * @returns Filtered tasks
 */
export function filterTasksByDateRange(
  tasks: Task[],
  dateRange: DateRangeFilter,
): Task[] {
  if (dateRange === "all" || dateRange === "none") {
    return tasks;
  }

  const range = getWeekRange(dateRange);
  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    const taskDate = new Date(t.dueDate);
    return taskDate >= range.start && taskDate <= range.end;
  });
}

export type WorkloadStatus = "Available" | "Balanced" | "Overloaded";

/**
 * Determine workload status from count of active (In Progress) tasks.
 * Available: < 3   Balanced: 3–5   Overloaded: > 5
 */
export function getWorkloadStatus(activeTasks: number): WorkloadStatus {
  if (activeTasks < 3) return "Available";
  if (activeTasks <= 5) return "Balanced";
  return "Overloaded";
}

/**
 * Calculate idle resource workload for a single user.
 * Only "In Progress" tasks count as active workload.
 * @param user - User to evaluate
 * @param tasks - Task pool to search (should already be scoped as needed)
 * @returns activeTasks count and workload status
 */
export function calculateUserWorkload(user: User, tasks: Task[]) {
  const activeTasks = tasks.filter(
    (t) => t.assignee?.id === user.id && t.status === "In Progress",
  ).length;
  const status = getWorkloadStatus(activeTasks);
  return { user, activeTasks, status };
}

/**
 * Calculate workload for all users.
 * @param users - Users to evaluate
 * @param tasks - All tasks in the system
 * @returns Array of workload data per user
 */
export function calculateTeamWorkload(users: User[], tasks: Task[]) {
  return users.map((user) => calculateUserWorkload(user, tasks));
}

// ═══════════════════════════════════════════════════════════════════════════
// KPI CSV EXPORT UTILITIES
// Generates task-level CSV export for monitoring and reporting
// ═══════════════════════════════════════════════════════════════════════════

export interface KpiCsvRow {
  taskId: string;
  taskTitle: string;
  epicName: string;
  assigneeName: string;
  status: string;
  priority: string;
  dueDate: string;
  overdue: string;
  atRisk: string;
}

/**
 * Build KPI CSV rows from tasks
 * @param tasks - Tasks to export
 * @param epics - All epics (for epic name lookup)
 * @returns Array of CSV row data
 */
export function buildKpiCsvRows(
  tasks: Task[],
  epics: { id: string; title: string }[],
): KpiCsvRow[] {
  const NOW = new Date("2026-02-10");

  return tasks.map((task) => {
    const epic = epics.find((e) => e.id === task.epicId);
    const epicName = epic?.title || "Unknown Epic";
    const assigneeName = task.assignee?.name || "Unassigned";

    // Calculate overdue
    const overdue = (() => {
      if (!task.dueDate) return "";
      const dueDate = new Date(task.dueDate);
      if (task.status === "Done") {
        return "No";
      }
      return NOW > dueDate ? "Yes" : "No";
    })();

    // At Risk: status-based only (High priority tasks in progress)
    const atRisk =
      task.status === "In Progress" && task.priority === "High" ? "Yes" : "No";

    return {
      taskId: task.id,
      taskTitle: task.title,
      epicName,
      assigneeName,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      overdue,
      atRisk,
    };
  });
}

/**
 * Convert CSV rows to CSV string
 */
function rowsToCSV(rows: KpiCsvRow[]): string {
  const headers = [
    "taskId",
    "taskTitle",
    "epicName",
    "assigneeName",
    "status",
    "priority",
    "dueDate",
    "overdue",
    "atRisk",
  ];

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof KpiCsvRow];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(",") ? `"${escaped}"` : escaped;
        })
        .join(","),
    ),
  ];

  return csvRows.join("\n");
}

/**
 * Generate and download CSV file
 * @param tasks - Tasks to export
 * @param epics - All epics for name lookup
 * @param filename - Optional filename (defaults to kpi-export-YYYY-MM-DD.csv)
 */
export function downloadKpiCsv(
  tasks: Task[],
  epics: { id: string; title: string }[],
  filename?: string,
): void {
  if (tasks.length === 0) {
    alert("No data to export");
    return;
  }

  const rows = buildKpiCsvRows(tasks, epics);
  const csv = rowsToCSV(rows);

  // Generate filename
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const finalFilename = filename || `kpi-export-${dateStr}.csv`;

  // Create blob and trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", finalFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
