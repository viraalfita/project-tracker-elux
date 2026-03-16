/**
 * DELETE /api/admin/invites/[id] — cancel a pending invite (Admin only).
 *
 * Marks the invite as "expired" and deletes the user record if they have
 * never logged in (name is still the placeholder).
 */

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

async function verifyAdminOrManagerToken(token: string): Promise<boolean> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);
    const result = await pb
      .collection("users")
      .authRefresh<{ role?: string }>();
    return result.record?.role === "Admin" || result.record?.role === "Manager";
  } catch {
    return false;
  }
}

function extractToken(req: NextRequest): string {
  return req.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminOrManagerToken(token))) {
    return NextResponse.json(
      { error: "Forbidden: Admin or Manager access required." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const pb = await getSuperuserClient();

  // Fetch the invite
  let invite: Record<string, unknown>;
  try {
    invite = (await pb.collection("invites").getOne(id)) as Record<
      string,
      unknown
    >;
  } catch {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  // Mark invite as expired
  try {
    await pb.collection("invites").update(id, { status: "expired" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel invite";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Delete the linked user record — the invite is pending, meaning the user
  // has not yet logged in, so it is safe to remove the pre-created record.
  const linkedUserId = invite.user as string | undefined;
  if (linkedUserId) {
    await pb
      .collection("users")
      .delete(linkedUserId)
      .catch(() => {
        // Non-fatal — user may have already been deleted or logged in independently
      });
  }

  return NextResponse.json({ success: true });
}
