"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { TaskCard } from "@/components/board/TaskCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { USERS } from "@/lib/mock";
import { isUserInvolvedInEpic } from "@/lib/permissions";
import { Task, TaskStatus } from "@/lib/types";
import { ChevronDown, Filter, Kanban, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const COLUMNS: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];
const ALL_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

export default function BoardPage() {
  const { tasks: initialTasks, epics: allEpics } = useDataStore();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const { currentUser } = useAuth();

  // Epics the current user is allowed to see (Admin sees all; others see only
  // epics they are owner / watcher / member of, or have a task assigned).
  const visibleEpics = useMemo(
    () =>
      currentUser?.role === "Admin"
        ? allEpics
        : allEpics.filter(
            (e) =>
              currentUser && isUserInvolvedInEpic(e, currentUser.id, initialTasks),
          ),
    [allEpics, currentUser, initialTasks],
  );

  const visibleEpicIds = useMemo(
    () => new Set(visibleEpics.map((e) => e.id)),
    [visibleEpics],
  );

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks],
  );

  // Only Admin and Member can drag-and-drop
  const canDragDrop =
    currentUser?.role === "Admin" || currentUser?.role === "Member";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over) return; // dropped outside any column

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.status === newStatus) return t; // same column — no change
        return { ...t, status: newStatus };
      }),
    );
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [epicFilter, setEpicFilter] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<
    "overdue" | "this-week" | ""
  >("");
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Close assignee dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        assigneeDropdownRef.current &&
        !assigneeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAssigneeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Filtered view ──────────────────────────────────────────────────────────
  function getWeekEnd() {
    const today = new Date("2026-02-10");
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  }

  const filteredTasks = useMemo(() => {
    const NOW = new Date("2026-02-10");
    // Non-admin users only see tasks from epics they're involved in
    let result =
      currentUser?.role !== "Admin"
        ? tasks.filter((t) => visibleEpicIds.has(t.epicId))
        : tasks;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (epicFilter) {
      result = result.filter((t) => t.epicId === epicFilter);
    }

    if (dueDateFilter === "overdue") {
      result = result.filter((t) => {
        const due = new Date(t.dueDate);
        return due < NOW && t.status !== "Done";
      });
    } else if (dueDateFilter === "this-week") {
      const { start, end } = getWeekEnd();
      result = result.filter((t) => {
        const due = new Date(t.dueDate);
        return due >= start && due <= end;
      });
    }

    if (assigneeFilter.length > 0) {
      result = result.filter((t) => {
        if (assigneeFilter.includes("unassigned")) {
          return !t.assignee || assigneeFilter.includes(t.assignee.id);
        }
        return t.assignee && assigneeFilter.includes(t.assignee.id);
      });
    }

    return result;
  }, [
    tasks,
    currentUser,
    visibleEpicIds,
    searchQuery,
    statusFilter,
    epicFilter,
    dueDateFilter,
    assigneeFilter,
  ]);

  const hasFilters =
    searchQuery.trim() ||
    statusFilter ||
    epicFilter ||
    dueDateFilter ||
    assigneeFilter.length > 0;

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("");
    setEpicFilter("");
    setDueDateFilter("");
    setAssigneeFilter([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Board" },
          ]}
        />
      </div>

      <div className="flex flex-col flex-1 px-6 py-5">
        <div className="flex items-center gap-2 mb-4">
          <Kanban className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-foreground">Task Board</h1>
          <span className="text-sm text-muted-foreground">
            — {filteredTasks.length} of {tasks.length} tasks
          </span>
        </div>

        {/* ── Filter bar ── */}
        <div className="mb-4 rounded-lg border border-border bg-white p-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* Task search */}
          <input
            type="text"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded border border-border px-2.5 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[160px]"
          />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
            className="rounded border border-border bg-white px-2.5 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Epic filter */}
          <select
            value={epicFilter}
            onChange={(e) => setEpicFilter(e.target.value)}
            className="rounded border border-border bg-white px-2.5 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Epics</option>
            {visibleEpics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          {/* Due date filter */}
          <select
            value={dueDateFilter}
            onChange={(e) =>
              setDueDateFilter(e.target.value as "overdue" | "this-week" | "")
            }
            className="rounded border border-border bg-white px-2.5 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Due Dates</option>
            <option value="overdue">Overdue</option>
            <option value="this-week">Due This Week</option>
          </select>

          {/* Assignee filter */}
          <div className="relative" ref={assigneeDropdownRef}>
            <button
              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                assigneeFilter.length > 0
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-border bg-white text-foreground hover:bg-accent"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>
                {assigneeFilter.length === 0
                  ? "All Assignees"
                  : `${assigneeFilter.length} selected`}
              </span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showAssigneeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-md border border-border bg-white shadow-lg z-10">
                <div className="max-h-64 overflow-y-auto p-2">
                  {/* Unassigned option */}
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigneeFilter.includes("unassigned")}
                      onChange={(e) => {
                        setAssigneeFilter((prev) =>
                          e.target.checked
                            ? [...prev, "unassigned"]
                            : prev.filter((id) => id !== "unassigned"),
                        );
                      }}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-muted-foreground italic">
                      Unassigned
                    </span>
                  </label>

                  {/* User options */}
                  {USERS.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assigneeFilter.includes(user.id)}
                        onChange={(e) => {
                          setAssigneeFilter((prev) =>
                            e.target.checked
                              ? [...prev, user.id]
                              : prev.filter((id) => id !== user.id),
                          );
                        }}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="text-sm text-foreground">
                          {user.name}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Kanban grid */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-4 gap-3 flex-1 min-h-0 pb-4">
            {COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={filteredTasks.filter((t) => t.status === status)}
                canDragDrop={canDragDrop}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-1 shadow-2xl opacity-95">
                <TaskCard task={activeTask} canDragDrop={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
