/**
 * DB executor for AI commands.
 *
 * This is the ONLY module that writes to PocketBase.
 * It is called only after server-side validation has fully resolved all field values.
 */

import {
  normalizeEpicStatus,
  normalizePriority,
  normalizeTaskStatus,
} from "@/lib/ai/validators";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

async function getSuperuserClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

export interface ExecuteResult {
  success: boolean;
  id?: string;
  title?: string;
  taskIds?: string[];
  error?: string;
}

// ── Epic operations ───────────────────────────────────────────────────────────

export async function executeCreateEpic(
  epic: {
    title: string | null;
    owner: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
    members: string[];
    description?: string | null;
  },
  resolvedOwnerId: string,
  resolvedMemberIds: string[],
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("epics").create({
      title: epic.title,
      description: epic.description ?? "",
      status: normalizeEpicStatus(epic.status),
      start_date: epic.start_date ? `${epic.start_date} 00:00:00.000Z` : null,
      end_date: epic.end_date ? `${epic.end_date} 00:00:00.000Z` : null,
      owner: resolvedOwnerId,
      watchers: resolvedMemberIds,
    });
    return { success: true, id: record.id, title: String(epic.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeCreateEpicWithTasks(
  epic: {
    title: string | null;
    owner: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
    members: string[];
    description?: string | null;
  },
  tasks: Array<{
    title: string;
    assignee: string | null;
    status: string | null;
    due_date: string | null;
    priority?: string | null;
  }>,
  resolvedOwnerId: string,
  resolvedMemberIds: string[],
  resolvedAssigneeMap: Map<string, string>,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();

    const epicRecord = await pb.collection("epics").create({
      title: epic.title,
      description: epic.description ?? "",
      status: normalizeEpicStatus(epic.status),
      start_date: epic.start_date ? `${epic.start_date} 00:00:00.000Z` : null,
      end_date: epic.end_date ? `${epic.end_date} 00:00:00.000Z` : null,
      owner: resolvedOwnerId,
      watchers: resolvedMemberIds,
    });

    const taskIds: string[] = [];
    for (const task of tasks) {
      const assigneeId = resolvedAssigneeMap.get(task.title) ?? null;
      const taskRecord = await pb.collection("tasks").create({
        title: task.title,
        description: "",
        status: normalizeTaskStatus(task.status),
        priority: normalizePriority(task.priority ?? null),
        epic: epicRecord.id,
        assignee: assigneeId,
        owner: assigneeId,
        due_date: task.due_date ? `${task.due_date} 00:00:00.000Z` : null,
        order: taskIds.length,
      });
      taskIds.push(taskRecord.id);
    }

    return {
      success: true,
      id: epicRecord.id,
      title: String(epic.title),
      taskIds,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeUpdateEpic(
  epicId: string,
  updates: {
    title?: string | null;
    owner?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: string | null;
    members?: string[] | null;
    description?: string | null;
  },
  resolvedOwnerId?: string,
  resolvedMemberIds?: string[],
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const data: Record<string, unknown> = {};
    if (updates.title != null) data.title = updates.title;
    if (updates.description != null) data.description = updates.description;
    if (updates.status != null)
      data.status = normalizeEpicStatus(updates.status);
    if (updates.start_date != null)
      data.start_date = `${updates.start_date} 00:00:00.000Z`;
    if (updates.end_date != null)
      data.end_date = `${updates.end_date} 00:00:00.000Z`;
    if (resolvedOwnerId != null) data.owner = resolvedOwnerId;
    if (resolvedMemberIds != null) data.watchers = resolvedMemberIds;
    const record = await pb.collection("epics").update(epicId, data);
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeDeleteEpic(
  epicId: string,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    await pb.collection("epics").delete(epicId);
    return { success: true, id: epicId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── Task operations ───────────────────────────────────────────────────────────

export async function executeCreateTask(
  epicId: string,
  task: {
    title: string;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
    description?: string | null;
  },
  assigneeId?: string | null,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("tasks").create({
      title: task.title,
      description: task.description ?? "",
      status: normalizeTaskStatus(task.status ?? null),
      priority: normalizePriority(task.priority ?? null),
      epic: epicId,
      assignee: assigneeId ?? null,
      owner: assigneeId ?? null,
      due_date: task.due_date ? `${task.due_date} 00:00:00.000Z` : null,
      order: 0,
    });
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeUpdateTask(
  taskId: string,
  updates: {
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
    description?: string | null;
  },
  assigneeId?: string | null,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const data: Record<string, unknown> = {};
    if (updates.title != null) data.title = updates.title;
    if (updates.description != null) data.description = updates.description;
    if (updates.status != null)
      data.status = normalizeTaskStatus(updates.status);
    if (updates.priority != null)
      data.priority = normalizePriority(updates.priority);
    if (updates.due_date != null)
      data.due_date = `${updates.due_date} 00:00:00.000Z`;
    if (assigneeId !== undefined) {
      data.assignee = assigneeId;
      data.owner = assigneeId;
    }
    const record = await pb.collection("tasks").update(taskId, data);
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeDeleteTask(
  taskId: string,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    await pb.collection("tasks").delete(taskId);
    return { success: true, id: taskId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── Subtask operations ─────────────────────────────────────────────────────

export async function executeCreateSubtask(
  taskId: string,
  subtask: { title: string; due_date?: string | null },
  assigneeId?: string | null,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("subtasks").create({
      title: subtask.title,
      done: false,
      task: taskId,
      assignee: assigneeId ?? null,
      due_date: subtask.due_date ? `${subtask.due_date} 00:00:00.000Z` : null,
      status: "To Do",
    });
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeUpdateSubtask(
  subtaskId: string,
  updates: {
    title?: string | null;
    done?: boolean | null;
    due_date?: string | null;
  },
  assigneeId?: string | null,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const data: Record<string, unknown> = {};
    if (updates.title != null) data.title = updates.title;
    if (updates.done != null) data.done = updates.done;
    if (updates.due_date != null)
      data.due_date = `${updates.due_date} 00:00:00.000Z`;
    if (assigneeId !== undefined) data.assignee = assigneeId;
    const record = await pb.collection("subtasks").update(subtaskId, data);
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeDeleteSubtask(
  subtaskId: string,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    await pb.collection("subtasks").delete(subtaskId);
    return { success: true, id: subtaskId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── Goal operations ────────────────────────────────────────────────────────────

export interface KpiInput {
  label: string;
  target: number;
  unit?: string | null;
}

export async function executeCreateGoal(
  goal: { title: string; description?: string | null },
  ownerId: string,
  kpis?: KpiInput[],
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("goals").create({
      title: goal.title,
      description: goal.description ?? "",
      owner: ownerId,
      linked_epics: [],
    });
    if (kpis && kpis.length > 0) {
      for (const kpi of kpis) {
        await pb.collection("goal_kpis").create({
          label: kpi.label,
          target: kpi.target,
          current: 0,
          unit: kpi.unit ?? "",
          green_threshold: 80,
          yellow_threshold: 50,
          goal: record.id,
        });
      }
    }
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeUpdateGoal(
  goalId: string,
  updates: { title?: string | null; description?: string | null },
  resolvedOwnerId?: string,
  kpisToAdd?: KpiInput[],
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const data: Record<string, unknown> = {};
    if (updates.title != null) data.title = updates.title;
    if (updates.description != null) data.description = updates.description;
    if (resolvedOwnerId != null) data.owner = resolvedOwnerId;
    const record = await pb.collection("goals").update(goalId, data);
    if (kpisToAdd && kpisToAdd.length > 0) {
      for (const kpi of kpisToAdd) {
        await pb.collection("goal_kpis").create({
          label: kpi.label,
          target: kpi.target,
          current: 0,
          unit: kpi.unit ?? "",
          green_threshold: 80,
          yellow_threshold: 50,
          goal: goalId,
        });
      }
    }
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeDeleteGoal(
  goalId: string,
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    await pb.collection("goals").delete(goalId);
    return { success: true, id: goalId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── Linking ──────────────────────────────────────────────────────────────────

/** Appends epicIds to the goal's linked_epics list (deduped). */
export async function executeLinkEpicsToGoal(
  goalId: string,
  epicIds: string[],
): Promise<ExecuteResult> {
  try {
    const pb = await getSuperuserClient();
    const goal = await pb.collection("goals").getOne(goalId);
    const existing: string[] = Array.isArray(goal.linked_epics)
      ? (goal.linked_epics as string[])
      : goal.linked_epics
        ? [goal.linked_epics as string]
        : [];
    const merged = [...new Set([...existing, ...epicIds])];
    const record = await pb
      .collection("goals")
      .update(goalId, { linked_epics: merged });
    return { success: true, id: record.id, title: String(record.title) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
