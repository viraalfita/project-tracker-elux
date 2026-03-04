"use client";

import { useDataStore } from "@/contexts/DataStore";
import { Priority, Task, TaskStatus } from "@/lib/types";
import { ChevronDown, Filter, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export interface TaskFilters {
  assignees: string[];
  statuses: TaskStatus[];
  priorities: Priority[];
  epics: string[];
  overdue: boolean;
}

export interface TaskSort {
  field: "dueDate" | "priority" | "status" | "assignee";
  direction: "asc" | "desc";
}

interface TaskFilterSortProps {
  tasks: Task[];
  onFilteredTasksChange: (tasks: Task[]) => void;
}

const DEFAULT_FILTERS: TaskFilters = {
  assignees: [],
  statuses: [],
  priorities: [],
  epics: [],
  overdue: false,
};

const DEFAULT_SORT: TaskSort = {
  field: "dueDate",
  direction: "asc",
};

export function TaskFilterSort({
  tasks,
  onFilteredTasksChange,
}: TaskFilterSortProps) {
  const { epics, users } = useDataStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TaskSort>(DEFAULT_SORT);
  const [isOpen, setIsOpen] = useState(false);

  // Load filters from URL on mount
  useEffect(() => {
    const assignees = searchParams.get("assignee")?.split(",") || [];
    const statuses =
      (searchParams.get("status")?.split(",") as TaskStatus[]) || [];
    const priorities =
      (searchParams.get("priority")?.split(",") as Priority[]) || [];
    const epics = searchParams.get("epic")?.split(",") || [];
    const overdue = searchParams.get("overdue") === "true";
    const sortField =
      (searchParams.get("sortBy") as TaskSort["field"]) || "dueDate";
    const sortDir =
      (searchParams.get("sortDir") as TaskSort["direction"]) || "asc";

    setFilters({
      assignees,
      statuses,
      priorities,
      epics,
      overdue,
    });

    setSort({
      field: sortField,
      direction: sortDir,
    });
  }, [searchParams]);

  // Apply filters and sort
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply filters
    if (filters.assignees.length > 0) {
      filtered = filtered.filter((t) =>
        filters.assignees.includes(t.assignee?.id || "unassigned"),
      );
    }

    if (filters.statuses.length > 0) {
      filtered = filtered.filter((t) => filters.statuses.includes(t.status));
    }

    if (filters.priorities.length > 0) {
      filtered = filtered.filter((t) =>
        filters.priorities.includes(t.priority),
      );
    }

    if (filters.epics.length > 0) {
      filtered = filtered.filter((t) => filters.epics.includes(t.epicId));
    }

    if (filters.overdue) {
      const now = new Date();
      filtered = filtered.filter((t) => {
        const due = new Date(t.dueDate);
        return due < now && t.status !== "Done";
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sort.field) {
        case "dueDate":
          aValue = new Date(a.dueDate).getTime();
          bValue = new Date(b.dueDate).getTime();
          break;
        case "priority":
          const priorityOrder = { High: 3, Medium: 2, Low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case "status":
          const statusOrder = {
            "To Do": 1,
            "In Progress": 2,
            Review: 3,
            Done: 4,
          };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        case "assignee":
          aValue = a.assignee?.name || "Unassigned";
          bValue = b.assignee?.name || "Unassigned";
          break;
      }

      if (sort.direction === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [tasks, filters, sort]);

  // Update parent when filtered tasks change
  useEffect(() => {
    onFilteredTasksChange(filteredAndSortedTasks);
  }, [filteredAndSortedTasks, onFilteredTasksChange]);

  // Update URL with filter state
  function updateURL() {
    const params = new URLSearchParams();

    if (filters.assignees.length > 0) {
      params.set("assignee", filters.assignees.join(","));
    }
    if (filters.statuses.length > 0) {
      params.set("status", filters.statuses.join(","));
    }
    if (filters.priorities.length > 0) {
      params.set("priority", filters.priorities.join(","));
    }
    if (filters.epics.length > 0) {
      params.set("epic", filters.epics.join(","));
    }
    if (filters.overdue) {
      params.set("overdue", "true");
    }
    params.set("sortBy", sort.field);
    params.set("sortDir", sort.direction);

    router.push(`?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    updateURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort]);

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
  }

  const activeFilterCount =
    filters.assignees.length +
    filters.statuses.length +
    filters.priorities.length +
    filters.epics.length +
    (filters.overdue ? 1 : 0);

  function toggleArrayFilter<K extends keyof TaskFilters>(
    key: K,
    value: string,
  ) {
    setFilters((prev) => {
      const current = prev[key] as string[];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  return (
    <div className="relative">
      {/* Filter button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
      >
        <Filter className="h-4 w-4" />
        Filters & Sort
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 rounded-lg border border-border bg-white shadow-lg z-50">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Filters & Sort
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Assignee filter */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Assignee
              </label>
              <div className="flex flex-wrap gap-1.5">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleArrayFilter("assignees", user.id)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      filters.assignees.includes(user.id)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-border text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
                <button
                  onClick={() => toggleArrayFilter("assignees", "unassigned")}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    filters.assignees.includes("unassigned")
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-border text-foreground hover:bg-slate-50"
                  }`}
                >
                  Unassigned
                </button>
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  ["To Do", "In Progress", "Review", "Done"] as TaskStatus[]
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleArrayFilter("statuses", status)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      filters.statuses.includes(status)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-border text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority filter */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Priority
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(["Low", "Medium", "High"] as Priority[]).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => toggleArrayFilter("priorities", priority)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      filters.priorities.includes(priority)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-border text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Epic filter */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Epic
              </label>
              <div className="flex flex-wrap gap-1.5">
                {epics.map((epic) => (
                  <button
                    key={epic.id}
                    onClick={() => toggleArrayFilter("epics", epic.id)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      filters.epics.includes(epic.id)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-border text-foreground hover:bg-slate-50"
                    }`}
                  >
                    {epic.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle filters */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      overdue: e.target.checked,
                    }))
                  }
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                Overdue
              </label>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Sort By
              </label>
              <div className="flex gap-2">
                <select
                  value={sort.field}
                  onChange={(e) =>
                    setSort((prev) => ({
                      ...prev,
                      field: e.target.value as TaskSort["field"],
                    }))
                  }
                  className="flex-1 rounded-md border border-border bg-white px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="assignee">Assignee</option>
                </select>
                <button
                  onClick={() =>
                    setSort((prev) => ({
                      ...prev,
                      direction: prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="px-3 py-1 text-xs font-medium border border-border rounded hover:bg-slate-50"
                >
                  {sort.direction === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
