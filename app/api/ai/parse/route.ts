/**
 * POST /api/ai/parse
 *
 * Accepts a natural-language command from an authenticated user and returns
 * either a follow-up question (when required fields are still missing) or
 * creates the requested resources in PocketBase and confirms success.
 *
 * Security guarantees:
 * - The LLM is a PARSER ONLY — it never writes to the database.
 * - Draft state is stored server-side; the LLM has no memory between calls.
 * - All user/member names are resolved to IDs server-side before any DB write.
 * - Ambiguous name matches trigger a clarification request instead of guessing.
 */

import {
  AiProviderRateLimit,
  INTENT_REQUIRED_FIELDS,
  LLMProviderError,
  detectIntent,
  parseForIntent,
  SUPPORTED_INTENTS,
} from "@/lib/ai/deepseek-client";
import { clearDraft, getDraft, saveDraft } from "@/lib/ai/draft-store";
import {
  executeCreateEpic,
  executeCreateEpicWithTasks,
  executeCreateGoal,
  executeCreateSubtask,
  executeCreateTask,
  executeDeleteEpic,
  executeDeleteGoal,
  executeDeleteSubtask,
  executeDeleteTask,
  executeLinkEpicsToGoal,
  executeUpdateEpic,
  executeUpdateGoal,
  executeUpdateSubtask,
  executeUpdateTask,
  KpiInput,
} from "@/lib/ai/executor";
import { resolveEntityByTitle, resolveUserByName } from "@/lib/ai/validators";
import {
  PBEpic,
  PBGoal,
  PBGoalKpi,
  PBSubtask,
  PBTask,
  PBUser,
} from "@/lib/pb-types";
import { NextRequest, NextResponse } from "next/server";
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

async function getAuthenticatedUserId(token: string): Promise<string | null> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);
    const result = await pb.collection("users").authRefresh();
    return result.record?.id ?? null;
  } catch {
    return null;
  }
}

function extractToken(req: NextRequest): string {
  return req.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

/** Deep-merge incoming payload on top of existing, keeping non-null values. */
function mergePayload(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) merged[key] = value;
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

/** Human-readable intent label for UI display. */
const INTENT_LABELS: Record<string, string> = {
  create_epic: "Buat Epic",
  create_epic_with_tasks: "Buat Epic + Task",
  update_epic: "Edit Epic",
  delete_epic: "Hapus Epic",
  create_task: "Buat Task",
  update_task: "Edit Task",
  delete_task: "Hapus Task",
  create_subtask: "Buat Subtask",
  update_subtask: "Edit Subtask",
  delete_subtask: "Hapus Subtask",
  create_goal: "Buat Goal",
  update_goal: "Edit Goal",
  delete_goal: "Hapus Goal",
  link_epic_to_goal: "Hubungkan Epic ke Goal",
  query_epic: "Info Epic",
  query_task: "Info Task",
  query_goal: "Info Goal",
  query_subtask: "Info Subtask",
  query_member_work: "Info Pekerjaan Member",
};

const AUTO_EXECUTE_CREATE_INTENTS = new Set([
  "create_epic",
  "create_epic_with_tasks",
  "create_task",
  "create_subtask",
  "create_goal",
]);

const TITLE_ONLY_CREATE_INTENTS = new Set([
  "create_epic",
  "create_epic_with_tasks",
  "create_goal",
]);

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const token = extractToken(request);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getAuthenticatedUserId(token);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Input ───────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const { message, confirm, cancel, preselected_intent } = body as {
    message?: unknown;
    confirm?: boolean;
    cancel?: boolean;
    preselected_intent?: string;
  };

  // ── Cancel ───────────────────────────────────────────────────────────────
  if (cancel) {
    clearDraft(userId);
    return NextResponse.json({
      reply: "Perintah dibatalkan. Ketik perintah baru kapan saja.",
      status: "cancelled",
    });
  }

  // ── Confirm: execute DB writes ───────────────────────────────────────────
  if (confirm) {
    const readyDraft = getDraft(userId);
    if (
      !readyDraft ||
      readyDraft.status !== "ready" ||
      !readyDraft.draftJson.resolved
    ) {
      return NextResponse.json({
        reply:
          "Tidak ada perintah yang menunggu konfirmasi. Silakan ketik perintah baru.",
        status: "error",
      });
    }

    const { payload: p, resolved } = readyDraft.draftJson;
    const intent = readyDraft.intent;
    let result;
    let successMsg = "Berhasil!";

    try {
      switch (intent) {
        case "create_epic": {
          result = await executeCreateEpic(
            {
              title: p.title as string,
              owner: p.owner as string,
              start_date: (p.start_date as string) ?? null,
              end_date: (p.end_date as string) ?? null,
              status: (p.status as string) ?? null,
              members: (p.members as string[]) ?? [],
              description: (p.description as string) ?? null,
            },
            resolved.owner_id!,
            resolved.member_ids ?? [],
          );
          successMsg = `Epic "${result.title}" berhasil dibuat! 🎉`;
          break;
        }

        case "create_epic_with_tasks": {
          const tasks = ((p.tasks as unknown[]) ?? []) as Array<{
            title: string;
            assignee: string | null;
            status: string | null;
            due_date: string | null;
            priority: string | null;
          }>;
          result = await executeCreateEpicWithTasks(
            {
              title: p.title as string,
              owner: p.owner as string,
              start_date: (p.start_date as string) ?? null,
              end_date: (p.end_date as string) ?? null,
              status: (p.status as string) ?? null,
              members: (p.members as string[]) ?? [],
              description: (p.description as string) ?? null,
            },
            tasks,
            resolved.owner_id!,
            resolved.member_ids ?? [],
            new Map(Object.entries(resolved.assignee_map ?? {})),
          );
          const tc = result.taskIds?.length ?? 0;
          successMsg = `Epic "${result.title}" beserta ${tc} task berhasil dibuat! 🎉`;
          break;
        }

        case "update_epic": {
          result = await executeUpdateEpic(
            resolved.epic_id!,
            {
              title: (p.title as string) ?? null,
              owner: (p.owner as string) ?? null,
              start_date: (p.start_date as string) ?? null,
              end_date: (p.end_date as string) ?? null,
              status: (p.status as string) ?? null,
              members: (p.members as string[]) ?? null,
              description: (p.description as string) ?? null,
            },
            resolved.owner_id,
            resolved.member_ids,
          );
          successMsg = `Epic "${result.title}" berhasil diperbarui!`;
          break;
        }

        case "delete_epic": {
          result = await executeDeleteEpic(resolved.epic_id!);
          successMsg = `Epic berhasil dihapus!`;
          break;
        }

        case "create_task": {
          result = await executeCreateTask(
            resolved.epic_id!,
            {
              title: p.title as string,
              status: (p.status as string) ?? null,
              priority: (p.priority as string) ?? null,
              due_date: (p.due_date as string) ?? null,
              description: (p.description as string) ?? null,
            },
            resolved.assignee_id ?? null,
          );
          successMsg = `Task "${result.title}" berhasil dibuat!`;
          break;
        }

        case "update_task": {
          result = await executeUpdateTask(
            resolved.task_id!,
            {
              title: (p.title as string) ?? null,
              status: (p.status as string) ?? null,
              priority: (p.priority as string) ?? null,
              due_date: (p.due_date as string) ?? null,
              description: (p.description as string) ?? null,
            },
            resolved.assignee_id,
          );
          successMsg = `Task "${result.title}" berhasil diperbarui!`;
          break;
        }

        case "delete_task": {
          result = await executeDeleteTask(resolved.task_id!);
          successMsg = `Task berhasil dihapus!`;
          break;
        }

        case "create_subtask": {
          result = await executeCreateSubtask(
            resolved.task_id!,
            {
              title: p.title as string,
              due_date: (p.due_date as string) ?? null,
            },
            resolved.assignee_id ?? null,
          );
          successMsg = `Subtask "${result.title}" berhasil dibuat!`;
          break;
        }

        case "update_subtask": {
          result = await executeUpdateSubtask(
            resolved.subtask_id!,
            {
              title: (p.title as string) ?? null,
              done: (p.done as boolean) ?? null,
              due_date: (p.due_date as string) ?? null,
            },
            resolved.assignee_id,
          );
          successMsg = `Subtask "${result.title}" berhasil diperbarui!`;
          break;
        }

        case "delete_subtask": {
          result = await executeDeleteSubtask(resolved.subtask_id!);
          successMsg = `Subtask berhasil dihapus!`;
          break;
        }

        case "create_goal": {
          const kpis = ((p.kpis as KpiInput[]) ?? []).filter(
            (k) => k?.label && k?.target != null,
          );
          result = await executeCreateGoal(
            {
              title: p.title as string,
              description: (p.description as string) ?? null,
            },
            resolved.owner_id!,
            kpis,
          );
          const kpiMsg = kpis.length > 0 ? ` dengan ${kpis.length} KPI` : "";
          successMsg = `Goal "${result.title}"${kpiMsg} berhasil dibuat!`;
          break;
        }

        case "update_goal": {
          const kpisToAdd = ((p.kpis as KpiInput[]) ?? []).filter(
            (k) => k?.label && k?.target != null,
          );
          result = await executeUpdateGoal(
            resolved.goal_id!,
            {
              title: (p.title as string) ?? null,
              description: (p.description as string) ?? null,
            },
            resolved.owner_id,
            kpisToAdd,
          );
          const addedMsg =
            kpisToAdd.length > 0
              ? ` dan menambahkan ${kpisToAdd.length} KPI`
              : "";
          successMsg = `Goal "${result.title}"${addedMsg} berhasil diperbarui!`;
          break;
        }

        case "delete_goal": {
          result = await executeDeleteGoal(resolved.goal_id!);
          successMsg = `Goal berhasil dihapus!`;
          break;
        }

        case "link_epic_to_goal": {
          result = await executeLinkEpicsToGoal(
            resolved.goal_id!,
            resolved.linked_epic_ids ?? [],
          );
          const epicNames = (p.epic_names as string[]) ?? [];
          successMsg = `${epicNames.length} epic berhasil dihubungkan ke goal "${result.title}"!`;
          break;
        }

        default:
          clearDraft(userId);
          return NextResponse.json({
            reply: "Intent tidak dikenal. Silakan mulai perintah baru.",
            status: "error",
          });
      }
    } catch (err) {
      clearDraft(userId);
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[AI executor] Unexpected error:", msg);
      return NextResponse.json({
        reply: `Terjadi kesalahan: ${msg}`,
        status: "error",
      });
    }

    clearDraft(userId);

    if (!result.success) {
      console.error("[AI executor] DB write failed:", result.error);
      return NextResponse.json({
        reply: `Gagal: ${result.error}`,
        status: "error",
      });
    }

    return NextResponse.json({ reply: successMsg, status: "success" });
  }

  // ── Validate message ─────────────────────────────────────────────────────
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "Field 'message' is required" },
      { status: 400 },
    );
  }
  const userText = message.trim();

  // ── Determine intent ─────────────────────────────────────────────────────
  const existingDraft = getDraft(userId);

  const lockedIntent = existingDraft?.intent ?? null;
  let selectedIntent =
    lockedIntent ??
    (preselected_intent && SUPPORTED_INTENTS.has(preselected_intent)
      ? preselected_intent
      : null);

  if (!selectedIntent) {
    const safeMessage = typeof message === "string" ? message : "";
    const { intent: detected } = await detectIntent(safeMessage);
    if (!detected) {
      return NextResponse.json({
        reply:
          "Perintah tidak dikenali. Coba lebih spesifik, misalnya: \"buatkan epic Project X, owner vira\" atau \"hapus task Design Mockup\".",
        status: "unknown",
      });
    }
    selectedIntent = detected;
  }

  // ── LLM Parse ────────────────────────────────────────────────────────────
  let parsed;
  let rateLimit: AiProviderRateLimit | null = null;
  try {
    const parseResult = await parseForIntent(
      selectedIntent,
      userText,
      existingDraft?.draftJson.payload,
    );
    parsed = parseResult.parsed;
    rateLimit = parseResult.rateLimit;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown LLM error";
    console.error("[AI parse] LLM call failed:", msg);

    if (err instanceof LLMProviderError && err.statusCode === 429) {
      return NextResponse.json(
        {
          reply:
            "Model AI sedang penuh (rate limit). Coba lagi beberapa detik lagi.",
          status: "rate_limited",
          ...(process.env.NODE_ENV !== "production"
            ? { debug_error: msg, provider: err.provider, model: err.model }
            : {}),
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        reply:
          "Maaf, ada masalah saat memproses perintahmu. Coba lagi sebentar lagi.",
        status: "error",
        ...(process.env.NODE_ENV !== "production" ? { debug_error: msg } : {}),
      },
      { status: 502 },
    );
  }

  function jsonWithRateLimit(body: Record<string, unknown>) {
    return NextResponse.json(
      rateLimit ? { ...body, rate_limit: rateLimit } : body,
    );
  }

  // ── Merge payload ────────────────────────────────────────────────────────
  const prevPayload = existingDraft?.draftJson.payload ?? {};
  let mergedPayload = mergePayload(prevPayload, parsed.payload ?? {});

  // For create_epic_with_tasks: prefer the longer tasks array
  if (selectedIntent === "create_epic_with_tasks") {
    const prevTasks = (prevPayload.tasks as unknown[]) ?? [];
    const newTasks = (parsed.payload?.tasks as unknown[]) ?? [];
    if (prevTasks.length > newTasks.length) {
      mergedPayload = { ...mergedPayload, tasks: prevTasks };
    }
  }

  // ── Missing fields check ─────────────────────────────────────────────────
  const requiredFields = TITLE_ONLY_CREATE_INTENTS.has(selectedIntent)
    ? ["title"]
    : (INTENT_REQUIRED_FIELDS[selectedIntent] ?? []);
  const blockingMissing = requiredFields.filter((f) => {
    const val = mergedPayload[f];
    if (val === null || val === undefined || val === "") return true;
    if (Array.isArray(val) && val.length === 0 && f === "epic_names")
      return true;
    return false;
  });

  if (blockingMissing.length > 0) {
    saveDraft(userId, {
      intent: selectedIntent,
      draftJson: { payload: mergedPayload, missing_fields: blockingMissing },
      status: "collecting_fields",
    });
    return jsonWithRateLimit({
      reply: parsed.reply_to_user,
      status: "collecting_fields",
      missing_fields: blockingMissing,
    });
  }

  // ── All fields present → resolve names to PocketBase IDs ─────────────────
  let pb: PocketBase;
  try {
    pb = await getSuperuserClient();
  } catch {
    return NextResponse.json(
      { reply: "Gagal terhubung ke database. Coba lagi.", status: "error" },
      { status: 500 },
    );
  }

  const allUsers = await pb.collection("users").getFullList<PBUser>();

  function tryResolveUser(
    name: string,
    fieldLabel: string,
  ): { ok: true; id: string; displayName: string } | NextResponse {
    const res = resolveUserByName(name, allUsers);
    if (!res.ok) {
      if ("notFound" in res) {
        return NextResponse.json({
          reply: `Pengguna "${name}" untuk ${fieldLabel} tidak ditemukan.`,
          status: "collecting_fields",
          missing_fields: [fieldLabel],
        });
      }
      const names = res.ambiguous.map((u) => u.name).join(", ");
      return NextResponse.json({
        reply: `Nama "${name}" cocok dengan beberapa pengguna: ${names}. Sebutkan nama lengkapnya.`,
        status: "collecting_fields",
        missing_fields: [fieldLabel],
      });
    }
    return { ok: true, id: res.user.id, displayName: res.user.name };
  }

  function tryResolveEntity(
    name: string,
    entities: Array<{ id: string; title: string }>,
    fieldLabel: string,
  ): { ok: true; id: string; displayTitle: string } | NextResponse {
    const res = resolveEntityByTitle(name, entities);
    if (!res.ok) {
      if ("notFound" in res) {
        return NextResponse.json({
          reply: `"${name}" tidak ditemukan. Pastikan nama sudah benar.`,
          status: "collecting_fields",
          missing_fields: [fieldLabel],
        });
      }
      const titles = res.ambiguous.map((e) => e.title).join(", ");
      return NextResponse.json({
        reply: `"${name}" cocok dengan beberapa: ${titles}. Sebutkan nama lengkapnya.`,
        status: "collecting_fields",
        missing_fields: [fieldLabel],
      });
    }
    return { ok: true, id: res.entity.id, displayTitle: res.entity.title };
  }

  // ── Per-intent resolution ────────────────────────────────────────────────
  const resolved: {
    owner_id?: string;
    assignee_id?: string;
    member_ids?: string[];
    assignee_map?: Record<string, string>;
    epic_id?: string;
    task_id?: string;
    subtask_id?: string;
    goal_id?: string;
    linked_epic_ids?: string[];
  } = {};

  const summaryRows: Array<{ label: string; value: string }> = [];
  let isDangerous = false;

  function toTitleCase(str: string): string {
    return str
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  if (
    selectedIntent === "create_epic" ||
    selectedIntent === "create_epic_with_tasks"
  ) {
    const fallbackOwner = allUsers.find((u) => u.id === userId)?.name ?? null;
    const ownerName =
      (typeof mergedPayload.owner === "string" &&
      mergedPayload.owner.trim().length > 0
        ? mergedPayload.owner
        : fallbackOwner) ?? null;
    if (!ownerName) {
      return NextResponse.json({
        reply: "Owner tidak ditemukan. Silakan isi owner secara eksplisit.",
        status: "collecting_fields",
        missing_fields: ["owner"],
      });
    }

    mergedPayload.owner = ownerName;
    const ownerRes = tryResolveUser(ownerName, "owner");
    if (ownerRes instanceof NextResponse) return ownerRes;
    resolved.owner_id = ownerRes.id;

    summaryRows.push({ label: "Judul", value: String(mergedPayload.title) });
    summaryRows.push({ label: "Owner", value: ownerRes.displayName });
    summaryRows.push({
      label: "Status",
      value: String(mergedPayload.status ?? "Not Started"),
    });
    if (mergedPayload.start_date)
      summaryRows.push({
        label: "Mulai",
        value: String(mergedPayload.start_date),
      });
    if (mergedPayload.end_date)
      summaryRows.push({
        label: "Selesai",
        value: String(mergedPayload.end_date),
      });

    const memberNames = (mergedPayload.members as string[]) ?? [];
    const mIds: string[] = [];
    const mNames: string[] = [];
    for (const mName of memberNames) {
      const mRes = tryResolveUser(mName, "members");
      if (mRes instanceof NextResponse) return mRes;
      if (!mIds.includes(mRes.id)) {
        mIds.push(mRes.id);
        mNames.push(mRes.displayName);
      }
    }
    resolved.member_ids = mIds;
    if (mNames.length > 0)
      summaryRows.push({ label: "Members", value: mNames.join(", ") });

    if (selectedIntent === "create_epic_with_tasks") {
      const tasks = ((mergedPayload.tasks as unknown[]) ?? []) as Array<{
        title: string;
        assignee: string | null;
      }>;
      const aMap: Record<string, string> = {};
      const taskLines: string[] = [];
      for (const task of tasks) {
        let displayA = "";
        if (task.assignee) {
          const aRes = tryResolveUser(task.assignee, "tasks.assignee");
          if (aRes instanceof NextResponse) return aRes;
          aMap[task.title] = aRes.id;
          displayA = ` → ${aRes.displayName}`;
        }
        taskLines.push(`${task.title}${displayA}`);
      }
      resolved.assignee_map = aMap;
      if (taskLines.length > 0)
        summaryRows.push({ label: "Tasks", value: taskLines.join(" | ") });
    }
  } else if (selectedIntent === "update_epic") {
    const allEpics = await pb.collection("epics").getFullList<PBEpic>();
    const epicRes = tryResolveEntity(
      mergedPayload.target as string,
      allEpics,
      "target",
    );
    if (epicRes instanceof NextResponse) return epicRes;
    resolved.epic_id = epicRes.id;

    summaryRows.push({ label: "Epic", value: epicRes.displayTitle });
    if (mergedPayload.title)
      summaryRows.push({
        label: "Judul baru",
        value: String(mergedPayload.title),
      });
    if (mergedPayload.status)
      summaryRows.push({
        label: "Status baru",
        value: String(mergedPayload.status),
      });
    if (mergedPayload.start_date)
      summaryRows.push({
        label: "Mulai baru",
        value: String(mergedPayload.start_date),
      });
    if (mergedPayload.end_date)
      summaryRows.push({
        label: "Selesai baru",
        value: String(mergedPayload.end_date),
      });
    if (mergedPayload.owner) {
      const oRes = tryResolveUser(mergedPayload.owner as string, "owner");
      if (oRes instanceof NextResponse) return oRes;
      resolved.owner_id = oRes.id;
      summaryRows.push({ label: "Owner baru", value: oRes.displayName });
    }
    const newMembers = mergedPayload.members as string[] | null;
    if (Array.isArray(newMembers)) {
      const mIds: string[] = [];
      const mNames: string[] = [];
      for (const mName of newMembers) {
        const mRes = tryResolveUser(mName, "members");
        if (mRes instanceof NextResponse) return mRes;
        if (!mIds.includes(mRes.id)) {
          mIds.push(mRes.id);
          mNames.push(mRes.displayName);
        }
      }
      resolved.member_ids = mIds;
      summaryRows.push({
        label: "Members baru",
        value: mNames.length > 0 ? mNames.join(", ") : "(kosongkan)",
      });
    }
  } else if (selectedIntent === "delete_epic") {
    const allEpics = await pb.collection("epics").getFullList<PBEpic>();
    const epicRes = tryResolveEntity(
      mergedPayload.target as string,
      allEpics,
      "target",
    );
    if (epicRes instanceof NextResponse) return epicRes;
    resolved.epic_id = epicRes.id;
    summaryRows.push({ label: "Epic", value: epicRes.displayTitle });
    isDangerous = true;
  } else if (selectedIntent === "create_task") {
    const allEpics = await pb.collection("epics").getFullList<PBEpic>();
    const epicRes = tryResolveEntity(
      mergedPayload.epic_name as string,
      allEpics,
      "epic_name",
    );
    if (epicRes instanceof NextResponse) return epicRes;
    resolved.epic_id = epicRes.id;

    summaryRows.push({ label: "Epic", value: epicRes.displayTitle });
    summaryRows.push({
      label: "Judul Task",
      value: String(mergedPayload.title),
    });
    if (mergedPayload.status)
      summaryRows.push({
        label: "Status",
        value: String(mergedPayload.status),
      });
    if (mergedPayload.priority)
      summaryRows.push({
        label: "Prioritas",
        value: String(mergedPayload.priority),
      });
    if (mergedPayload.due_date)
      summaryRows.push({
        label: "Deadline",
        value: String(mergedPayload.due_date),
      });
    if (mergedPayload.assignee) {
      const aRes = tryResolveUser(mergedPayload.assignee as string, "assignee");
      if (aRes instanceof NextResponse) return aRes;
      resolved.assignee_id = aRes.id;
      summaryRows.push({ label: "Assignee", value: aRes.displayName });
    }
  } else if (selectedIntent === "update_task") {
    const allTasks = await pb.collection("tasks").getFullList<PBTask>();
    const taskRes = tryResolveEntity(
      mergedPayload.target as string,
      allTasks,
      "target",
    );
    if (taskRes instanceof NextResponse) return taskRes;
    resolved.task_id = taskRes.id;

    summaryRows.push({ label: "Task", value: taskRes.displayTitle });
    if (mergedPayload.title)
      summaryRows.push({
        label: "Judul baru",
        value: String(mergedPayload.title),
      });
    if (mergedPayload.status)
      summaryRows.push({
        label: "Status baru",
        value: String(mergedPayload.status),
      });
    if (mergedPayload.priority)
      summaryRows.push({
        label: "Prioritas baru",
        value: String(mergedPayload.priority),
      });
    if (mergedPayload.due_date)
      summaryRows.push({
        label: "Deadline baru",
        value: String(mergedPayload.due_date),
      });
    if (mergedPayload.assignee) {
      const aRes = tryResolveUser(mergedPayload.assignee as string, "assignee");
      if (aRes instanceof NextResponse) return aRes;
      resolved.assignee_id = aRes.id;
      summaryRows.push({ label: "Assignee baru", value: aRes.displayName });
    }
  } else if (selectedIntent === "delete_task") {
    const allTasks = await pb.collection("tasks").getFullList<PBTask>();
    const taskRes = tryResolveEntity(
      mergedPayload.target as string,
      allTasks,
      "target",
    );
    if (taskRes instanceof NextResponse) return taskRes;
    resolved.task_id = taskRes.id;
    summaryRows.push({ label: "Task", value: taskRes.displayTitle });
    isDangerous = true;
  } else if (selectedIntent === "create_subtask") {
    const allTasks = await pb.collection("tasks").getFullList<PBTask>();
    const taskRes = tryResolveEntity(
      mergedPayload.task_name as string,
      allTasks,
      "task_name",
    );
    if (taskRes instanceof NextResponse) return taskRes;
    resolved.task_id = taskRes.id;

    summaryRows.push({ label: "Task", value: taskRes.displayTitle });
    summaryRows.push({
      label: "Judul Subtask",
      value: String(mergedPayload.title),
    });
    if (mergedPayload.due_date)
      summaryRows.push({
        label: "Deadline",
        value: String(mergedPayload.due_date),
      });
    if (mergedPayload.assignee) {
      const aRes = tryResolveUser(mergedPayload.assignee as string, "assignee");
      if (aRes instanceof NextResponse) return aRes;
      resolved.assignee_id = aRes.id;
      summaryRows.push({ label: "Assignee", value: aRes.displayName });
    }
  } else if (selectedIntent === "update_subtask") {
    const allSubtasks = await pb
      .collection("subtasks")
      .getFullList<PBSubtask>();
    let candidates = allSubtasks as Array<{ id: string; title: string }>;
    if (mergedPayload.task_name) {
      const allTasks = await pb.collection("tasks").getFullList<PBTask>();
      const tRes = tryResolveEntity(
        mergedPayload.task_name as string,
        allTasks,
        "task_name",
      );
      if (!(tRes instanceof NextResponse)) {
        candidates = allSubtasks.filter((s) => s.task === tRes.id);
      }
    }
    const subRes = tryResolveEntity(
      mergedPayload.target as string,
      candidates,
      "target",
    );
    if (subRes instanceof NextResponse) return subRes;
    resolved.subtask_id = subRes.id;

    summaryRows.push({ label: "Subtask", value: subRes.displayTitle });
    if (mergedPayload.title)
      summaryRows.push({
        label: "Judul baru",
        value: String(mergedPayload.title),
      });
    if (mergedPayload.done != null)
      summaryRows.push({
        label: "Selesai",
        value: mergedPayload.done ? "Ya" : "Tidak",
      });
    if (mergedPayload.due_date)
      summaryRows.push({
        label: "Deadline baru",
        value: String(mergedPayload.due_date),
      });
    if (mergedPayload.assignee) {
      const aRes = tryResolveUser(mergedPayload.assignee as string, "assignee");
      if (aRes instanceof NextResponse) return aRes;
      resolved.assignee_id = aRes.id;
      summaryRows.push({ label: "Assignee baru", value: aRes.displayName });
    }
  } else if (selectedIntent === "delete_subtask") {
    const allSubtasks = await pb
      .collection("subtasks")
      .getFullList<PBSubtask>();
    let candidates = allSubtasks as Array<{ id: string; title: string }>;
    if (mergedPayload.task_name) {
      const allTasks = await pb.collection("tasks").getFullList<PBTask>();
      const tRes = tryResolveEntity(
        mergedPayload.task_name as string,
        allTasks,
        "task_name",
      );
      if (!(tRes instanceof NextResponse)) {
        candidates = allSubtasks.filter((s) => s.task === tRes.id);
      }
    }
    const subRes = tryResolveEntity(
      mergedPayload.target as string,
      candidates,
      "target",
    );
    if (subRes instanceof NextResponse) return subRes;
    resolved.subtask_id = subRes.id;
    summaryRows.push({ label: "Subtask", value: subRes.displayTitle });
    isDangerous = true;
  } else if (selectedIntent === "create_goal") {
    const fallbackOwner = allUsers.find((u) => u.id === userId)?.name ?? null;
    const ownerName =
      (typeof mergedPayload.owner === "string" &&
      mergedPayload.owner.trim().length > 0
        ? mergedPayload.owner
        : fallbackOwner) ?? null;
    if (!ownerName) {
      return NextResponse.json({
        reply: "Owner tidak ditemukan. Silakan isi owner secara eksplisit.",
        status: "collecting_fields",
        missing_fields: ["owner"],
      });
    }

    mergedPayload.owner = ownerName;
    const ownerRes = tryResolveUser(ownerName, "owner");
    if (ownerRes instanceof NextResponse) return ownerRes;
    resolved.owner_id = ownerRes.id;

    summaryRows.push({ label: "Judul", value: String(mergedPayload.title) });
    summaryRows.push({ label: "Owner", value: ownerRes.displayName });
    if (mergedPayload.description)
      summaryRows.push({
        label: "Deskripsi",
        value: String(mergedPayload.description),
      });
    const kpis = ((mergedPayload.kpis as KpiInput[]) ?? []).filter(
      (k) => k?.label && k?.target != null,
    );
    if (kpis.length > 0)
      summaryRows.push({
        label: `KPI (${kpis.length})`,
        value: kpis
          .map((k) => `${k.label}: ${k.target}${k.unit ?? ""}`)
          .join(", "),
      });
  } else if (selectedIntent === "update_goal") {
    const allGoals = await pb.collection("goals").getFullList<PBGoal>();
    const goalRes = tryResolveEntity(
      mergedPayload.target as string,
      allGoals,
      "target",
    );
    if (goalRes instanceof NextResponse) return goalRes;
    resolved.goal_id = goalRes.id;

    summaryRows.push({ label: "Goal", value: goalRes.displayTitle });
    if (mergedPayload.title)
      summaryRows.push({
        label: "Judul baru",
        value: String(mergedPayload.title),
      });
    if (mergedPayload.description)
      summaryRows.push({
        label: "Deskripsi baru",
        value: String(mergedPayload.description),
      });
    if (mergedPayload.owner) {
      const oRes = tryResolveUser(mergedPayload.owner as string, "owner");
      if (oRes instanceof NextResponse) return oRes;
      resolved.owner_id = oRes.id;
      summaryRows.push({ label: "Owner baru", value: oRes.displayName });
    }
    const kpisToAdd = ((mergedPayload.kpis as KpiInput[]) ?? []).filter(
      (k) => k?.label && k?.target != null,
    );
    if (kpisToAdd.length > 0)
      summaryRows.push({
        label: `KPI baru (${kpisToAdd.length})`,
        value: kpisToAdd
          .map((k) => `${k.label}: ${k.target}${k.unit ?? ""}`)
          .join(", "),
      });
  } else if (selectedIntent === "delete_goal") {
    const allGoals = await pb.collection("goals").getFullList<PBGoal>();
    const goalRes = tryResolveEntity(
      mergedPayload.target as string,
      allGoals,
      "target",
    );
    if (goalRes instanceof NextResponse) return goalRes;
    resolved.goal_id = goalRes.id;
    summaryRows.push({ label: "Goal", value: goalRes.displayTitle });
    isDangerous = true;
  } else if (selectedIntent === "link_epic_to_goal") {
    const allGoals = await pb.collection("goals").getFullList<PBGoal>();
    const goalRes = tryResolveEntity(
      mergedPayload.goal_name as string,
      allGoals,
      "goal_name",
    );
    if (goalRes instanceof NextResponse) return goalRes;
    resolved.goal_id = goalRes.id;
    summaryRows.push({ label: "Goal", value: goalRes.displayTitle });

    const allEpics = await pb.collection("epics").getFullList<PBEpic>();
    const epicNames = (mergedPayload.epic_names as string[]) ?? [];
    const eIds: string[] = [];
    const eTitles: string[] = [];
    for (const eName of epicNames) {
      const eRes = tryResolveEntity(eName, allEpics, "epic_names");
      if (eRes instanceof NextResponse) return eRes;
      if (!eIds.includes(eRes.id)) {
        eIds.push(eRes.id);
        eTitles.push(eRes.displayTitle);
      }
    }
    resolved.linked_epic_ids = eIds;
    summaryRows.push({ label: "Epics", value: eTitles.join(", ") });
  } else if (selectedIntent === "query_epic") {
    const allEpics = await pb
      .collection("epics")
      .getFullList<PBEpic>({ expand: "owner,watchers" });
    const epicRes = tryResolveEntity(
      mergedPayload.target as string,
      allEpics,
      "target",
    );
    if (epicRes instanceof NextResponse) return epicRes;

    const epic = allEpics.find((e) => e.id === epicRes.id)!;
    const ownerName =
      (epic.expand?.owner as PBUser | undefined)?.name ?? "Tidak diketahui";
    const watchers = epic.expand?.watchers
      ? (Array.isArray(epic.expand.watchers)
          ? epic.expand.watchers
          : [epic.expand.watchers]
        )
          .map((w) => (w as PBUser).name)
          .join(", ")
      : "-";

    const tasks = await pb
      .collection("tasks")
      .getFullList<PBTask>({ filter: `epic="${epic.id}"`, expand: "assignee" });

    const taskLines =
      tasks.length > 0
        ? tasks
            .map((t) => {
              const assigneeName = (
                t.expand as { assignee?: PBUser } | undefined
              )?.assignee?.name;
              return `\u2022 ${t.title} (${t.status})${
                assigneeName ? ` — ${assigneeName}` : ""
              }`;
            })
            .join("\n")
        : "\u2022 Tidak ada task";

    clearDraft(userId);
    return jsonWithRateLimit({
      status: "answer",
      reply:
        `📋 Epic: ${epic.title}\n` +
        `Status: ${epic.status}\n` +
        `Owner: ${ownerName}\n` +
        `Mulai: ${epic.start_date ?? "-"}\n` +
        `Selesai: ${epic.end_date ?? "-"}\n` +
        `Members: ${watchers}\n` +
        `Tasks (${tasks.length}):\n${taskLines}`,
    });
  } else if (selectedIntent === "query_task") {
    let allTasks = await pb
      .collection("tasks")
      .getFullList<PBTask>({ expand: "assignee,epic" });

    if (mergedPayload.epic_name) {
      const allEpics = await pb.collection("epics").getFullList<PBEpic>();
      const eRes = tryResolveEntity(
        mergedPayload.epic_name as string,
        allEpics,
        "epic_name",
      );
      if (!(eRes instanceof NextResponse)) {
        allTasks = allTasks.filter((t) => t.epic === eRes.id);
      }
    }

    const taskRes = tryResolveEntity(
      mergedPayload.target as string,
      allTasks,
      "target",
    );
    if (taskRes instanceof NextResponse) return taskRes;

    const task = allTasks.find((t) => t.id === taskRes.id)!;
    const assigneeName = (task.expand as { assignee?: PBUser } | undefined)
      ?.assignee?.name;
    const epicName = (task.expand as { epic?: PBEpic } | undefined)?.epic
      ?.title;

    const subtaskCount = await pb
      .collection("subtasks")
      .getList(1, 1, { filter: `task="${task.id}"` })
      .then((r) => r.totalItems)
      .catch(() => 0);

    clearDraft(userId);
    return jsonWithRateLimit({
      status: "answer",
      reply:
        `📌 Task: ${task.title}\n` +
        `Status: ${task.status}\n` +
        `Prioritas: ${task.priority ?? "-"}\n` +
        `Epic: ${epicName ?? "-"}\n` +
        `Assignee: ${assigneeName ?? "-"}\n` +
        `Deadline: ${task.due_date ?? "-"}\n` +
        `Subtasks: ${subtaskCount}`,
    });
  } else if (selectedIntent === "query_goal") {
    const allGoals = await pb
      .collection("goals")
      .getFullList<PBGoal>({ expand: "owner" });
    const goalRes = tryResolveEntity(
      mergedPayload.target as string,
      allGoals,
      "target",
    );
    if (goalRes instanceof NextResponse) return goalRes;

    const goal = allGoals.find((g) => g.id === goalRes.id)!;
    const ownerName =
      (goal.expand?.owner as PBUser | undefined)?.name ?? "Tidak diketahui";

    const kpis = await pb
      .collection("goal_kpis")
      .getFullList<PBGoalKpi>({ filter: `goal="${goal.id}"` });

    const kpiLines =
      kpis.length > 0
        ? kpis
            .map((k) => {
              const pct =
                k.target > 0 ? Math.round((k.current / k.target) * 100) : 0;
              return `\u2022 ${k.label}: ${k.current}${k.unit ?? ""}/${k.target}${k.unit ?? ""} (${pct}%)`;
            })
            .join("\n")
        : "\u2022 Belum ada KPI";

    const linkedEpics = Array.isArray(goal.linked_epics)
      ? goal.linked_epics
      : goal.linked_epics
        ? [goal.linked_epics]
        : [];

    clearDraft(userId);
    return jsonWithRateLimit({
      status: "answer",
      reply:
        `🎯 Goal: ${goal.title}\n` +
        `Owner: ${ownerName}\n` +
        `${goal.description ? `Deskripsi: ${goal.description}\n` : ""}` +
        `Linked Epics: ${linkedEpics.length}\n` +
        `KPIs (${kpis.length}):\n${kpiLines}`,
    });
  } else if (selectedIntent === "query_subtask") {
    const allSubtasks = await pb
      .collection("subtasks")
      .getFullList<PBSubtask>({ expand: "assignee,task" });

    let candidates = allSubtasks as Array<
      { id: string; title: string } & PBSubtask
    >;
    if (mergedPayload.task_name) {
      const allTasks = await pb.collection("tasks").getFullList<PBTask>();
      const tRes = tryResolveEntity(
        mergedPayload.task_name as string,
        allTasks,
        "task_name",
      );
      if (!(tRes instanceof NextResponse)) {
        candidates = allSubtasks.filter((s) => s.task === tRes.id);
      }
    }

    const subRes = tryResolveEntity(
      mergedPayload.target as string,
      candidates,
      "target",
    );
    if (subRes instanceof NextResponse) return subRes;

    const sub = allSubtasks.find((s) => s.id === subRes.id)!;
    const assigneeName = (sub.expand as { assignee?: PBUser } | undefined)
      ?.assignee?.name;
    const taskTitle = (sub.expand as { task?: PBTask } | undefined)?.task
      ?.title;

    clearDraft(userId);
    return jsonWithRateLimit({
      status: "answer",
      reply:
        `☑️ Subtask: ${sub.title}\n` +
        `Task: ${taskTitle ?? "-"}\n` +
        `Status: ${sub.done ? "Selesai ✅" : "Belum selesai"}\n` +
        `Assignee: ${assigneeName ?? "-"}\n` +
        `Deadline: ${sub.due_date ?? "-"}`,
    });
  }
  // ── query_member_work ────────────────────────────────────────────────────
  else if (selectedIntent === "query_member_work") {
    const userRes = tryResolveUser(mergedPayload.target as string, "target");
    if (userRes instanceof NextResponse) return userRes;

    // Fetch all tasks assigned to this member, expand epic
    const tasks = await pb.collection("tasks").getFullList<PBTask>({
      filter: `assignee = "${userRes.id}"`,
      expand: "epic",
    });

    if (tasks.length === 0) {
      clearDraft(userId);
      return jsonWithRateLimit({
        status: "answer",
        reply: `👤 ${userRes.displayName} saat ini tidak memiliki task yang di-assign.`,
      });
    }

    // Group tasks by epic
    const epicMap = new Map<string, { epicTitle: string; tasks: PBTask[] }>();
    for (const task of tasks) {
      const epic = (task.expand as { epic?: PBEpic } | undefined)?.epic;
      const epicKey = epic?.id ?? "__no_epic__";
      const epicTitle = epic?.title ?? "(Tanpa Epic)";
      if (!epicMap.has(epicKey)) epicMap.set(epicKey, { epicTitle, tasks: [] });
      epicMap.get(epicKey)!.tasks.push(task);
    }

    const lines: string[] = [
      `👤 ${userRes.displayName} — ${tasks.length} task aktif`,
    ];
    for (const { epicTitle, tasks: epicTasks } of epicMap.values()) {
      lines.push(`\n📋 Epic: ${epicTitle}`);
      for (const t of epicTasks) {
        const status = t.status ?? "-";
        const due = t.due_date ? `due ${t.due_date}` : "";
        lines.push(`  • ${t.title} (${status})${due ? " — " + due : ""}`);
      }
    }

    clearDraft(userId);
    return jsonWithRateLimit({
      status: "answer",
      reply: lines.join("\n"),
    });
  }
  // Title Case: apply to payload titles saved to DB AND to the confirmation summary rows
  if (mergedPayload.title) {
    mergedPayload.title = toTitleCase(mergedPayload.title as string);
  }
  if (Array.isArray(mergedPayload.tasks)) {
    mergedPayload.tasks = (
      mergedPayload.tasks as Array<Record<string, unknown>>
    ).map((t) => ({
      ...t,
      title: t.title ? toTitleCase(t.title as string) : t.title,
    }));
  }

  for (const row of summaryRows) {
    if (row.label.startsWith("Judul")) {
      row.value = toTitleCase(row.value);
    } else if (["Epic", "Task", "Subtask", "Goal"].includes(row.label)) {
      row.value = toTitleCase(row.value);
    } else if (row.label === "Epics") {
      row.value = row.value.split(", ").map(toTitleCase).join(", ");
    } else if (row.label === "Tasks") {
      row.value = row.value
        .split(" | ")
        .map((part) => {
          const sep = part.indexOf(" → ");
          return sep === -1
            ? toTitleCase(part)
            : toTitleCase(part.slice(0, sep)) + part.slice(sep);
        })
        .join(" | ");
    }
  }

  if (AUTO_EXECUTE_CREATE_INTENTS.has(selectedIntent)) {
    let result;
    let successMsg = "Berhasil!";

    try {
      switch (selectedIntent) {
        case "create_epic": {
          result = await executeCreateEpic(
            {
              title: mergedPayload.title as string,
              owner: mergedPayload.owner as string,
              start_date: (mergedPayload.start_date as string) ?? null,
              end_date: (mergedPayload.end_date as string) ?? null,
              status: (mergedPayload.status as string) ?? null,
              members: (mergedPayload.members as string[]) ?? [],
              description: (mergedPayload.description as string) ?? null,
            },
            resolved.owner_id!,
            resolved.member_ids ?? [],
          );
          successMsg = `Epic "${result.title}" berhasil dibuat! 🎉`;
          break;
        }

        case "create_epic_with_tasks": {
          const tasks =
            (((mergedPayload.tasks as unknown[]) ?? []) as Array<{
              title: string;
              assignee: string | null;
              status: string | null;
              due_date: string | null;
              priority: string | null;
            }>) ?? [];
          result = await executeCreateEpicWithTasks(
            {
              title: mergedPayload.title as string,
              owner: mergedPayload.owner as string,
              start_date: (mergedPayload.start_date as string) ?? null,
              end_date: (mergedPayload.end_date as string) ?? null,
              status: (mergedPayload.status as string) ?? null,
              members: (mergedPayload.members as string[]) ?? [],
              description: (mergedPayload.description as string) ?? null,
            },
            tasks,
            resolved.owner_id!,
            resolved.member_ids ?? [],
            new Map(Object.entries(resolved.assignee_map ?? {})),
          );
          const tc = result.taskIds?.length ?? 0;
          successMsg = `Epic "${result.title}" beserta ${tc} task berhasil dibuat! 🎉`;
          break;
        }

        case "create_task": {
          result = await executeCreateTask(
            resolved.epic_id!,
            {
              title: mergedPayload.title as string,
              status: (mergedPayload.status as string) ?? null,
              priority: (mergedPayload.priority as string) ?? null,
              due_date: (mergedPayload.due_date as string) ?? null,
              description: (mergedPayload.description as string) ?? null,
            },
            resolved.assignee_id ?? null,
          );
          successMsg = `Task "${result.title}" berhasil dibuat!`;
          break;
        }

        case "create_subtask": {
          result = await executeCreateSubtask(
            resolved.task_id!,
            {
              title: mergedPayload.title as string,
              due_date: (mergedPayload.due_date as string) ?? null,
            },
            resolved.assignee_id ?? null,
          );
          successMsg = `Subtask "${result.title}" berhasil dibuat!`;
          break;
        }

        case "create_goal": {
          const kpis = ((mergedPayload.kpis as KpiInput[]) ?? []).filter(
            (k) => k?.label && k?.target != null,
          );
          result = await executeCreateGoal(
            {
              title: mergedPayload.title as string,
              description: (mergedPayload.description as string) ?? null,
            },
            resolved.owner_id!,
            kpis,
          );
          const kpiMsg = kpis.length > 0 ? ` dengan ${kpis.length} KPI` : "";
          successMsg = `Goal "${result.title}"${kpiMsg} berhasil dibuat!`;
          break;
        }

        default:
          break;
      }
    } catch (err) {
      clearDraft(userId);
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[AI executor] Unexpected auto-create error:", msg);
      return NextResponse.json({
        reply: `Terjadi kesalahan: ${msg}`,
        status: "error",
      });
    }

    clearDraft(userId);

    if (!result?.success) {
      console.error(
        "[AI executor] Auto-create DB write failed:",
        result?.error,
      );
      return jsonWithRateLimit({
        reply: `Gagal: ${result?.error ?? "Unknown error"}`,
        status: "error",
      });
    }

    return jsonWithRateLimit({ reply: successMsg, status: "success" });
  }

  saveDraft(userId, {
    intent: selectedIntent,
    draftJson: {
      payload: mergedPayload,
      missing_fields: [],
      resolved,
    },
    status: "ready",
  });

  return jsonWithRateLimit({
    status: "ready_to_confirm",
    reply: "Konfirmasi perintah berikut sebelum disimpan:",
    summary: {
      intent: selectedIntent,
      label: INTENT_LABELS[selectedIntent] ?? selectedIntent,
      rows: summaryRows,
      isDangerous,
    },
  });
}
