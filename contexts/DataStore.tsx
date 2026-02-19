"use client";

import { EPICS, GOALS, TASKS, USERS } from "@/lib/mock";
import {
  Comment,
  Epic,
  EpicStatus,
  Goal,
  GoalKpi,
  Priority,
  Subtask,
  Task,
  TaskStatus,
  User,
} from "@/lib/types";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface DataStoreContextType {
  goals: Goal[];
  epics: Epic[];
  tasks: Task[];
  // Goal KPI operations
  addGoalKpi: (goalId: string, kpi: Omit<GoalKpi, "id">) => void;
  updateGoalKpi: (
    goalId: string,
    kpiId: string,
    data: Partial<Omit<GoalKpi, "id">>,
  ) => void;
  deleteGoalKpi: (goalId: string, kpiId: string) => void;
  // Goal operations
  updateGoalLinkedEpics: (goalId: string, epicIds: string[]) => void;
  // Epic CRUD
  createEpic: (data: {
    title: string;
    description: string;
    ownerId: string;
    status: EpicStatus;
    memberIds?: string[];
    startDate?: string;
    endDate?: string;
  }) => Epic;
  updateEpic: (
    id: string,
    data: Partial<
      Pick<Epic, "title" | "description" | "status" | "startDate" | "endDate">
    > & { ownerId?: string },
  ) => void;
  updateEpicWatchers: (epicId: string, watcherIds: string[]) => void;
  deleteEpic: (id: string) => void;
  // Task CRUD
  createTask: (data: {
    title: string;
    epicId: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string;
  }) => Task;
  updateTask: (
    id: string,
    data: Partial<
      Pick<Task, "title" | "description" | "status" | "priority">
    > & { assigneeId?: string },
  ) => void;
  updateTaskWatchers: (taskId: string, watcherIds: string[]) => void;
  deleteTask: (id: string) => void;
  // Subtask CRUD
  createSubtask: (
    taskId: string,
    data: { title: string; assigneeId?: string },
  ) => Subtask;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  // Comment CRUD
  addComment: (taskId: string, text: string, author: User) => Comment;
  deleteComment: (taskId: string, commentId: string) => void;
}

const DataStoreContext = createContext<DataStoreContextType | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([...GOALS]);
  const [epics, setEpics] = useState<Epic[]>([...EPICS]);
  const [tasks, setTasks] = useState<Task[]>([...TASKS]);

  // ── Goal operations ───────────────────────────────────────────────────────

  const addGoalKpi = useCallback((goalId: string, kpi: Omit<GoalKpi, "id">) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, kpis: [...g.kpis, { ...kpi, id: `kpi-${Date.now()}` }] }
          : g,
      ),
    );
  }, []);

  const updateGoalKpi = useCallback(
    (goalId: string, kpiId: string, data: Partial<Omit<GoalKpi, "id">>) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                kpis: g.kpis.map((k) =>
                  k.id === kpiId ? { ...k, ...data } : k,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const deleteGoalKpi = useCallback((goalId: string, kpiId: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, kpis: g.kpis.filter((k) => k.id !== kpiId) }
          : g,
      ),
    );
  }, []);

  const updateGoalLinkedEpics = useCallback(
    (goalId: string, epicIds: string[]) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, linkedEpicIds: epicIds } : g,
        ),
      );
    },
    [],
  );

  // ── Epic CRUD ─────────────────────────────────────────────────────────────

  const createEpic = useCallback(
    (data: {
      title: string;
      description: string;
      ownerId: string;
      status: EpicStatus;
      memberIds?: string[];
      startDate?: string;
      endDate?: string;
    }): Epic => {
      const owner = USERS.find((u) => u.id === data.ownerId) ?? USERS[0];
      // Ensure owner is always a member and a watcher of the epic they create.
      const memberSet = new Set([data.ownerId, ...(data.memberIds ?? [])]);
      const newEpic: Epic = {
        id: `e-${Date.now()}`,
        title: data.title,
        description: data.description,
        owner,
        watchers: [owner],
        status: data.status,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        memberIds: Array.from(memberSet),
      };
      setEpics((prev) => [...prev, newEpic]);
      return newEpic;
    },
    [],
  );

  const updateEpic = useCallback(
    (
      id: string,
      data: Partial<
        Pick<
          Epic,
          "title" | "description" | "status" | "startDate" | "endDate"
        >
      > & { ownerId?: string },
    ) => {
      setEpics((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const updated = { ...e, ...data };
          // If ownerId is provided, find the user and update owner
          if (data.ownerId) {
            const newOwner = USERS.find((u) => u.id === data.ownerId);
            if (newOwner) updated.owner = newOwner;
          }
          return updated;
        }),
      );
    },
    [],
  );

  const updateEpicWatchers = useCallback(
    (epicId: string, watcherIds: string[]) => {
      setEpics((prev) =>
        prev.map((e) => {
          if (e.id !== epicId) return e;
          const watchers = USERS.filter((u) => watcherIds.includes(u.id));
          // Simulate notification to watchers
          console.log(
            `[Notification] Epic "${e.title}" watchers updated:`,
            watchers.map((w) => w.name),
          );
          return { ...e, watchers };
        }),
      );
    },
    [],
  );

  const deleteEpic = useCallback((id: string) => {
    setEpics((prev) => prev.filter((e) => e.id !== id));
    setTasks((prev) => prev.filter((t) => t.epicId !== id));
  }, []);

  // ── Task CRUD ─────────────────────────────────────────────────────────────

  const createTask = useCallback(
    (data: {
      title: string;
      epicId: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      assigneeId?: string;
    }): Task => {
      const assignee = data.assigneeId
        ? USERS.find((u) => u.id === data.assigneeId) || null
        : null;
      const newTask: Task = {
        id: `t-${Date.now()}`,
        epicId: data.epicId,
        title: data.title,
        description: data.description ?? "",
        owner: assignee || undefined,
        assignee,
        watchers: [],
        status: data.status ?? "To Do",
        priority: data.priority ?? "Medium",
        dueDate: "",
        subtasks: [],
        comments: [],
        attachments: [],
        externalLinks: [],
      };
      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [],
  );

  const updateTask = useCallback(
    (
      id: string,
      data: Partial<
        Pick<Task, "title" | "description" | "status" | "priority">
      > & { assigneeId?: string },
    ) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const updated = { ...t, ...data };
          // If assigneeId is provided, find the user and update assignee
          if (data.assigneeId !== undefined) {
            updated.assignee = data.assigneeId
              ? USERS.find((u) => u.id === data.assigneeId) || null
              : null;
          }
          // Notify watchers on status change
          if (
            data.status &&
            data.status !== t.status &&
            t.watchers.length > 0
          ) {
            console.log(
              `[Notification] Task "${t.title}" status changed to ${data.status}. Notifying:`,
              t.watchers.map((w) => w.name),
            );
          }
          return updated;
        }),
      );
    },
    [],
  );

  const updateTaskWatchers = useCallback(
    (taskId: string, watcherIds: string[]) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const watchers = USERS.filter((u) => watcherIds.includes(u.id));
          // Simulate notification to watchers
          console.log(
            `[Notification] Task "${t.title}" watchers updated:`,
            watchers.map((w) => w.name),
          );
          return { ...t, watchers };
        }),
      );
    },
    [],
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Subtask CRUD ──────────────────────────────────────────────────────────

  const createSubtask = useCallback(
    (taskId: string, data: { title: string; assigneeId?: string }): Subtask => {
      const assignee = data.assigneeId
        ? USERS.find((u) => u.id === data.assigneeId) || undefined
        : undefined;
      const newSubtask: Subtask = {
        id: `s-${Date.now()}`,
        taskId,
        title: data.title,
        done: false,
        assignee,
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t,
        ),
      );
      return newSubtask;
    },
    [],
  );

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t,
      ),
    );
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, done: !s.done } : s,
              ),
            }
          : t,
      ),
    );
  }, []);

  // ── Comment CRUD ──────────────────────────────────────────────────────────

  const addComment = useCallback(
    (taskId: string, text: string, author: User): Comment => {
      const newComment: Comment = {
        id: `c-${Date.now()}`,
        taskId,
        author,
        text,
        createdAt: "Just now",
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, comments: [...t.comments, newComment] } : t,
        ),
      );
      return newComment;
    },
    [],
  );

  const deleteComment = useCallback((taskId: string, commentId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) }
          : t,
      ),
    );
  }, []);


  return (
    <DataStoreContext.Provider
      value={{
        goals,
        epics,
        tasks,
        addGoalKpi,
        updateGoalKpi,
        deleteGoalKpi,
        updateGoalLinkedEpics,
        createEpic,
        updateEpic,
        updateEpicWatchers,
        deleteEpic,
        createTask,
        updateTask,
        updateTaskWatchers,
        deleteTask,
        createSubtask,
        deleteSubtask,
        toggleSubtask,
        addComment,
        deleteComment,
      }}
    >
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx)
    throw new Error("useDataStore must be used within DataStoreProvider");
  return ctx;
}
