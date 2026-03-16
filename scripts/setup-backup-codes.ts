/**
 * Creates the `backup_codes` collection in PocketBase.
 *
 * Run once after ordinary setup:
 *   npx tsx scripts/setup-backup-codes.ts
 *
 * Safe to re-run — skips if the collection already exists.
 *
 * Collection schema:
 *   - user      : relation → users (required, one-to-many)
 *   - code_hash : text (required) — stores "salt:sha256hash" of the raw code
 *   - used_at   : date (optional) — set when the code is consumed
 */

import * as dotenv from "dotenv";
import PocketBase, { ClientResponseError } from "pocketbase";

dotenv.config({ path: ".env.local" });

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD before running.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  console.log(`Connecting to PocketBase at ${PB_URL}…`);
  await pb
    .collection("_superusers")
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as superuser.\n");

  // Resolve the users collection ID (required for relation fields)
  const usersCol = await pb.collections.getOne("users");
  const usersColId = usersCol.id;

  // Check if backup_codes already exists
  let exists = false;
  try {
    await pb.collections.getOne("backup_codes");
    exists = true;
  } catch (err) {
    if (
      err instanceof ClientResponseError &&
      (err.status === 404 || err.status === 400)
    ) {
      exists = false;
    } else {
      throw err;
    }
  }

  if (exists) {
    console.log("Collection `backup_codes` already exists — nothing to do.");
    return;
  }

  console.log("Creating `backup_codes` collection…");
  await pb.collections.create({
    name: "backup_codes",
    type: "base",
    // Access rules:
    //   list/view: only the owning user (via API token) — defence-in-depth,
    //   since all mutations go through server-side API routes with superuser auth.
    //   create/update/delete: null (server-side only).
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColId,
        cascadeDelete: true, // remove codes when a user is deleted
        maxSelect: 1,
      },
      {
        name: "code_hash",
        type: "text",
        required: true,
        // Hex salt + ':' + hex sha256 hash = 32 + 1 + 64 = 97 chars max
        max: 200,
      },
      {
        name: "used_at",
        type: "date",
        required: false,
      },
    ],
  });

  console.log("Collection `backup_codes` created successfully.");
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
