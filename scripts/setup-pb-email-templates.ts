/**
 * Patches PocketBase settings so email change confirmation links point to the
 * Next.js app instead of the PocketBase admin UI.
 *
 * Run once (or any time the PocketBase instance is reset):
 *   npx tsx scripts/setup-pb-email-templates.ts
 *
 * Requires the same env vars as setup-pocketbase.ts:
 *   PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *
 * Optional — defaults to localhost:3000 in dev:
 *   NEXT_PUBLIC_APP_URL=https://yourdomain.com
 */

import * as dotenv from "dotenv";
import PocketBase from "pocketbase";

dotenv.config({ path: ".env.local" });

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://devpb.eluxemang.top";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  console.log("  ✓ Authenticated as superuser");

  // 1. Update global meta.appUrl to point to the Next.js app.
  //    PocketBase uses appUrl to build {ACTION_URL} in email templates.
  console.log(`\nSetting Application URL to: ${APP_URL}`);
  await pb.send("/api/settings", {
    method: "PATCH",
    body: {
      meta: {
        appUrl: APP_URL,
      },
    },
  });
  console.log("  ✓ meta.appUrl updated");

  // 2. Update the email change template on the users collection so the
  //    confirmation link goes to the Next.js /auth/confirm-email-change route.
  //    We use {TOKEN} (available in PocketBase v0.22+) to build our own URL.
  console.log("\nUpdating email change template on 'users' collection…");

  // Find the users collection by name.
  const collections = await pb.send("/api/collections?perPage=200", {
    method: "GET",
  });
  const usersCollection = (
    collections.items as { id: string; name: string }[]
  ).find((c) => c.name === "users");

  if (!usersCollection) {
    console.error("  ✗ Could not find 'users' collection");
    process.exit(1);
  }

  const confirmUrl = `${APP_URL}/auth/confirm-email-change?token={TOKEN}`;

  const emailChangeBody = `
<p>Hello,</p>
<p>Click the button below to confirm your new email address for <strong>{APP_NAME}</strong>.</p>
<p style="margin:24px 0">
  <a href="${confirmUrl}"
     style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
    Confirm new email
  </a>
</p>
<p style="color:#64748b;font-size:13px">
  If you did not request this change, you can safely ignore this email.<br/>
  This link expires in 72 hours.
</p>
`.trim();

  await pb.send(`/api/collections/${usersCollection.id}`, {
    method: "PATCH",
    body: {
      options: {
        emailChangeTemplate: {
          subject: "Confirm your {APP_NAME} new email address",
          body: emailChangeBody,
          actionUrl: confirmUrl,
        },
      },
    },
  });
  console.log("  ✓ emailChangeTemplate updated");
  console.log(`\nConfirmation links will now point to:\n  ${confirmUrl}\n`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
