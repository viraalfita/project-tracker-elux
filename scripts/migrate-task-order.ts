/**
 * Migration: Add `order` field to the existing `tasks` collection.
 *
 * Safe to run against a live instance — it patches the collection schema
 * without touching any records.
 *
 * Run with:
 *   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=pass npx tsx scripts/migrate-task-order.ts
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

async function main() {
  console.log(`Connecting to ${PB_URL}...`);
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as admin.");

  // Fetch the existing tasks collection schema
  let collection: Record<string, unknown>;
  try {
    collection = await pb.send("/api/collections/tasks", { method: "GET" });
  } catch (err) {
    if (err instanceof ClientResponseError) {
      console.error("Failed to fetch tasks collection:", err.status, err.message);
    } else {
      console.error("Failed to fetch tasks collection:", err);
    }
    process.exit(1);
  }

  const fields = (collection.fields ?? []) as Array<Record<string, unknown>>;

  // Check if `order` already exists
  if (fields.some((f) => f.name === "order")) {
    console.log("✓ `order` field already exists. Nothing to do.");
    process.exit(0);
  }

  // Append the new field
  const updatedFields = [
    ...fields,
    {
      name: "order",
      type: "number",
      required: false,
      min: null,
      max: null,
    },
  ];

  // Patch the collection schema
  try {
    await pb.send(`/api/collections/${collection.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: updatedFields }),
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof ClientResponseError) {
      console.error(
        "Failed to patch tasks collection:",
        err.status,
        err.message,
        JSON.stringify(err.data, null, 2),
      );
    } else {
      console.error("Failed to patch tasks collection:", err);
    }
    process.exit(1);
  }

  console.log("✓ `order` field added to tasks collection.");
  console.log("Seeding initial order values for existing tasks...");

  // Assign order values to existing tasks so they don't all start at 0.
  // Group by status column, then sort by creation time within each column.
  const tasks = await pb
    .collection("tasks")
    .getFullList({ fields: "id,status,created" });

  const byStatus: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    const status = String(t.status ?? "");
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(t);
  }

  for (const [, group] of Object.entries(byStatus)) {
    group.sort((a, b) =>
      String(a.created) < String(b.created) ? -1 : 1,
    );
    for (let i = 0; i < group.length; i++) {
      await pb
        .collection("tasks")
        .update(group[i].id, { order: i })
        .catch(() => {});
    }
  }

  console.log(`✓ Seeded order values for ${tasks.length} tasks.`);
  console.log("Done! Tasks collection now supports manual Kanban ordering.");
  console.log("The app will sort tasks by `order` within each column.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
