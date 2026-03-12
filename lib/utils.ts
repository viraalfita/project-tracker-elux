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

/** Returns today's date as "YYYY-MM-DD" in the local timezone. */
export function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns true if a task is overdue: dueDate is before today and task is not Done. */
export function isTaskOverdue(
  dueDate: string | undefined,
  status: string,
): boolean {
  if (!dueDate) return false;
  return dueDate < getTodayStr() && status !== "Done";
}

/** Returns the difference in calendar days between two "YYYY-MM-DD" strings (a - b). */
function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export type HealthStatus = "On Track" | "At Risk" | "Delayed";

/**
 * IDEAL task health:
 * - Delayed  → due date already passed and not Done
 * - Compares actual progress vs expected progress based on elapsed time
 *   gap > 40% → Delayed, gap > 20% → At Risk, else → On Track
 * - Falls back to Simple (due date proximity) when startDate is unavailable
 */
export function getTaskHealth(task: Task): HealthStatus {
  const today = getTodayStr();
  const progress = getTaskProgress(task);

  // Already overdue
  if (task.dueDate && task.dueDate < today && task.status !== "Done")
    return "Delayed";

  // Done is always On Track
  if (task.status === "Done") return "On Track";

  if (task.startDate && task.dueDate) {
    // IDEAL: expected progress based on elapsed time
    const totalDays = diffDays(task.dueDate, task.startDate);
    if (totalDays > 0) {
      const elapsedDays = Math.max(diffDays(today, task.startDate), 0);
      const expectedProgress = Math.min((elapsedDays / totalDays) * 100, 100);
      const gap = expectedProgress - progress;
      if (gap > 40) return "Delayed";
      if (gap > 20) return "At Risk";
      return "On Track";
    }
  }

  // SIMPLE fallback: check proximity to due date
  if (task.dueDate) {
    const daysLeft = diffDays(task.dueDate, today);
    if (daysLeft <= 3 && progress < 50) return "At Risk";
  }

  return "On Track";
}

/**
 * IDEAL epic health:
 * - Delayed  → endDate passed and not Done, OR ≥20% of tasks are Delayed
 * - At Risk  → ≥30% of tasks are At Risk (and not already Delayed)
 * - On Track → everything else
 */
export function getEpicHealth(
  epic: { endDate?: string; status: string },
  tasks: Task[],
): HealthStatus {
  const today = getTodayStr();

  // Epic itself is overdue
  if (epic.endDate && epic.endDate < today && epic.status !== "Done")
    return "Delayed";

  if (tasks.length === 0) return "On Track";

  const delayed = tasks.filter((t) => getTaskHealth(t) === "Delayed").length;
  const atRisk = tasks.filter((t) => getTaskHealth(t) === "At Risk").length;
  const delayedPct = (delayed / tasks.length) * 100;
  const atRiskPct = (atRisk / tasks.length) * 100;

  if (delayedPct >= 20) return "Delayed";
  if (atRiskPct >= 30) return "At Risk";
  return "On Track";
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
  return tasks.map((task) => {
    const epic = epics.find((e) => e.id === task.epicId);
    const epicName = epic?.title || "Unknown Epic";
    const assigneeName = task.assignee?.name || "Unassigned";

    // Calculate overdue
    const overdue = !task.dueDate
      ? ""
      : task.status === "Done"
        ? "No"
        : isTaskOverdue(task.dueDate, task.status)
          ? "Yes"
          : "No";

    // At Risk: task is overdue (past due date and not Done)
    const atRisk = isTaskOverdue(task.dueDate, task.status) ? "Yes" : "No";

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
