import {
  PBComment,
  PBEpic,
  PBEpicDoc,
  PBGoal,
  PBGoalKpi,
  PBSubtask,
  PBTask,
  PBUser,
} from "./pb-types";
import {
  Comment,
  Epic,
  EpicDoc,
  EpicStatus,
  Goal,
  GoalKpi,
  Priority,
  Role,
  Subtask,
  Task,
  TaskStatus,
  User,
} from "./types";

function placeholderUser(id: string): User {
  return {
    id,
    name: "Unknown",
    email: "",
    initials: "?",
    avatarColor: "#94a3b8",
    role: "Viewer",
    weeklyCapacity: 40,
  };
}

/**
 * PocketBase returns relation fields as a bare string when maxSelect is
 * effectively 1 (i.e. stored as 0 / not set), and as an array when maxSelect
 * is properly set to > 1.  This helper normalises both cases so the rest of
 * the mapper code never needs to branch.
 */
function ensureArray<T>(val: T | T[] | null | undefined): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * PocketBase returns datetimes as "YYYY-MM-DD HH:MM:SS.mmmZ" (space-separated).
 * JavaScript's Date constructor requires ISO 8601 ("T"-separated) for reliable
 * cross-browser parsing. This helper normalises the string.
 */
function pbDate(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(" ", "T");
}

export function mapUser(r: PBUser): User {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    initials: r.initials ?? "",
    avatarColor: r.avatarColor ?? "#94a3b8",
    role: (r.role ?? "Viewer") as Role,
    weeklyCapacity: r.weeklyCapacity ?? 40,
  };
}

export function mapEpic(r: PBEpic): Epic {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    status: (r.status ?? "Not Started") as EpicStatus,
    startDate: r.start_date ? r.start_date.split(" ")[0] : undefined,
    endDate: r.end_date ? r.end_date.split(" ")[0] : undefined,
    owner: r.expand?.owner ? mapUser(r.expand.owner) : placeholderUser(r.owner),
    // Use ensureArray because PB may return a single string (maxSelect=0/1)
    // or an array depending on field schema and number of related records.
    watchers: ensureArray(r.expand?.watchers).map(mapUser),
  };
}

export function mapTask(
  r: PBTask,
  subtasks: Subtask[],
  comments: Comment[],
): Task {
  return {
    id: r.id,
    epicId: r.epic,
    title: r.title,
    description: r.description ?? "",
    status: (r.status ?? "To Do") as TaskStatus,
    priority: (r.priority ?? "Medium") as Priority,
    dueDate: r.due_date ? r.due_date.split(" ")[0] : "",
    estimate: r.estimate ?? undefined,
    owner: r.expand?.owner ? mapUser(r.expand.owner) : undefined,
    assignee: r.expand?.assignee ? mapUser(r.expand.assignee) : null,
    watchers: ensureArray(r.expand?.watchers).map(mapUser),
    subtasks,
    comments,
  };
}

export function mapSubtask(r: PBSubtask): Subtask {
  return {
    id: r.id,
    taskId: r.task,
    title: r.title,
    done: r.done ?? false,
    dueDate: r.due_date ? r.due_date.split(" ")[0] : undefined,
    status: (r.status || undefined) as TaskStatus | undefined,
    assignee: r.expand?.assignee ? mapUser(r.expand.assignee) : undefined,
  };
}

export function mapComment(r: PBComment): Comment {
  return {
    id: r.id,
    taskId: r.task,
    text: r.text,
    createdAt: pbDate(r.created),
    author: r.expand?.author
      ? mapUser(r.expand.author)
      : placeholderUser(r.author),
    mentions: ensureArray(r.expand?.mentions).map((u) => u.id),
  };
}

export function mapEpicDoc(r: PBEpicDoc): EpicDoc {
  return {
    id: r.id,
    epicId: r.epic,
    title: r.title,
    content: r.content,
    createdBy: r.expand?.created_by
      ? mapUser(r.expand.created_by)
      : placeholderUser(r.created_by),
    createdAt: pbDate(r.created),
    updatedAt: pbDate(r.updated),
  };
}

export function mapGoalKpi(r: PBGoalKpi): GoalKpi {
  return {
    id: r.id,
    label: r.label,
    target: r.target,
    current: r.current ?? 0,
    unit: r.unit,
    greenThreshold: r.green_threshold,
    yellowThreshold: r.yellow_threshold,
  };
}

export function mapGoal(r: PBGoal, kpis: GoalKpi[]): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    owner: r.expand?.owner ? mapUser(r.expand.owner) : placeholderUser(r.owner),
    kpis,
    linkedEpicIds: ensureArray(r.linked_epics).filter(Boolean),
  };
}
