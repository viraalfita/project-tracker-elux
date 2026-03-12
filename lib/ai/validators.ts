/**
 * Server-side validators for AI command execution.
 *
 * These run BEFORE any DB write to prevent bad data from reaching PocketBase.
 */

import { PBUser } from "@/lib/pb-types";
import { EpicStatus, GoalStatus, Priority, TaskStatus } from "@/lib/types";

export interface ResolvedUser {
  id: string;
  name: string;
}

export type UserResolution =
  | { ok: true; user: ResolvedUser }
  | { ok: false; ambiguous: ResolvedUser[] }
  | { ok: false; notFound: true };

/** Case-insensitive substring match on user name. Exact match wins over partial. */
export function resolveUserByName(
  name: string,
  users: PBUser[],
): UserResolution {
  const lower = name.toLowerCase().trim();

  const partialMatches = users.filter((u) =>
    u.name.toLowerCase().includes(lower),
  );

  if (partialMatches.length === 0) {
    return { ok: false, notFound: true };
  }

  // Exact match (case-insensitive) takes precedence
  const exact = partialMatches.find((u) => u.name.toLowerCase() === lower);
  if (exact) {
    return { ok: true, user: { id: exact.id, name: exact.name } };
  }

  if (partialMatches.length === 1) {
    return {
      ok: true,
      user: { id: partialMatches[0].id, name: partialMatches[0].name },
    };
  }

  // Multiple partial matches and no exact → ambiguous
  return {
    ok: false,
    ambiguous: partialMatches.map((u) => ({ id: u.id, name: u.name })),
  };
}

export interface ResolvedEntity {
  id: string;
  title: string;
}

export type EntityResolution =
  | { ok: true; entity: ResolvedEntity }
  | { ok: false; notFound: true }
  | { ok: false; ambiguous: ResolvedEntity[] };

/**
 * Case-insensitive substring match on entity title (epics, tasks, subtasks, goals).
 * Exact match wins over partial.
 */
export function resolveEntityByTitle(
  name: string,
  entities: Array<{ id: string; title: string }>,
): EntityResolution {
  const lower = name.toLowerCase().trim();

  const partials = entities.filter((e) =>
    e.title.toLowerCase().includes(lower),
  );

  if (partials.length === 0) return { ok: false, notFound: true };

  const exact = partials.find((e) => e.title.toLowerCase() === lower);
  if (exact) return { ok: true, entity: { id: exact.id, title: exact.title } };

  if (partials.length === 1)
    return {
      ok: true,
      entity: { id: partials[0].id, title: partials[0].title },
    };

  return {
    ok: false,
    ambiguous: partials.map((e) => ({ id: e.id, title: e.title })),
  };
}

// ── Status / value normalizers ──────────────────────────────────────────────────

const EPIC_STATUS_MAP: Record<string, EpicStatus> = {
  "not started": "Not Started",
  belum: "Not Started",
  "in progress": "In Progress",
  berjalan: "In Progress",
  done: "Done",
  selesai: "Done",
  "on hold": "On Hold",
  tahan: "On Hold",
  ditahan: "On Hold",
};

export function normalizeEpicStatus(raw: string | null): EpicStatus {
  if (!raw) return "Not Started";
  const lower = raw.toLowerCase().trim();

  for (const [key, value] of Object.entries(EPIC_STATUS_MAP)) {
    if (lower.includes(key)) return value;
  }

  const validStatuses: EpicStatus[] = [
    "Not Started",
    "In Progress",
    "Done",
    "On Hold",
  ];
  const exact = validStatuses.find((s) => s.toLowerCase() === lower);
  return exact ?? "Not Started";
}

const TASK_STATUS_MAP: Record<string, TaskStatus> = {
  "to do": "To Do",
  todo: "To Do",
  belum: "To Do",
  "in progress": "In Progress",
  berjalan: "In Progress",
  review: "Review",
  tinjauan: "Review",
  done: "Done",
  selesai: "Done",
};

export function normalizeTaskStatus(raw: string | null): TaskStatus {
  if (!raw) return "To Do";
  const lower = raw.toLowerCase().trim();

  for (const [key, value] of Object.entries(TASK_STATUS_MAP)) {
    if (lower.includes(key)) return value;
  }

  const validStatuses: TaskStatus[] = [
    "To Do",
    "In Progress",
    "Review",
    "Done",
  ];
  const exact = validStatuses.find((s) => s.toLowerCase() === lower);
  return exact ?? "To Do";
}

const PRIORITY_MAP: Record<string, Priority> = {
  low: "Low",
  rendah: "Low",
  medium: "Medium",
  sedang: "Medium",
  high: "High",
  tinggi: "High",
};

export function normalizePriority(raw: string | null): Priority {
  if (!raw) return "Medium";
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(PRIORITY_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "Medium";
}

const GOAL_STATUS_MAP: Record<string, GoalStatus> = {
  "on track": "On Track",
  baik: "On Track",
  aman: "On Track",
  "at risk": "At Risk",
  risiko: "At Risk",
  berisiko: "At Risk",
  completed: "Completed",
  selesai: "Completed",
  done: "Completed",
};

export function normalizeGoalStatus(raw: string | null): GoalStatus {
  if (!raw) return "On Track";
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(GOAL_STATUS_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "On Track";
}
