import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Task, User } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIZATION CALCULATION UTILITIES
// Single source of truth for resource utilization calculations
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

/**
 * Calculate utilization for a single user
 * SINGLE SOURCE OF TRUTH for utilization calculation
 * @param user - User to calculate utilization for
 * @param tasks - Filtered tasks (should already be filtered by epic, date range, and status)
 * @returns Utilization data for the user
 */
export function calculateUserUtilization(user: User, tasks: Task[]) {
  const userTasks = tasks.filter((t) => t.assignee?.id === user.id);
  const totalEstimate = userTasks.reduce(
    (sum, t) => sum + (t.estimate ?? 0),
    0,
  );
  const capacity = user.weeklyCapacity;
  const pct = capacity > 0 ? Math.round((totalEstimate / capacity) * 100) : 0;

  return {
    user,
    totalEstimate,
    pct,
    capacity,
    openTasks: userTasks.length,
  };
}

/**
 * Calculate utilization for all users with consistent filtering
 * @param users - Array of users
 * @param allTasks - All tasks in the system
 * @param filters - Optional filters to apply
 * @returns Array of utilization data per user
 */
export function calculateUtilization(
  users: User[],
  allTasks: Task[],
  filters?: {
    epicId?: string;
    dateRange?: DateRangeFilter;
    excludeCompleted?: boolean;
  },
) {
  let filteredTasks = allTasks;

  // Apply status filter
  if (filters?.excludeCompleted !== false) {
    filteredTasks = filteredTasks.filter((t) => t.status !== "Done");
  }

  // Apply epic filter
  if (filters?.epicId) {
    filteredTasks = filteredTasks.filter((t) => t.epicId === filters.epicId);
  }

  // Apply date range filter
  if (filters?.dateRange && filters.dateRange !== "none") {
    filteredTasks = filterTasksByDateRange(filteredTasks, filters.dateRange);
  }

  // Calculate utilization for each user using the SAME filtered tasks
  return users.map((user) => calculateUserUtilization(user, filteredTasks));
}

/**
 * Calculate aggregate utilization metrics
 */
export function calculateUtilizationAggregates(
  utilization: ReturnType<typeof calculateUserUtilization>[],
) {
  const overCapacity = utilization.filter((u) => u.pct > 100).length;
  const avgUtilization =
    utilization.length > 0
      ? Math.round(
          utilization.reduce((sum, u) => sum + u.pct, 0) / utilization.length,
        )
      : 0;

  return {
    overCapacity,
    avgUtilization,
    totalUsers: utilization.length,
  };
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
  estimateHours: string;
  totalLoggedHours: string;
  createdDate: string;
  inProgressDate: string;
  completedDate: string;
  dueDate: string;
  cycleTimeDays: string;
  overdue: string;
  atRisk: string;
  estimateAccuracyRatio: string;
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

    // Calculate totalLoggedHours
    const totalMinutes = task.timeEntries.reduce(
      (sum, entry) => sum + entry.minutes,
      0,
    );
    const totalLoggedHours = totalMinutes / 60;

    // Extract status dates (simulated - in real app these would be tracked)
    // For MVP, we'll use approximations based on current status
    const createdDate = ""; // Not tracked in MVP

    // Simulate inProgressDate
    const inProgressDate =
      task.status === "In Progress" ||
      task.status === "Review" ||
      task.status === "Done"
        ? (() => {
            const dueDate = new Date(task.dueDate);
            const startDate = new Date(dueDate);
            startDate.setDate(dueDate.getDate() - 3);
            return startDate.toISOString().split("T")[0];
          })()
        : "";

    // Simulate completedDate
    const completedDate = task.status === "Done" ? task.dueDate : "";

    // Calculate cycleTimeDays
    const cycleTimeDays =
      inProgressDate && completedDate
        ? (() => {
            const start = new Date(inProgressDate);
            const end = new Date(completedDate);
            const days = Math.round(
              (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            return days.toString();
          })()
        : "";

    // Calculate overdue
    const overdue = (() => {
      if (!task.dueDate) return "";
      const dueDate = new Date(task.dueDate);
      if (task.status === "Done" && completedDate) {
        const completed = new Date(completedDate);
        return completed > dueDate ? "Yes" : "No";
      } else if (task.status !== "Done") {
        return NOW > dueDate ? "Yes" : "No";
      }
      return "";
    })();

    // Calculate atRisk
    const atRisk = (() => {
      if (task.estimate && totalLoggedHours > task.estimate) {
        return "Yes";
      } else if (task.status === "In Progress" && task.priority === "High") {
        return "Yes";
      }
      return "No";
    })();

    // Calculate estimateAccuracyRatio
    const estimateAccuracyRatio =
      task.estimate && task.estimate > 0
        ? (totalLoggedHours / task.estimate).toFixed(2)
        : "";

    return {
      taskId: task.id,
      taskTitle: task.title,
      epicName,
      assigneeName,
      status: task.status,
      priority: task.priority,
      estimateHours: task.estimate?.toString() || "",
      totalLoggedHours: totalLoggedHours.toFixed(2),
      createdDate,
      inProgressDate,
      completedDate,
      dueDate: task.dueDate,
      cycleTimeDays,
      overdue,
      atRisk,
      estimateAccuracyRatio,
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
    "estimateHours",
    "totalLoggedHours",
    "createdDate",
    "inProgressDate",
    "completedDate",
    "dueDate",
    "cycleTimeDays",
    "overdue",
    "atRisk",
    "estimateAccuracyRatio",
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
