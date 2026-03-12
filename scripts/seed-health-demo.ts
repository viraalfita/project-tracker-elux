/**
 * Health Demo Seed Script
 * =======================
 * Creates 4 demo epics + 14 tasks with controlled dates and subtask completion
 * so the health algorithm produces PREDICTABLE, documentable results.
 *
 * Reference date: 2026-03-11 (today when this seed was designed)
 *
 * Run:
 *   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword \
 *     npx tsx scripts/seed-health-demo.ts
 *
 * ─── PROOF OF CALCULATION ────────────────────────────────────────────────────
 *
 * Formulas (from lib/utils.ts getTaskHealth):
 *   totalDays      = diffDays(dueDate, startDate)       = dueDate − startDate (days)
 *   elapsedDays    = diffDays(today,   startDate)       = today   − startDate (days)
 *   expectedPct    = clamp(elapsedDays / totalDays, 0, 1) × 100
 *   actualPct      = (doneSubs / totalSubs) × 100
 *   gap            = expectedPct − actualPct
 *
 *   gap > 40  → Delayed   (severely behind schedule)
 *   gap > 20  → At Risk
 *   gap ≤ 20  → On Track
 *
 *   Special cases (checked first):
 *     dueDate < today && status ≠ Done  → Delayed  (hard overdue)
 *     status == Done                    → On Track
 *     startDate missing                 → Simple fallback:
 *                                          daysLeft ≤ 3 && actualPct < 50 → At Risk
 *
 *   Epic rules (getEpicHealth):
 *     epic.endDate < today && status ≠ Done  → Delayed
 *     (delayedTasks / total) ≥ 20%           → Delayed
 *     (atRiskTasks  / total) ≥ 30%           → At Risk
 *     otherwise                              → On Track
 *
 * ─── EXPECTED RESULTS TABLE ──────────────────────────────────────────────────
 *
 * EPIC A — "Health Demo: On Track"       endDate 2026-05-31
 * ┌─────┬────────────────────────────┬────────────┬──────────┬──────────┬────────────┬────────┬──────────┐
 * │Task │Title                       │startDate   │dueDate   │done/total│expected%   │actual% │health    │
 * ├─────┼────────────────────────────┼────────────┼──────────┼──────────┼────────────┼────────┼──────────┤
 * │A1   │Setup CI/CD Pipeline        │2026-03-01  │2026-03-25│ 7/10     │10/24=41.7% │ 70.0%  │ON TRACK  │
 * │A2   │Write API Documentation     │2026-03-05  │2026-03-30│ 5/10     │ 6/25=24.0% │ 50.0%  │ON TRACK  │
 * │A3   │Design System Tokens        │2026-02-25  │2026-04-10│ 6/10     │14/44=31.8% │ 60.0%  │ON TRACK  │
 * └─────┴────────────────────────────┴────────────┴──────────┴──────────┴────────────┴────────┴──────────┘
 * → 0% Delayed, 0% At Risk  →  EPIC: ON TRACK  ✓
 *
 * EPIC B — "Health Demo: At Risk"        endDate 2026-04-30
 * ┌─────┬────────────────────────────┬────────────┬──────────┬──────────┬────────────┬────────┬──────────┐
 * │Task │Title                       │startDate   │dueDate   │done/total│expected%   │actual% │health    │
 * ├─────┼────────────────────────────┼────────────┼──────────┼──────────┼────────────┼────────┼──────────┤
 * │B1   │Build Authentication Service│2026-02-20  │2026-03-25│ 3/10     │19/33=57.6% │ 30.0%  │AT RISK ⚠ │
 * │B2   │Integrate Payment SDK       │2026-03-01  │2026-03-20│ 3/10     │10/19=52.6% │ 30.0%  │AT RISK ⚠ │
 * │B3   │Database Schema Migration   │2026-03-01  │2026-03-30│ 4/10     │10/29=34.5% │ 40.0%  │ON TRACK  │
 * │B4   │Load Testing Suite          │2026-03-05  │2026-04-15│ 5/10     │ 6/41=14.6% │ 50.0%  │ON TRACK  │
 * │B5   │Security Audit              │2026-03-08  │2026-04-20│ 3/6      │ 3/43= 7.0% │ 50.0%  │ON TRACK  │
 * └─────┴────────────────────────────┴────────────┴──────────┴────────────────┴────────┴──────────┘
 * → 0% Delayed, 2/5 = 40% At Risk (≥30%)  →  EPIC: AT RISK  ✓
 *
 * EPIC C — "Health Demo: Delayed (EndDate Passed)"   endDate 2026-03-05
 * ┌─────┬────────────────────────────┬────────────┬──────────┬──────────┬────────────┬────────┬──────────┐
 * │Task │Title                       │startDate   │dueDate   │done/total│expected%   │actual% │health    │
 * ├─────┼────────────────────────────┼────────────┼──────────┼──────────┼────────────┼────────┼──────────┤
 * │C1   │Frontend Component Refactor │2026-03-01  │2026-03-20│ 2/5      │10/19=52.6% │ 40.0%  │ON TRACK  │
 * │C2   │Database Index Optimization │2026-03-01  │2026-03-25│ 1/4      │10/24=41.7% │ 25.0%  │ON TRACK  │
 * └─────┴────────────────────────────┴────────────┴──────────┴──────────┴────────────┴────────┴──────────┘
 * → Tasks healthy, BUT epic.endDate (2026-03-05) < today (2026-03-11)
 *   →  EPIC: DELAYED  ✓  (hard-overdue rule fires before task aggregation)
 *
 * EPIC D — "Health Demo: Delayed (Task Aggregation)"    endDate 2026-05-31
 * ┌─────┬────────────────────────────┬────────────┬──────────┬──────────┬────────────┬────────┬──────────┐
 * │Task │Title                       │startDate   │dueDate   │done/total│expected%   │actual% │health    │
 * ├─────┼────────────────────────────┼────────────┼──────────┼──────────┼────────────┼────────┼──────────┤
 * │D1   │Deploy Microservices        │─           │2026-03-08│ 1/8      │OVERDUE     │─       │DELAYED 🔴│
 * │D2   │Kubernetes Cluster Setup    │─           │2026-03-10│ 1/8      │OVERDUE     │─       │DELAYED 🔴│
 * │D3   │Monitoring Dashboard        │2026-02-20  │2026-03-25│ 2/8      │19/33=57.6% │ 25.0%  │AT RISK ⚠ │
 * │D4   │Disaster Recovery Plan      │2026-03-05  │2026-04-30│ 3/8      │ 6/56=10.7% │ 37.5%  │ON TRACK  │
 * │D5   │Alerting & Notifications    │2026-03-01  │2026-04-15│ 4/8      │10/45=22.2% │ 50.0%  │ON TRACK  │
 * └─────┴────────────────────────────┴────────────┴──────────┴──────────┴────────────┴────────┴──────────┘
 * → 2/5 = 40% Delayed (≥20%)  →  EPIC: DELAYED  ✓
 *
 * Note on D1/D2 startDate: these tasks have no startDate because their dueDate
 * is already in the past — the "overdue" branch fires first in getTaskHealth(),
 * before any startDate-based logic is reached.
 */

import * as dotenv from "dotenv";
import PocketBase, { ClientResponseError } from "pocketbase";

dotenv.config({ path: ".env.local" });

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars before running.",
  );
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

function pbError(label: string, err: unknown): void {
  if (err instanceof ClientResponseError) {
    console.error(
      `  ${label}: ${err.status} ${err.message}`,
      JSON.stringify(err.data, null, 2),
    );
  } else {
    console.error(`  ${label}:`, err);
  }
}

/** Format "YYYY-MM-DD" → PocketBase datetime string */
function pbDate(ymd: string): string {
  return `${ymd} 00:00:00.000Z`;
}

// ─── Subtask builder ──────────────────────────────────────────────────────────

function makeSubs(
  doneCount: number,
  totalCount: number,
): { title: string; done: boolean }[] {
  return Array.from({ length: totalCount }, (_, i) => ({
    title: `Sub-task ${i + 1}`,
    done: i < doneCount,
  }));
}

// ─── Seed a single epic ───────────────────────────────────────────────────────

async function upsertEpic(
  title: string,
  endDate: string,
  ownerId: string,
  watcherIds: string[] = [],
): Promise<string> {
  const existing = await pb
    .collection("epics")
    .getList(1, 1, { filter: `title="${title}"` });

  if (existing.items.length > 0) {
    console.log(`  Epic "${title}" already exists — skipping.`);
    return existing.items[0].id;
  }

  const record = await pb.collection("epics").create({
    title,
    description: `Demo epic for health algorithm documentation (expected result encoded in title).`,
    status: "In Progress",
    start_date: pbDate("2026-02-01"),
    end_date: pbDate(endDate),
    owner: ownerId,
    watchers: watcherIds,
  });

  console.log(`  Created epic "${title}" → ${record.id}`);
  return record.id;
}

// ─── Seed a single task with subtasks ────────────────────────────────────────

interface TaskSpec {
  title: string;
  /** "YYYY-MM-DD" — stored in the explicit start_date field on the task */
  startDate?: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  status?: "To Do" | "In Progress" | "Review" | "Done";
  priority?: "Low" | "Medium" | "High";
  doneSubtasks: number;
  totalSubtasks: number;
  /** Expected health label (for console output) */
  expectedHealth: "On Track" | "At Risk" | "Delayed";
  /** One-line explanation of why */
  reason: string;
}

async function upsertTask(
  spec: TaskSpec,
  epicId: string,
  ownerId: string,
  assigneeId: string,
): Promise<void> {
  const existing = await pb
    .collection("tasks")
    .getList(1, 1, { filter: `title="${spec.title}" && epic="${epicId}"` });

  let taskId: string;

  if (existing.items.length > 0) {
    taskId = existing.items[0].id;
    // Always patch start_date in case this is a re-run after the schema fix
    try {
      await pb.collection("tasks").update(taskId, {
        start_date: spec.startDate ? pbDate(spec.startDate) : null,
        due_date: pbDate(spec.dueDate),
        owner: ownerId,
        assignee: assigneeId,
      });
    } catch {
      // ignore – field may not exist yet on older schema runs
    }
    console.log(
      `  Task "${spec.title}" already exists — patched. [expected: ${spec.expectedHealth}]`,
    );
  } else {
    const payload: Record<string, unknown> = {
      title: spec.title,
      status: spec.status ?? "In Progress",
      priority: spec.priority ?? "Medium",
      due_date: pbDate(spec.dueDate),
      start_date: spec.startDate ? pbDate(spec.startDate) : null,
      epic: epicId,
      owner: ownerId,
      assignee: assigneeId,
    };

    const record = await pb.collection("tasks").create(payload);
    taskId = record.id;
    console.log(
      `  Created task "${spec.title}" → ${record.id}  [expected: ${spec.expectedHealth}] — ${spec.reason}`,
    );
  }

  // Seed subtasks
  const existingSubs = await pb
    .collection("subtasks")
    .getFullList({ filter: `task="${taskId}"` });

  if (existingSubs.length > 0) return;

  for (const sub of makeSubs(spec.doneSubtasks, spec.totalSubtasks)) {
    try {
      await pb.collection("subtasks").create({
        title: sub.title,
        done: sub.done,
        task: taskId,
      });
    } catch (err) {
      pbError(`Failed to create subtask for "${spec.title}"`, err);
    }
  }
}

// ─── Patch tasks collection schema ───────────────────────────────────────────

/** Adds the start_date field to the tasks collection if it doesn't exist yet. */
async function patchTasksCollectionSchema(): Promise<void> {
  const col = await pb.collections.getOne("tasks");
  const rawFields = (col.fields ?? col.schema ?? []) as Array<
    Record<string, unknown>
  >;
  const hasStartDate = rawFields.some((f) => f.name === "start_date");
  if (hasStartDate) {
    console.log("  tasks.start_date field already exists — skipping.\n");
    return;
  }
  await pb.collections.update("tasks", {
    fields: [...rawFields, { name: "start_date", type: "date" }],
  });
  console.log("  Added start_date field to tasks collection.\n");
}

// ─── Sync epic members from task assignees ───────────────────────────────────

/** Reads all tasks for an epic, then adds their assignees as epic watchers. */
async function syncEpicMembersFromTaskAssignees(epicId: string): Promise<void> {
  const tasks = await pb
    .collection("tasks")
    .getFullList<{ assignee: string }>({ filter: `epic="${epicId}"` });
  const assigneeIds = [
    ...new Set(tasks.map((t) => t.assignee).filter(Boolean)),
  ];
  const epic = await pb.collection("epics").getOne(epicId);
  const currentWatchers: string[] = epic.watchers ?? [];
  const merged = [...new Set([...currentWatchers, ...assigneeIds])];
  await pb.collection("epics").update(epicId, { watchers: merged });
  console.log(
    `  Added ${assigneeIds.length} task assignee(s) as epic members.\n`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to PocketBase at ${PB_URL}...`);
  await pb
    .collection("_superusers")
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as superuser.\n");

  // ── Fetch all users and build rotation helper ─────────────────────────────
  const users = await pb
    .collection("users")
    .getFullList<{ id: string; role: string; name: string }>();
  if (users.length === 0) {
    console.error("No users found. Run setup-pocketbase.ts first.");
    process.exit(1);
  }
  const allIds = users.map((u) => u.id);
  const admins = users.filter((u) => u.role === "Admin");
  const managers = users.filter((u) => u.role === "Manager");
  console.log(
    `Found ${users.length} users: ${users.map((u) => u.name).join(", ")}\n`,
  );

  // Round-robin owner/assignee — offset by 1 so they're never the same
  let taskIdx = 0;
  const pick = (offset = 0) => allIds[(taskIdx + offset) % allIds.length];
  const tick = () => {
    taskIdx++;
  };

  // Epic owners: spread across roles
  const epicOwners = [
    (admins[0] ?? users[0]).id,
    (managers[0] ?? users[0]).id,
    (admins[1] ?? admins[0] ?? users[0]).id,
    (managers[1] ?? managers[0] ?? users[0]).id,
  ];

  // ── Patch tasks collection schema to add start_date ─────────────────────
  console.log("── Patching tasks collection schema ──────────────────────────");
  try {
    await patchTasksCollectionSchema();
  } catch (err) {
    pbError("Failed to patch tasks schema", err);
  }

  // ── EPIC A — On Track ──────────────────────────────────────────────────────
  console.log("── Epic A: Health Demo: On Track ─────────────────────────────");
  const epicAId = await upsertEpic(
    "Health Demo: On Track",
    "2026-05-31",
    epicOwners[0],
    allIds.filter((id) => id !== epicOwners[0]).slice(0, 2),
  );
  await upsertTask(
    {
      title: "[A1] Setup CI/CD Pipeline",
      startDate: "2026-03-01",
      dueDate: "2026-03-25",
      doneSubtasks: 7,
      totalSubtasks: 10,
      expectedHealth: "On Track",
      reason: "gap=41.7%-70%=-28.3% (ahead)",
    },
    epicAId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[A2] Write API Documentation",
      startDate: "2026-03-05",
      dueDate: "2026-03-30",
      doneSubtasks: 5,
      totalSubtasks: 10,
      expectedHealth: "On Track",
      reason: "gap=24%-50%=-26% (ahead)",
    },
    epicAId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[A3] Design System Tokens",
      startDate: "2026-02-25",
      dueDate: "2026-04-10",
      doneSubtasks: 6,
      totalSubtasks: 10,
      expectedHealth: "On Track",
      reason: "gap=31.8%-60%=-28.2% (ahead)",
    },
    epicAId,
    pick(0),
    pick(1),
  );
  tick();
  await syncEpicMembersFromTaskAssignees(epicAId);
  console.log("  → Expected epic health: ON TRACK  (0% delayed, 0% at-risk)\n");

  // ── EPIC B — At Risk ───────────────────────────────────────────────────────
  console.log("── Epic B: Health Demo: At Risk ──────────────────────────────");
  const epicBId = await upsertEpic(
    "Health Demo: At Risk",
    "2026-04-30",
    epicOwners[1],
    allIds.filter((id) => id !== epicOwners[1]).slice(0, 2),
  );
  await upsertTask(
    {
      title: "[B1] Build Authentication Service",
      startDate: "2026-02-20",
      dueDate: "2026-03-25",
      doneSubtasks: 3,
      totalSubtasks: 10,
      expectedHealth: "At Risk",
      reason: "gap=57.6%-30%=+27.6% (AT RISK)",
    },
    epicBId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[B2] Integrate Payment SDK",
      startDate: "2026-03-01",
      dueDate: "2026-03-20",
      doneSubtasks: 3,
      totalSubtasks: 10,
      expectedHealth: "At Risk",
      reason: "gap=52.6%-30%=+22.6% (AT RISK)",
    },
    epicBId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[B3] Database Schema Migration",
      startDate: "2026-03-01",
      dueDate: "2026-03-30",
      doneSubtasks: 4,
      totalSubtasks: 10,
      expectedHealth: "On Track",
      reason: "gap=34.5%-40%=-5.5% (ahead)",
    },
    epicBId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[B4] Load Testing Suite",
      startDate: "2026-03-05",
      dueDate: "2026-04-15",
      doneSubtasks: 5,
      totalSubtasks: 10,
      expectedHealth: "On Track",
      reason: "gap=14.6%-50%=-35.4% (well ahead)",
    },
    epicBId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[B5] Security Audit",
      startDate: "2026-03-08",
      dueDate: "2026-04-20",
      doneSubtasks: 3,
      totalSubtasks: 6,
      expectedHealth: "On Track",
      reason: "gap=7%-50%=-43% (just started, ahead)",
    },
    epicBId,
    pick(0),
    pick(1),
  );
  tick();
  await syncEpicMembersFromTaskAssignees(epicBId);
  console.log(
    "  → Expected epic health: AT RISK  (0% delayed, 2/5 = 40% at-risk ≥ 30%)\n",
  );

  // ── EPIC C — Delayed (EndDate Passed) ─────────────────────────────────────
  console.log("── Epic C: Health Demo: Delayed (EndDate Passed) ─────────────");
  const epicCId = await upsertEpic(
    "Health Demo: Delayed (EndDate)",
    "2026-03-05",
    epicOwners[2],
    allIds.filter((id) => id !== epicOwners[2]).slice(0, 2),
  );
  await upsertTask(
    {
      title: "[C1] Frontend Component Refactor",
      startDate: "2026-03-01",
      dueDate: "2026-03-20",
      doneSubtasks: 2,
      totalSubtasks: 5,
      expectedHealth: "On Track",
      reason: "gap=52.6%-40%=+12.6% (≤20, on track)",
    },
    epicCId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[C2] Database Index Optimization",
      startDate: "2026-03-01",
      dueDate: "2026-03-25",
      doneSubtasks: 1,
      totalSubtasks: 4,
      expectedHealth: "On Track",
      reason: "gap=41.7%-25%=+16.7% (≤20, on track)",
    },
    epicCId,
    pick(0),
    pick(1),
  );
  tick();
  await syncEpicMembersFromTaskAssignees(epicCId);
  console.log(
    "  → Expected epic health: DELAYED  (endDate 2026-03-05 < today 2026-03-11)",
  );
  console.log(
    "    Tasks are individually ON TRACK, but the epic deadline has passed.\n",
  );

  // ── EPIC D — Delayed (Task Aggregation) ───────────────────────────────────
  console.log("── Epic D: Health Demo: Delayed (Task Aggregation) ───────────");
  const epicDId = await upsertEpic(
    "Health Demo: Delayed (Tasks)",
    "2026-05-31",
    epicOwners[3],
    allIds.filter((id) => id !== epicOwners[3]).slice(0, 2),
  );
  await upsertTask(
    {
      title: "[D1] Deploy Microservices",
      dueDate: "2026-03-08",
      status: "In Progress",
      doneSubtasks: 1,
      totalSubtasks: 8,
      expectedHealth: "Delayed",
      reason: "dueDate past → OVERDUE → DELAYED",
    },
    epicDId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[D2] Kubernetes Cluster Setup",
      dueDate: "2026-03-10",
      status: "In Progress",
      doneSubtasks: 1,
      totalSubtasks: 8,
      expectedHealth: "Delayed",
      reason: "dueDate past → OVERDUE → DELAYED",
    },
    epicDId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[D3] Monitoring Dashboard",
      startDate: "2026-02-20",
      dueDate: "2026-03-25",
      doneSubtasks: 2,
      totalSubtasks: 8,
      expectedHealth: "At Risk",
      reason: "gap=57.6%-25%=+32.6% (AT RISK)",
    },
    epicDId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[D4] Disaster Recovery Plan",
      startDate: "2026-03-05",
      dueDate: "2026-04-30",
      doneSubtasks: 3,
      totalSubtasks: 8,
      expectedHealth: "On Track",
      reason: "gap=10.7%-37.5%=-26.8% (well ahead)",
    },
    epicDId,
    pick(0),
    pick(1),
  );
  tick();
  await upsertTask(
    {
      title: "[D5] Alerting & Notifications",
      startDate: "2026-03-01",
      dueDate: "2026-04-15",
      doneSubtasks: 4,
      totalSubtasks: 8,
      expectedHealth: "On Track",
      reason: "gap=22.2%-50%=-27.8% (ahead)",
    },
    epicDId,
    pick(0),
    pick(1),
  );
  tick();
  await syncEpicMembersFromTaskAssignees(epicDId);
  console.log("  → Expected epic health: DELAYED  (2/5 = 40% delayed ≥ 20%)");
  console.log(
    "    endDate is future (2026-05-31), but too many tasks are overdue.\n",
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  SEED COMPLETE — Health Demo Summary");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  Epic A  Health Demo: On Track          → ON TRACK  ✅");
  console.log("  Epic B  Health Demo: At Risk            → AT RISK   ⚠️");
  console.log("  Epic C  Health Demo: Delayed (EndDate)  → DELAYED   🔴");
  console.log("  Epic D  Health Demo: Delayed (Tasks)    → DELAYED   🔴");
  console.log("");
  console.log("  Verify in the app:");
  console.log("   • /epics        — check the badges next to each demo epic");
  console.log(
    "   • /board        — filter by demo epics, check task health badges",
  );
  console.log("   • /dashboard    — verify Epic B and D appear in EWS section");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
