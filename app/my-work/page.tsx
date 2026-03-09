"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { WorkSection } from "@/components/my-work/WorkSection";
import { AvatarChip } from "@/components/shared/AvatarChip";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { TaskStatus } from "@/lib/types";
import { CheckSquare, Filter } from "lucide-react";
import { useMemo, useState } from "react";

const ORDERED_STATUSES: TaskStatus[] = [
  "In Progress",
  "Review",
  "To Do",
  "Done",
];

const ALL_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

type DueDateFilter = "all" | "overdue" | "today" | "thisWeek" | "later";

export default function MyWorkPage() {
  const { currentUser } = useAuth();
  const { tasks } = useDataStore();
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const NOW = useMemo(() => new Date(), []);
  const WEEK_END = useMemo(
    () => new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    [NOW],
  );

  // Apply filters to tasks
  const myTasks = useMemo(() => {
    if (!currentUser) return [];
    let filtered = tasks.filter((t) => t.assignee?.id === currentUser.id);

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((t) => selectedStatuses.includes(t.status));
    }

    // Due date filter
    if (dueDateFilter !== "all") {
      filtered = filtered.filter((t) => {
        const dueDate = new Date(t.dueDate);

        switch (dueDateFilter) {
          case "overdue":
            return dueDate < NOW && t.status !== "Done";
          case "today":
            return dueDate.toDateString() === NOW.toDateString();
          case "thisWeek":
            return dueDate > NOW && dueDate <= WEEK_END;
          case "later":
            return dueDate > WEEK_END;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tasks, currentUser, selectedStatuses, dueDateFilter, NOW, WEEK_END]);

  // Subtasks assigned to current user, with their parent task reference
  const mySubtaskEntries = useMemo(() => {
    if (!currentUser) return [];
    return tasks.flatMap((task) =>
      task.subtasks
        .filter((s) => s.assignee?.id === currentUser.id)
        .map((s) => ({ subtask: s, parentTaskId: task.id })),
    );
  }, [tasks, currentUser]);

  if (!currentUser) return null;

  const tasksByStatus = (status: TaskStatus) =>
    myTasks.filter((t) => t.status === status);

  const subtasksByStatus = (status: TaskStatus) =>
    mySubtaskEntries.filter(({ subtask, parentTaskId }) => {
      const parent = tasks.find((t) => t.id === parentTaskId)!;
      if (status === "Done") return subtask.done;
      return !subtask.done && parent.status === status;
    });

  const totalItems = myTasks.length + mySubtaskEntries.length;
  const activeFilterCount =
    (selectedStatuses.length > 0 ? 1 : 0) + (dueDateFilter !== "all" ? 1 : 0);

  function toggleStatus(status: TaskStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  function clearFilters() {
    setSelectedStatuses([]);
    setDueDateFilter("all");
  }

  // Count tasks by due date for badge display
  const overdueCount = myTasks.filter(
    (t) => new Date(t.dueDate) < NOW && t.status !== "Done",
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "My Work" }]} />
      </div>

      <div className="flex-1 px-6 py-6">
        {/* Heading with filter button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-foreground">My Work</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <AvatarChip user={currentUser} size="sm" showName />
                <span className="text-xs text-muted-foreground">
                  · {totalItems} items assigned
                  {overdueCount > 0 && (
                    <span className="ml-1 text-red-600 font-medium">
                      · {overdueCount} overdue
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter controls */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Filter Your Tasks
              </h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Status filter */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        selectedStatuses.includes(status)
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                          : "bg-white border-border text-foreground hover:bg-slate-50"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {selectedStatuses.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Showing {selectedStatuses.length} status
                    {selectedStatuses.length > 1 ? "es" : ""}
                  </p>
                )}
              </div>

              {/* Due date filter */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Due Date
                </label>
                <select
                  value={dueDateFilter}
                  onChange={(e) =>
                    setDueDateFilter(e.target.value as DueDateFilter)
                  }
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due today</option>
                  <option value="thisWeek">Due this week</option>
                  <option value="later">Due later</option>
                </select>
                {dueDateFilter !== "all" && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Filtering by:{" "}
                    {dueDateFilter === "overdue"
                      ? "Overdue tasks"
                      : dueDateFilter === "today"
                        ? "Due today"
                        : dueDateFilter === "thisWeek"
                          ? "Due this week"
                          : "Due later"}
                  </p>
                )}
              </div>
            </div>

            {/* Applied filters summary */}
            {activeFilterCount > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {myTasks.length} task{myTasks.length !== 1 ? "s" : ""}
                  </span>{" "}
                  match your filters
                </p>
              </div>
            )}
          </div>
        )}

        {totalItems === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground text-sm">
              Nothing assigned to you yet.
            </p>
          </div>
        ) : myTasks.length > 0 && myTasks.every((t) => t.status === "Done") && activeFilterCount === 0 ? (
          <div className="rounded-lg border border-dashed border-green-200 bg-green-50/50 py-16 text-center">
            <p className="text-green-700 font-medium text-sm">
              No tasks in progress. You&apos;re all caught up! 🎉
            </p>
          </div>
        ) : myTasks.length === 0 && activeFilterCount > 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-2">
              No tasks match your filters
            </p>
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {ORDERED_STATUSES.map((status) => {
              const tasks = tasksByStatus(status);
              const subtasks = subtasksByStatus(status);
              return (
                <WorkSection
                  key={status}
                  status={status}
                  tasks={tasks}
                  subtasks={subtasks}
                  defaultExpanded={status !== "Done"}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
