"use client";

import {
  mapComment,
  mapEpic,
  mapEpicDoc,
  mapGoal,
  mapGoalKpi,
  mapSubtask,
  mapTask,
  mapUser,
} from "@/lib/pb-mappers";
import {
  PBComment,
  PBEpic,
  PBEpicDoc,
  PBGoal,
  PBGoalKpi,
  PBSubtask,
  PBTask,
  PBUser,
} from "@/lib/pb-types";
import { getEpicAllowedUserIds } from "@/lib/permissions";
import { pb } from "@/lib/pocketbase";
import {
  Comment,
  Epic,
  EpicDoc,
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
  useEffect,
  useState,
} from "react";

interface DataStoreContextType {
  goals: Goal[];
  epics: Epic[];
  epicDocs: EpicDoc[];
  tasks: Task[];
  users: User[];
  isLoading: boolean;
  refreshUsers: () => Promise<void>;
  // EpicDoc CRUD
  createEpicDoc: (
    epicId: string,
    title: string,
    content: string,
    author: User,
  ) => EpicDoc;
  updateEpicDoc: (
    id: string,
    data: { title?: string; content?: string },
  ) => void;
  deleteEpicDoc: (id: string) => void;
  // Goal CRUD
  createGoal: (data: {
    title: string;
    description: string;
    ownerId: string;
  }) => void;
  updateGoal: (
    goalId: string,
    data: { title: string; description: string },
  ) => void;
  deleteGoal: (goalId: string) => void;
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
    dueDate?: string;
    startDate?: string;
  }) => Task;
  updateTask: (
    id: string,
    data: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "status"
        | "priority"
        | "order"
        | "dueDate"
        | "startDate"
      >
    > & { assigneeId?: string },
  ) => void;
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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [epicDocs, setEpicDocs] = useState<EpicDoc[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Incrementing this triggers a data reload (e.g. after login).
  const [authTrigger, setAuthTrigger] = useState(0);

  // ── Re-trigger load on login / logout ────────────────────────────────────

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      if (model) {
        // User just logged in — reload all data
        setAuthTrigger((n) => n + 1);
      } else {
        // User logged out — clear all state
        setGoals([]);
        setEpics([]);
        setEpicDocs([]);
        setTasks([]);
        setUsers([]);
        setIsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // ── Data load (runs on mount and after authTrigger changes) ──────────────

  useEffect(() => {
    async function load() {
      setIsLoading(true);

      // Guard: do not attempt record fetches if there is no valid auth token.
      // This prevents 403 errors when the DataStore mounts before the user
      // has authenticated (no token in localStorage).
      if (!pb.authStore.isValid) {
        setIsLoading(false);
        return;
      }

      try {
        // Stage 1: fetch users + epics first.
        // Epics are already filtered by PB rules (owner/watcher) correctly.
        // We then use the accessible epic IDs to explicitly filter tasks,
        // bypassing the unreliable 2-hop join in PB task listRule.
        const [pbUsers, pbEpics] = await Promise.all([
          pb.collection("users").getFullList<PBUser>(),
          pb.collection("epics").getFullList<PBEpic>({
            expand: "owner,watchers",
          }),
        ]);

        // Stage 2: fetch remaining collections in parallel.
        // IMPORTANT: tasks.listRule must be `@request.auth.id != ""` in PB
        // admin UI so all epic members (watchers) can retrieve tasks.
        // Until that rule is updated, client-side epic filtering below acts
        // as a safety net but PB will still gatekeep watcher visibility.
        const accessibleEpicIds = new Set(pbEpics.map((e) => e.id));

        const [pbTasks, pbGoals, pbKpis, pbSubtasks, pbComments, pbEpicDocs] =
          await Promise.all([
            pb.collection("tasks").getFullList<PBTask>({
              expand: "owner,assignee",
            }),
            pb.collection("goals").getFullList<PBGoal>({
              expand: "owner,linked_epics",
            }),
            pb.collection("goal_kpis").getFullList<PBGoalKpi>(),
            pb.collection("subtasks").getFullList<PBSubtask>({
              expand: "assignee",
            }),
            pb.collection("comments").getFullList<PBComment>({
              expand: "author,mentions",
            }),
            pb.collection("epic_docs").getFullList<PBEpicDoc>({
              expand: "created_by",
            }),
          ]);

        setUsers(pbUsers.map(mapUser));
        setEpics(pbEpics.map(mapEpic));
        setEpicDocs(pbEpicDocs.map(mapEpicDoc));

        // Client-side cross-filter: only keep tasks that belong to epics the
        // current user can actually access.
        const mappedTasks = pbTasks
          .filter((t) => accessibleEpicIds.has(t.epic))
          .map((t) => {
            const subtasks = pbSubtasks
              .filter((s) => s.task === t.id)
              .map(mapSubtask);
            const comments = pbComments
              .filter((c) => c.task === t.id)
              .map(mapComment);
            return mapTask(t, subtasks, comments);
          });
        setTasks(mappedTasks);

        const mappedGoals = pbGoals.map((g) => {
          const kpis = pbKpis.filter((k) => k.goal === g.id).map(mapGoalKpi);
          return mapGoal(g, kpis);
        });
        setGoals(mappedGoals);
      } catch (err) {
        console.error("DataStore: failed to load from PocketBase:", err);
        if (
          process.env.NODE_ENV === "development" &&
          err &&
          typeof err === "object" &&
          "data" in err
        ) {
          console.error(
            "PocketBase error detail:",
            JSON.stringify((err as Record<string, unknown>).data, null, 2),
          );
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authTrigger]);

  const refreshUsers = useCallback(async () => {
    const pbUsers = await pb.collection("users").getFullList<PBUser>();
    setUsers(pbUsers.map(mapUser));
  }, []);

  // ── Goal operations ──────────────────────────────────────────────────────

  const addGoalKpi = useCallback((goalId: string, kpi: Omit<GoalKpi, "id">) => {
    const tempId = `kpi-${Date.now()}`;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, kpis: [...g.kpis, { ...kpi, id: tempId }] }
          : g,
      ),
    );
    pb.collection("goal_kpis")
      .create({
        label: kpi.label,
        target: kpi.target,
        current: kpi.current,
        unit: kpi.unit,
        green_threshold: kpi.greenThreshold,
        yellow_threshold: kpi.yellowThreshold,
        goal: goalId,
      })
      .then((record) => {
        const realKpi = mapGoalKpi(record as unknown as PBGoalKpi);
        setGoals((prev) =>
          prev.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  kpis: g.kpis.map((k) => (k.id === tempId ? realKpi : k)),
                }
              : g,
          ),
        );
      })
      .catch(() => {
        setGoals((prev) =>
          prev.map((g) =>
            g.id === goalId
              ? { ...g, kpis: g.kpis.filter((k) => k.id !== tempId) }
              : g,
          ),
        );
      });
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
      pb.collection("goal_kpis")
        .update(kpiId, {
          label: data.label,
          target: data.target,
          current: data.current,
          unit: data.unit,
          green_threshold: data.greenThreshold,
          yellow_threshold: data.yellowThreshold,
        })
        .catch(() => {
          // On error, reload from server
          pb.collection("goal_kpis")
            .getOne<PBGoalKpi>(kpiId)
            .then((record) => {
              const serverKpi = mapGoalKpi(record);
              setGoals((prev) =>
                prev.map((g) =>
                  g.id === goalId
                    ? {
                        ...g,
                        kpis: g.kpis.map((k) =>
                          k.id === kpiId ? serverKpi : k,
                        ),
                      }
                    : g,
                ),
              );
            })
            .catch(() => {});
        });
    },
    [],
  );

  const deleteGoalKpi = useCallback(
    (goalId: string, kpiId: string) => {
      const prevGoals = goals;
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, kpis: g.kpis.filter((k) => k.id !== kpiId) }
            : g,
        ),
      );
      pb.collection("goal_kpis")
        .delete(kpiId)
        .catch(() => setGoals(prevGoals));
    },
    [goals],
  );

  const updateGoalLinkedEpics = useCallback(
    (goalId: string, epicIds: string[]) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, linkedEpicIds: epicIds } : g,
        ),
      );
      pb.collection("goals")
        .update(goalId, { linked_epics: epicIds })
        .catch(() => {});
    },
    [],
  );

  const createGoal = useCallback(
    (data: { title: string; description: string; ownerId: string }) => {
      pb.collection("goals")
        .create({
          title: data.title,
          description: data.description,
          owner: data.ownerId,
          linked_epics: [],
        })
        .then((record) => {
          const owner = users.find((u) => u.id === data.ownerId);
          if (!owner) return;
          const newGoal: Goal = {
            id: record.id,
            title: data.title,
            description: data.description,
            owner,
            kpis: [],
            linkedEpicIds: [],
          };
          setGoals((prev) => [...prev, newGoal]);
        })
        .catch(() => {});
    },
    [users],
  );

  const updateGoal = useCallback(
    (goalId: string, data: { title: string; description: string }) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, title: data.title, description: data.description }
            : g,
        ),
      );
      pb.collection("goals")
        .update(goalId, { title: data.title, description: data.description })
        .catch(() => {});
    },
    [],
  );

  const deleteGoal = useCallback((goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    pb.collection("goals")
      .delete(goalId)
      .catch(() => {});
  }, []);

  // ── Epic CRUD ────────────────────────────────────────────────────────────

  const createEpic = useCallback(
    (data: {
      title: string;
      description: string;
      ownerId: string;
      status: EpicStatus;
      startDate?: string;
      endDate?: string;
    }): Epic => {
      const owner = users.find((u) => u.id === data.ownerId) ?? users[0];
      const tempId = `epic-${Date.now()}`;
      const tempEpic: Epic = {
        id: tempId,
        title: data.title,
        description: data.description,
        owner,
        watchers: [],
        status: data.status,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      };
      setEpics((prev) => [...prev, tempEpic]);

      pb.collection("epics")
        .create(
          {
            title: data.title,
            description: data.description,
            status: data.status,
            start_date: data.startDate
              ? `${data.startDate} 00:00:00.000Z`
              : null,
            end_date: data.endDate ? `${data.endDate} 00:00:00.000Z` : null,
            owner: data.ownerId,
            watchers: [],
          },
          { expand: "owner,watchers" },
        )
        .then((record) => {
          const real = mapEpic(record as unknown as PBEpic);
          setEpics((prev) => prev.map((e) => (e.id === tempId ? real : e)));
        })
        .catch(() => {
          setEpics((prev) => prev.filter((e) => e.id !== tempId));
        });

      return tempEpic;
    },
    [users],
  );

  const updateEpic = useCallback(
    (
      id: string,
      data: Partial<
        Pick<Epic, "title" | "description" | "status" | "startDate" | "endDate">
      > & { ownerId?: string },
    ) => {
      setEpics((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const updated = { ...e, ...data };
          if (data.ownerId) {
            const newOwner = users.find((u) => u.id === data.ownerId);
            if (newOwner) updated.owner = newOwner;
          }
          return updated;
        }),
      );

      const payload: Record<string, unknown> = {};
      if (data.title !== undefined) payload.title = data.title;
      if (data.description !== undefined)
        payload.description = data.description;
      if (data.status !== undefined) payload.status = data.status;
      if (data.startDate !== undefined)
        payload.start_date = data.startDate
          ? `${data.startDate} 00:00:00.000Z`
          : null;
      if (data.endDate !== undefined)
        payload.end_date = data.endDate
          ? `${data.endDate} 00:00:00.000Z`
          : null;
      if (data.ownerId !== undefined) payload.owner = data.ownerId;

      pb.collection("epics")
        .update(id, payload)
        .catch(() => {});
    },
    [users],
  );

  const updateEpicWatchers = useCallback(
    (epicId: string, watcherIds: string[]) => {
      setEpics((prev) =>
        prev.map((e) => {
          if (e.id !== epicId) return e;
          const watchers = users.filter((u) => watcherIds.includes(u.id));
          return { ...e, watchers };
        }),
      );
      pb.collection("epics")
        .update(epicId, { watchers: watcherIds }, { expand: "owner,watchers" })
        .then((record) => {
          // Sync local state with what PocketBase actually persisted.
          // If the schema had a single-select constraint, this reveals the
          // truncation immediately rather than hiding it behind the optimistic update.
          const confirmed = mapEpic(record as unknown as PBEpic);
          setEpics((prev) =>
            prev.map((e) =>
              e.id === epicId ? { ...e, watchers: confirmed.watchers } : e,
            ),
          );
        })
        .catch(() => {});
    },
    [users],
  );

  const deleteEpic = useCallback((id: string) => {
    setEpics((prev) => prev.filter((e) => e.id !== id));
    setTasks((prev) => prev.filter((t) => t.epicId !== id));
    pb.collection("epics")
      .delete(id)
      .catch(() => {});
  }, []);

  // ── Task CRUD ────────────────────────────────────────────────────────────

  const createTask = useCallback(
    (data: {
      title: string;
      epicId: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      assigneeId?: string;
      dueDate?: string;
      startDate?: string;
    }): Task => {
      // Validate assigneeId: must be an epic member (owner or watcher)
      const epic = epics.find((e) => e.id === data.epicId);
      const allowedIds = epic ? getEpicAllowedUserIds(epic) : new Set<string>();
      const safeAssigneeId =
        data.assigneeId && allowedIds.has(data.assigneeId)
          ? data.assigneeId
          : undefined;

      const assignee = safeAssigneeId
        ? users.find((u) => u.id === safeAssigneeId) || null
        : null;
      const tempId = `task-${Date.now()}`;
      const tempTask: Task = {
        id: tempId,
        epicId: data.epicId,
        title: data.title,
        description: data.description ?? "",
        owner: assignee || undefined,
        assignee,
        status: data.status ?? "To Do",
        priority: data.priority ?? "Medium",
        dueDate: data.dueDate ?? "",
        startDate: data.startDate || undefined,
        subtasks: [],
        comments: [],
      };
      setTasks((prev) => [...prev, tempTask]);

      pb.collection("tasks")
        .create(
          {
            title: data.title,
            description: data.description ?? "",
            status: data.status ?? "To Do",
            priority: data.priority ?? "Medium",
            epic: data.epicId,
            assignee: safeAssigneeId ?? null,
            owner: safeAssigneeId ?? null,
            due_date: data.dueDate ? `${data.dueDate} 00:00:00.000Z` : null,
            start_date: data.startDate
              ? `${data.startDate} 00:00:00.000Z`
              : null,
          },
          { expand: "owner,assignee" },
        )
        .then((record) => {
          const real = mapTask(record as unknown as PBTask, [], []);
          setTasks((prev) => prev.map((t) => (t.id === tempId ? real : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== tempId));
        });

      return tempTask;
    },
    [users, epics],
  );

  const updateTask = useCallback(
    (
      id: string,
      data: Partial<
        Pick<
          Task,
          | "title"
          | "description"
          | "status"
          | "priority"
          | "order"
          | "dueDate"
          | "startDate"
        >
      > & { assigneeId?: string },
    ) => {
      // Compute a validated assigneeId by reading current tasks from functional state.
      // safeAssigneeId is captured in a let so the PB write can reuse it.
      let resolvedAssigneeId: string | undefined | null = data.assigneeId;

      setTasks((prev) => {
        if (data.assigneeId !== undefined && data.assigneeId !== "") {
          const currentTask = prev.find((t) => t.id === id);
          const epic = currentTask
            ? epics.find((e) => e.id === currentTask.epicId)
            : undefined;
          const allowedIds = epic
            ? getEpicAllowedUserIds(epic)
            : new Set<string>();
          if (!allowedIds.has(data.assigneeId)) {
            // Invalid assignee — discard silently, keep existing
            resolvedAssigneeId = undefined;
          }
        }

        return prev.map((t) => {
          if (t.id !== id) return t;
          const updated = { ...t, ...data };
          if (resolvedAssigneeId !== undefined) {
            updated.assignee = resolvedAssigneeId
              ? users.find((u) => u.id === resolvedAssigneeId) || null
              : null;
          } else if (data.assigneeId !== undefined) {
            // assigneeId was rejected — preserve existing assignee
            updated.assignee = t.assignee;
          }
          return updated;
        });
      });

      const payload: Record<string, unknown> = {};
      if (data.title !== undefined) payload.title = data.title;
      if (data.description !== undefined)
        payload.description = data.description;
      if (data.status !== undefined) payload.status = data.status;
      if (data.priority !== undefined) payload.priority = data.priority;
      if (data.order !== undefined) payload.order = data.order;
      if (data.dueDate !== undefined)
        payload.due_date = data.dueDate
          ? `${data.dueDate} 00:00:00.000Z`
          : null;
      if (data.startDate !== undefined)
        payload.start_date = data.startDate
          ? `${data.startDate} 00:00:00.000Z`
          : null;
      // Only persist a valid assigneeId (resolvedAssigneeId is set to undefined if invalid)
      if (resolvedAssigneeId !== undefined) {
        payload.assignee = resolvedAssigneeId || null;
      }

      pb.collection("tasks")
        .update(id, payload)
        .catch(() => {});
    },
    [users, epics],
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    pb.collection("tasks")
      .delete(id)
      .catch(() => {});
  }, []);

  // ── Subtask CRUD ─────────────────────────────────────────────────────────

  const createSubtask = useCallback(
    (taskId: string, data: { title: string; assigneeId?: string }): Subtask => {
      const assignee = data.assigneeId
        ? users.find((u) => u.id === data.assigneeId) || undefined
        : undefined;
      const tempId = `sub-${Date.now()}`;
      const tempSubtask: Subtask = {
        id: tempId,
        taskId,
        title: data.title,
        done: false,
        assignee,
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...t.subtasks, tempSubtask] }
            : t,
        ),
      );

      pb.collection("subtasks")
        .create(
          {
            title: data.title,
            done: false,
            task: taskId,
            assignee: data.assigneeId ?? null,
          },
          { expand: "assignee" },
        )
        .then((record) => {
          const real = mapSubtask(record as unknown as PBSubtask);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    subtasks: t.subtasks.map((s) =>
                      s.id === tempId ? real : s,
                    ),
                  }
                : t,
            ),
          );
        })
        .catch(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== tempId) }
                : t,
            ),
          );
        });

      return tempSubtask;
    },
    [users],
  );

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t,
      ),
    );
    pb.collection("subtasks")
      .delete(subtaskId)
      .catch(() => {});
  }, []);

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
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

      // Find current done state to compute new value for PocketBase
      const task = tasks.find((t) => t.id === taskId);
      const subtask = task?.subtasks.find((s) => s.id === subtaskId);
      const newDone = subtask ? !subtask.done : true;

      pb.collection("subtasks")
        .update(subtaskId, { done: newDone })
        .catch(() => {});
    },
    [tasks],
  );

  // ── Comment CRUD ─────────────────────────────────────────────────────────

  const addComment = useCallback(
    (taskId: string, text: string, author: User): Comment => {
      const tempId = `comment-${Date.now()}`;
      const tempComment: Comment = {
        id: tempId,
        taskId,
        author,
        text,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...t.comments, tempComment] }
            : t,
        ),
      );

      pb.collection("comments")
        .create(
          {
            text,
            task: taskId,
            author: author.id,
          },
          { expand: "author,mentions" },
        )
        .then((record) => {
          const real = mapComment(record as unknown as PBComment);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    comments: t.comments.map((c) =>
                      c.id === tempId ? real : c,
                    ),
                  }
                : t,
            ),
          );
        })
        .catch(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, comments: t.comments.filter((c) => c.id !== tempId) }
                : t,
            ),
          );
        });

      return tempComment;
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
    pb.collection("comments")
      .delete(commentId)
      .catch(() => {});
  }, []);

  // ── EpicDoc CRUD ──────────────────────────────────────────────────────────

  const createEpicDoc = useCallback(
    (epicId: string, title: string, content: string, author: User): EpicDoc => {
      const tempId = `doc-${Date.now()}`;
      const tempDoc: EpicDoc = {
        id: tempId,
        epicId,
        title,
        content,
        createdBy: author,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setEpicDocs((prev) => [...prev, tempDoc]);

      pb.collection("epic_docs")
        .create(
          { title, content, epic: epicId, created_by: author.id },
          { expand: "created_by" },
        )
        .then((record) => {
          const real = mapEpicDoc(record as unknown as PBEpicDoc);
          setEpicDocs((prev) => prev.map((d) => (d.id === tempId ? real : d)));
        })
        .catch(() => {
          setEpicDocs((prev) => prev.filter((d) => d.id !== tempId));
        });

      return tempDoc;
    },
    [],
  );

  const updateEpicDoc = useCallback(
    (id: string, data: { title?: string; content?: string }) => {
      setEpicDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, ...data, updatedAt: new Date().toISOString() }
            : d,
        ),
      );
      pb.collection("epic_docs")
        .update(id, data)
        .catch(() => {});
    },
    [],
  );

  const deleteEpicDoc = useCallback((id: string) => {
    setEpicDocs((prev) => prev.filter((d) => d.id !== id));
    pb.collection("epic_docs")
      .delete(id)
      .catch(() => {});
  }, []);

  return (
    <DataStoreContext.Provider
      value={{
        goals,
        epics,
        epicDocs,
        tasks,
        users,
        isLoading,
        refreshUsers,
        createEpicDoc,
        updateEpicDoc,
        deleteEpicDoc,
        createGoal,
        updateGoal,
        deleteGoal,
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
