/**
 * PocketBase collection setup + seed script.
 * Compatible with PocketBase v0.22+ (tested on v0.36.5).
 *
 * Run once to bootstrap the remote PocketBase instance:
 *   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword npx tsx scripts/setup-pocketbase.ts
 *
 * Safe to re-run — skips existing records.
 *
 * Key design decisions for PB v0.36 compatibility:
 *   - collectionId in relation fields must be the real UUID, not a name string.
 *     We resolve IDs dynamically and update existingMap as each collection is
 *     created so later collections can reference earlier ones.
 *   - maxSelect must be a number. Omitting the key entirely = unlimited (null
 *     pointer in Go). Never use maxSelect: null — it serialises to JSON null
 *     which fails PB's number validator in v0.26+.
 *   - Collection factory functions are evaluated lazily (called just before
 *     pb.collections.create) so colId() always finds the already-created ID.
 */

import * as dotenv from "dotenv";
import PocketBase, { ClientResponseError } from "pocketbase";
import { EPIC_DOCS, EPICS, GOALS, TASKS, USERS } from "../lib/mock";

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

// ─── Error helper ─────────────────────────────────────────────────────────────

function pbError(label: string, err: unknown): void {
  if (err instanceof ClientResponseError) {
    console.error(
      `  ${label}: ${err.status} ${err.message}`,
      // Print the full validation payload so we can see exactly which field failed
      JSON.stringify(err.data, null, 2),
    );
  } else {
    console.error(`  ${label}:`, err);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to PocketBase at ${PB_URL}...`);
  await pb
    .collection("_superusers")
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as superuser.\n");

  console.log("Step 1: Extending users collection...");
  await extendUsersCollection();

  console.log("Step 2: Creating collections...");
  await createCollections();

  console.log("Step 2b: Applying access rules...");
  await applyAccessRules();

  console.log("Step 2c: Patching multi-relation maxSelect...");
  await patchMultiSelectFields();

  console.log("\nStep 3: Seeding users...");
  const userMap = await seedUsers();

  console.log("Step 4: Seeding epics...");
  const epicMap = await seedEpics(userMap);

  console.log("Step 5: Seeding tasks + subtasks + comments...");
  await seedTasksAndChildren(userMap, epicMap);

  console.log("Step 6: Seeding goals + KPIs...");
  await seedGoals(userMap, epicMap);

  console.log("Step 7: Seeding epic docs...");
  await seedEpicDocs(userMap, epicMap);

  console.log("\nSetup complete!");
  console.log("Default user password: devPassword123!");
}

// ─── Users collection extension ───────────────────────────────────────────────

async function extendUsersCollection() {
  try {
    const col = await pb.collections.getOne("users");

    // Auth collections contain system-managed fields (email, password,
    // tokenKey, etc.) that are flagged with system:true and/or hidden:true.
    // Sending them back in the update payload causes a 400 in PB v0.26+.
    // We keep only the user-editable (custom) fields plus any we previously
    // added ourselves.
    const AUTH_SYSTEM_NAMES = new Set([
      "id",
      "email",
      "emailVisibility",
      "verified",
      "password",
      "passwordConfirm",
      "tokenKey",
      "lastResetSentAt",
      "lastVerificationSentAt",
      "created",
      "updated",
    ]);

    const rawFields: Array<Record<string, unknown>> =
      col.fields ?? col.schema ?? [];
    const editableFields = rawFields.filter(
      (f) => !f.system && !f.hidden && !AUTH_SYSTEM_NAMES.has(f.name as string),
    );
    const existingNames = new Set(rawFields.map((f) => f.name as string));

    const newFields = [
      { name: "name", type: "text" },
      { name: "initials", type: "text" },
      { name: "avatarColor", type: "text" },
      {
        name: "role",
        type: "select",
        maxSelect: 1,
        values: ["Admin", "Manager", "Member", "Viewer"],
      },
      { name: "weeklyCapacity", type: "number" },
    ].filter((f) => !existingNames.has(f.name));

    const updatePayload: Record<string, unknown> = {
      // Users collection access rules:
      //   list/view → any authenticated user (needed for assignee dropdowns)
      //   create/update/delete → null (superuser only; client ops go via /api/admin/users)
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: null,
      updateRule: null,
      deleteRule: null,
    };

    if (newFields.length > 0) {
      updatePayload.fields = [...editableFields, ...newFields];
    }

    await pb.collections.update("users", updatePayload);

    if (newFields.length > 0) {
      console.log(
        `  Added fields to users: ${newFields.map((f) => f.name).join(", ")}`,
      );
    } else {
      console.log("  users fields already complete; updated access rules.");
    }
  } catch (err) {
    pbError("Could not extend users collection", err);
  }
}

// ─── Apply access rules ────────────────────────────────────────────────────────
// Run after createCollections so this works for both newly created collections
// and ones that already existed from a prior run without rules.

async function applyAccessRules() {
  // Access rules enforce ownership + watcher membership at the database level.
  // Admin (role = "Admin" on the users collection) bypasses all epic/task rules.
  // Goals and KPIs are open to any authenticated user.
  const authed = '@request.auth.id != ""';
  const adminOrOwnerOrWatcher =
    '@request.auth.role = "Admin" || @request.auth.id = owner.id || watchers.id ?= @request.auth.id';
  // Tasks: epic owner/watchers (2-hop) + direct assignee (1-hop) + Admin
  const adminOrEpicOwnerOrWatcher =
    '@request.auth.role = "Admin" || @request.auth.id = epic.owner || epic.watchers ?= @request.auth.id || assignee = @request.auth.id';
  // Nested child records (subtasks, comments):
  // Gated by parent task access at the DB level.
  const childRecordAccess = authed;
  // epic_docs: 2-hop (doc→epic→owner/watchers) — Admin bypass included
  const adminOrEpicMember =
    '@request.auth.role = "Admin" || @request.auth.id = epic.owner || epic.watchers ?= @request.auth.id';

  const collectionRules: Array<{
    name: string;
    rules: Record<string, string | null>;
  }> = [
    {
      name: "epics",
      rules: {
        listRule: adminOrOwnerOrWatcher,
        viewRule: adminOrOwnerOrWatcher,
        createRule: authed,
        updateRule: adminOrOwnerOrWatcher,
        deleteRule:
          '@request.auth.role = "Admin" || @request.auth.id = owner.id',
      },
    },
    {
      name: "tasks",
      rules: {
        listRule: adminOrEpicOwnerOrWatcher,
        viewRule: adminOrEpicOwnerOrWatcher,
        createRule: adminOrEpicOwnerOrWatcher,
        updateRule: adminOrEpicOwnerOrWatcher,
        deleteRule: adminOrEpicOwnerOrWatcher,
      },
    },
    {
      name: "subtasks",
      rules: {
        listRule: childRecordAccess,
        viewRule: childRecordAccess,
        createRule: childRecordAccess,
        updateRule: childRecordAccess,
        deleteRule: childRecordAccess,
      },
    },
    {
      name: "comments",
      rules: {
        listRule: childRecordAccess,
        viewRule: childRecordAccess,
        createRule: childRecordAccess,
        updateRule: childRecordAccess,
        deleteRule: childRecordAccess,
      },
    },
    {
      name: "epic_docs",
      rules: {
        listRule: adminOrEpicMember,
        viewRule: adminOrEpicMember,
        createRule: adminOrEpicMember,
        updateRule: adminOrEpicMember,
        deleteRule: adminOrEpicMember,
      },
    },
    {
      name: "goals",
      rules: {
        listRule: authed,
        viewRule: authed,
        createRule: authed,
        updateRule: authed,
        deleteRule: authed,
      },
    },
    {
      name: "goal_kpis",
      rules: {
        listRule: authed,
        viewRule: authed,
        createRule: authed,
        updateRule: authed,
        deleteRule: authed,
      },
    },
  ];

  for (const { name, rules } of collectionRules) {
    try {
      await pb.collections.update(name, rules);
      console.log(`  Rules applied to "${name}"`);
    } catch (err) {
      pbError(`Failed to apply rules to "${name}"`, err);
    }
  }
}

// ─── Patch multi-select relation fields ───────────────────────────────────────
// PocketBase stores maxSelect as Go's int zero-value (0) when the key is
// omitted during collection creation. PB v0.36 treats maxSelect=0 as
// single-select → API returns a bare string instead of an array for those
// fields. This function rewrites the affected fields WITHOUT a maxSelect key,
// so Go deserialises it as nil (= unlimited multi-select).

async function patchMultiSelectFields() {
  // Map of collection name → field names that must be unlimited multi-select.
  const targets: Record<string, string[]> = {
    epics: ["watchers"],
    tasks: ["watchers"],
    comments: ["mentions"],
    goals: ["linked_epics"],
  };

  for (const [collName, fieldNames] of Object.entries(targets)) {
    try {
      const col = await pb.collections.getOne(collName);
      const rawFields: Array<Record<string, unknown>> =
        (col.fields as Array<Record<string, unknown>>) ??
        (col.schema as Array<Record<string, unknown>>) ??
        [];

      let patched = false;
      const updatedFields = rawFields.map((f) => {
        if (!fieldNames.includes(f.name as string)) return f;
        // Remove maxSelect so PB treats this as unlimited (null pointer in Go).
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { maxSelect: _drop, ...rest } = f;
        patched = true;
        return rest;
      });

      if (!patched) {
        console.log(`  "${collName}": target fields not found — skipped.`);
        continue;
      }

      await pb.collections.update(col.id, { fields: updatedFields });
      console.log(
        `  "${collName}": maxSelect removed from [${fieldNames.join(", ")}]`,
      );
    } catch (err) {
      pbError(`Failed to patch "${collName}" multi-select fields`, err);
    }
  }
}

// ─── Create collections ───────────────────────────────────────────────────────
//
// Collections are defined as FACTORY FUNCTIONS, not plain objects. The factory
// is called immediately before pb.collections.create(), so colId() can look up
// IDs for collections that were just created in the same run.
//
// maxSelect is OMITTED for "many" (unlimited) relations. Omitting the key
// leaves it as null in Go (= no limit). Never pass maxSelect: null — JSON null
// fails PB's number field validator since v0.26.

async function createCollections() {
  // Seed existingMap with every collection that already exists on the server.
  const existing = await pb.collections.getFullList();
  const existingMap = new Map<string, string>(
    existing.map((c) => [c.name, c.id]),
  );

  // Resolve a collection's real UUID — throws if not found yet, which is a
  // programming error (wrong dependency order in COLLECTION_FACTORIES).
  function colId(name: string): string {
    const id = existingMap.get(name);
    if (!id)
      throw new Error(
        `colId("${name}"): collection not found — check creation order`,
      );
    return id;
  }

  // Each factory is called just before creation.
  // Order matters: dependencies must come first.
  type FieldDef = Record<string, unknown>;
  type CollectionDef = {
    name: string;
    type: string;
    fields: FieldDef[];
    listRule?: string | null;
    viewRule?: string | null;
    createRule?: string | null;
    updateRule?: string | null;
    deleteRule?: string | null;
  };
  // Factories use open rules as placeholders; applyAccessRules() overwrites them
  // with the correct ownership + watcher rules after collection creation.
  const open = '@request.auth.id != ""';
  const COLLECTION_FACTORIES: Array<() => CollectionDef> = [
    // 1. epics — depends only on users
    () => ({
      name: "epics",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "text" },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["Not Started", "In Progress", "Done", "On Hold"],
        },
        { name: "start_date", type: "date" },
        { name: "end_date", type: "date" },
        // single-select relations: maxSelect: 1
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
        // unlimited relations: omit maxSelect entirely
        {
          name: "watchers",
          type: "relation",
          collectionId: colId("users"),
          cascadeDelete: false,
        },
      ],
    }),

    // 2. tasks — depends on users + epics
    () => ({
      name: "tasks",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "text" },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["To Do", "In Progress", "Review", "Done"],
        },
        {
          name: "priority",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["Low", "Medium", "High"],
        },
        { name: "due_date", type: "date" },
        { name: "estimate", type: "number" },
        {
          name: "epic",
          type: "relation",
          required: true,
          collectionId: colId("epics"),
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "owner",
          type: "relation",
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "assignee",
          type: "relation",
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "watchers",
          type: "relation",
          collectionId: colId("users"),
          cascadeDelete: false,
        },
      ],
    }),

    // 3. subtasks — depends on users + tasks
    () => ({
      name: "subtasks",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "done", type: "bool" },
        { name: "due_date", type: "date" },
        { name: "status", type: "text" },
        {
          name: "task",
          type: "relation",
          required: true,
          collectionId: colId("tasks"),
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "assignee",
          type: "relation",
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
      ],
    }),

    // 4. comments — depends on users + tasks
    () => ({
      name: "comments",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "text", type: "text", required: true },
        {
          name: "task",
          type: "relation",
          required: true,
          collectionId: colId("tasks"),
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "author",
          type: "relation",
          required: true,
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "mentions",
          type: "relation",
          collectionId: colId("users"),
          cascadeDelete: false,
        },
      ],
    }),

    // 5. epic_docs — depends on users + epics
    () => ({
      name: "epic_docs",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "content", type: "text", required: true },
        {
          name: "epic",
          type: "relation",
          required: true,
          collectionId: colId("epics"),
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "created_by",
          type: "relation",
          required: true,
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
      ],
    }),

    // 8. goals — depends on users + epics
    () => ({
      name: "goals",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "text" },
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: colId("users"),
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "linked_epics",
          type: "relation",
          collectionId: colId("epics"),
          cascadeDelete: false,
        },
      ],
    }),

    // 8. goal_kpis — depends on goals
    () => ({
      name: "goal_kpis",
      type: "base",
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { name: "label", type: "text", required: true },
        { name: "target", type: "number" },
        { name: "current", type: "number" },
        { name: "unit", type: "text" },
        { name: "green_threshold", type: "number" },
        { name: "yellow_threshold", type: "number" },
        {
          name: "goal",
          type: "relation",
          required: true,
          collectionId: colId("goals"),
          maxSelect: 1,
          cascadeDelete: true,
        },
      ],
    }),
  ];

  for (const factory of COLLECTION_FACTORIES) {
    // Evaluate lazily — IDs for earlier collections are now in existingMap
    let def: ReturnType<typeof factory>;
    try {
      def = factory();
    } catch (err) {
      console.error(
        "  Collection definition error:",
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    if (existingMap.has(def.name)) {
      // Collection already exists — ensure access rules are applied.
      const existingId = existingMap.get(def.name)!;
      try {
        await pb.collections.update(existingId, {
          listRule: def.listRule ?? null,
          viewRule: def.viewRule ?? null,
          createRule: def.createRule ?? null,
          updateRule: def.updateRule ?? null,
          deleteRule: def.deleteRule ?? null,
        });
        console.log(
          `  Collection "${def.name}" already exists — rules patched.`,
        );
      } catch (err) {
        pbError(`Failed to patch rules on existing "${def.name}"`, err);
      }
      continue;
    }

    try {
      const created = await pb.collections.create(def);
      existingMap.set(def.name, created.id);
      console.log(`  Created collection "${def.name}" → ${created.id}`);
    } catch (err) {
      pbError(`Failed to create "${def.name}"`, err);
    }
  }
}

// ─── Seed users ───────────────────────────────────────────────────────────────

async function seedUsers(): Promise<Map<string, string>> {
  const userMap = new Map<string, string>(); // mockId → pbId
  const existing = await pb
    .collection("users")
    .getFullList<{ id: string; email: string; name: string; role: string }>();
  const existingByEmail = new Map(existing.map((u) => [u.email, u]));

  for (const user of USERS) {
    const existingRecord = existingByEmail.get(user.email);

    if (existingRecord) {
      const pbId = existingRecord.id;
      userMap.set(user.id, pbId);

      // Always patch custom fields in case they were empty on a previous run
      // (this happens when the fields were added AFTER the user was created).
      try {
        await pb.collection("users").update(pbId, {
          name: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          role: user.role,
          weeklyCapacity: user.weeklyCapacity,
          emailVisibility: true,
          verified: true,
        });
        console.log(
          `  User "${user.email}" already exists — custom fields synced.`,
        );
      } catch (err) {
        pbError(`Failed to patch user fields for "${user.email}"`, err);
      }
      continue;
    }

    try {
      const record = await pb.collection("users").create({
        email: user.email,
        emailVisibility: true,
        password: "devPassword123!",
        passwordConfirm: "devPassword123!",
        name: user.name,
        initials: user.initials,
        avatarColor: user.avatarColor,
        role: user.role,
        weeklyCapacity: user.weeklyCapacity,
        verified: true,
      });
      userMap.set(user.id, record.id);
      console.log(`  Created user "${user.email}" → ${record.id}`);
    } catch (err) {
      pbError(`Failed to create user "${user.email}"`, err);
    }
  }

  return userMap;
}

// ─── Seed epics ───────────────────────────────────────────────────────────────

async function seedEpics(
  userMap: Map<string, string>,
): Promise<Map<string, string>> {
  const epicMap = new Map<string, string>(); // mockId → pbId
  const existing = await pb
    .collection("epics")
    .getFullList<{ id: string; title: string }>();
  const existingByTitle = new Map(existing.map((e) => [e.title, e.id]));

  for (const epic of EPICS) {
    if (existingByTitle.has(epic.title)) {
      const pbId = existingByTitle.get(epic.title)!;
      epicMap.set(epic.id, pbId);
      console.log(`  Epic "${epic.title}" already exists, skipping.`);
      continue;
    }

    try {
      const record = await pb.collection("epics").create({
        title: epic.title,
        description: epic.description,
        status: epic.status,
        start_date: epic.startDate ? `${epic.startDate} 00:00:00.000Z` : null,
        end_date: epic.endDate ? `${epic.endDate} 00:00:00.000Z` : null,
        owner: userMap.get(epic.owner.id),
        watchers: epic.watchers.map((w) => userMap.get(w.id)).filter(Boolean),
      });
      epicMap.set(epic.id, record.id);
      console.log(`  Created epic "${epic.title}" → ${record.id}`);
    } catch (err) {
      pbError(`Failed to create epic "${epic.title}"`, err);
    }
  }

  return epicMap;
}

// ─── Seed tasks + children ────────────────────────────────────────────────────

async function seedTasksAndChildren(
  userMap: Map<string, string>,
  epicMap: Map<string, string>,
) {
  const existingTasks = await pb
    .collection("tasks")
    .getFullList<{ id: string; title: string; epic: string }>();
  const existingByTitleEpic = new Set(
    existingTasks.map((t) => `${t.title}::${t.epic}`),
  );
  const taskMap = new Map<string, string>(); // mockId → pbId

  // Pre-populate taskMap for re-runs (tasks already exist)
  for (const t of existingTasks) {
    const mockTask = TASKS.find(
      (mt) => mt.title === t.title && epicMap.get(mt.epicId) === t.epic,
    );
    if (mockTask) taskMap.set(mockTask.id, t.id);
  }

  for (const task of TASKS) {
    const pbEpicId = epicMap.get(task.epicId);
    if (!pbEpicId) {
      console.warn(
        `  No PB epic ID for mock epic "${task.epicId}", skipping task "${task.title}"`,
      );
      continue;
    }

    let pbTaskId: string;

    if (existingByTitleEpic.has(`${task.title}::${pbEpicId}`)) {
      pbTaskId = taskMap.get(task.id)!;
      console.log(`  Task "${task.title}" already exists, skipping.`);
    } else {
      try {
        const record = await pb.collection("tasks").create({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.dueDate ? `${task.dueDate} 00:00:00.000Z` : null,
          estimate: task.estimate ?? null,
          epic: pbEpicId,
          owner: task.owner ? userMap.get(task.owner.id) : null,
          assignee: task.assignee ? userMap.get(task.assignee.id) : null,
          watchers: task.watchers.map((w) => userMap.get(w.id)).filter(Boolean),
        });
        pbTaskId = record.id;
        taskMap.set(task.id, pbTaskId);
        console.log(`  Created task "${task.title}" → ${record.id}`);
      } catch (err) {
        pbError(`Failed to create task "${task.title}"`, err);
        continue;
      }
    }

    // Subtasks
    const existingSubtasks = await pb
      .collection("subtasks")
      .getFullList<{ title: string }>({ filter: `task="${pbTaskId}"` });
    const existingSubtaskTitles = new Set(existingSubtasks.map((s) => s.title));

    for (const subtask of task.subtasks) {
      if (existingSubtaskTitles.has(subtask.title)) continue;
      try {
        await pb.collection("subtasks").create({
          title: subtask.title,
          done: subtask.done,
          due_date: subtask.dueDate ? `${subtask.dueDate} 00:00:00.000Z` : null,
          status: subtask.status ?? "",
          task: pbTaskId,
          assignee: subtask.assignee ? userMap.get(subtask.assignee.id) : null,
        });
      } catch (err) {
        pbError(`Failed to create subtask "${subtask.title}"`, err);
      }
    }

    // Comments
    const existingComments = await pb
      .collection("comments")
      .getFullList<{ text: string }>({ filter: `task="${pbTaskId}"` });
    const existingCommentTexts = new Set(existingComments.map((c) => c.text));

    for (const comment of task.comments) {
      if (existingCommentTexts.has(comment.text)) continue;
      try {
        await pb.collection("comments").create({
          text: comment.text,
          task: pbTaskId,
          author: userMap.get(comment.author.id),
          mentions:
            comment.mentions?.map((id) => userMap.get(id)).filter(Boolean) ??
            [],
        });
      } catch (err) {
        pbError(`Failed to create comment for task "${task.title}"`, err);
      }
    }
  }
}

// ─── Seed goals + KPIs ────────────────────────────────────────────────────────

async function seedGoals(
  userMap: Map<string, string>,
  epicMap: Map<string, string>,
) {
  const existing = await pb
    .collection("goals")
    .getFullList<{ id: string; title: string }>();
  const existingByTitle = new Map(existing.map((g) => [g.title, g.id]));

  for (const goal of GOALS) {
    let pbGoalId: string;

    if (existingByTitle.has(goal.title)) {
      pbGoalId = existingByTitle.get(goal.title)!;
      console.log(`  Goal "${goal.title}" already exists, skipping.`);
    } else {
      try {
        const record = await pb.collection("goals").create({
          title: goal.title,
          description: goal.description,
          owner: userMap.get(goal.owner.id),
          linked_epics: goal.linkedEpicIds
            .map((id) => epicMap.get(id))
            .filter(Boolean),
        });
        pbGoalId = record.id;
        console.log(`  Created goal "${goal.title}" → ${record.id}`);
      } catch (err) {
        pbError(`Failed to create goal "${goal.title}"`, err);
        continue;
      }
    }

    // KPIs
    const existingKpis = await pb
      .collection("goal_kpis")
      .getFullList<{ label: string }>({ filter: `goal="${pbGoalId}"` });
    const existingKpiLabels = new Set(existingKpis.map((k) => k.label));

    for (const kpi of goal.kpis) {
      if (existingKpiLabels.has(kpi.label)) continue;
      try {
        await pb.collection("goal_kpis").create({
          label: kpi.label,
          target: kpi.target,
          current: kpi.current,
          unit: kpi.unit,
          green_threshold: kpi.greenThreshold,
          yellow_threshold: kpi.yellowThreshold,
          goal: pbGoalId,
        });
      } catch (err) {
        pbError(`Failed to create KPI "${kpi.label}"`, err);
      }
    }
  }
}

// ─── Seed epic docs ───────────────────────────────────────────────────────────

async function seedEpicDocs(
  userMap: Map<string, string>,
  epicMap: Map<string, string>,
) {
  const existing = await pb
    .collection("epic_docs")
    .getFullList<{ title: string; epic: string }>();
  const existingByTitleEpic = new Set(
    existing.map((d) => `${d.title}::${d.epic}`),
  );

  for (const doc of EPIC_DOCS) {
    const pbEpicId = epicMap.get(doc.epicId);
    if (!pbEpicId) continue;
    if (existingByTitleEpic.has(`${doc.title}::${pbEpicId}`)) {
      console.log(`  Doc "${doc.title}" already exists, skipping.`);
      continue;
    }
    try {
      await pb.collection("epic_docs").create({
        title: doc.title,
        content: doc.content,
        epic: pbEpicId,
        created_by: userMap.get(doc.createdBy.id),
      });
      console.log(`  Created doc "${doc.title}"`);
    } catch (err) {
      pbError(`Failed to create doc "${doc.title}"`, err);
    }
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
