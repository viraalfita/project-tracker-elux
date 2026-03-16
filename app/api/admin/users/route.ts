/**
 * Server-side API route for user management.
 *
 * The PocketBase `users` collection has createRule/updateRule/deleteRule = null
 * (superuser-only). This route authenticates as a PB superuser on the server
 * so client code never needs admin credentials.
 *
 * All endpoints require the caller to be an Admin (verified via their PB token).
 *
 * POST   /api/admin/users  → create a new user
 * PATCH  /api/admin/users  → update a user's role
 * DELETE /api/admin/users  → delete (revoke access for) a user
 */

import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return a PocketBase client authenticated as a superuser. */
async function getSuperuserClient(): Promise<PocketBase> {
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    throw new Error(
      "PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars must be set on the server.",
    );
  }
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

/**
 * Verify that the bearer token belongs to an Admin or Manager user.
 * Returns the role string, or null if verification fails.
 */
async function verifyAdminOrManagerToken(
  token: string,
): Promise<"Admin" | "Manager" | null> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);
    const result = await pb
      .collection("users")
      .authRefresh<{ role?: string }>();
    const role = result.record?.role;
    if (role === "Admin" || role === "Manager") return role;
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify that the bearer token belongs to an Admin user.
 * Returns false on any error (expired token, network failure, etc.).
 */
async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    // Restore the auth state so authRefresh uses the provided token.
    pb.authStore.save(token, null);
    const result = await pb
      .collection("users")
      .authRefresh<{ role?: string }>();
    return result.record?.role === "Admin";
  } catch {
    return false;
  }
}

/** Extract the bearer token from the Authorization header. */
function extractToken(request: NextRequest): string {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

/** Return a 403 Forbidden response. */
function forbidden(msg = "Forbidden: Admin access required.") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

// ─── POST /api/admin/users — create user ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminToken(token))) return forbidden();

  const body = await request.json().catch(() => ({}));
  const { email, password, name, initials, avatarColor, role, weeklyCapacity } =
    body as Record<string, unknown>;

  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true,
      name,
      initials,
      avatarColor,
      role,
      weeklyCapacity: weeklyCapacity ?? 40,
      verified: true,
    });
    return NextResponse.json(record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── PATCH /api/admin/users — update role ─────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const token = extractToken(request);
  const callerRole = await verifyAdminOrManagerToken(token);
  if (!callerRole)
    return forbidden("Forbidden: Admin or Manager access required.");

  const body = await request.json().catch(() => ({}));
  const { userId, role } = body as { userId?: string; role?: string };

  if (!userId || !role) {
    return NextResponse.json(
      { error: "userId and role are required." },
      { status: 400 },
    );
  }

  try {
    const pb = await getSuperuserClient();

    // Manager guard: cannot promote to Admin and cannot modify Admin users
    if (callerRole === "Manager") {
      if (role === "Admin") {
        return forbidden("Managers cannot assign the Admin role.");
      }
      const target = await pb
        .collection("users")
        .getOne<{ role?: string }>(userId);
      if (target.role === "Admin" || target.role === "Manager") {
        return forbidden(
          "Managers can only change the role of Members and Viewers.",
        );
      }
    }

    const record = await pb.collection("users").update(userId, { role });
    return NextResponse.json(record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── DELETE /api/admin/users — revoke access ──────────────────────────────────

export async function DELETE(request: NextRequest) {
  const token = extractToken(request);
  const callerRole = await verifyAdminOrManagerToken(token);
  if (!callerRole)
    return forbidden("Forbidden: Admin or Manager access required.");

  const body = await request.json().catch(() => ({}));
  const { userId } = body as { userId?: string };

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  try {
    const pb = await getSuperuserClient();

    // Manager guard: cannot revoke Admin or Manager users
    if (callerRole === "Manager") {
      const target = await pb
        .collection("users")
        .getOne<{ role?: string }>(userId);
      if (target.role === "Admin" || target.role === "Manager") {
        return forbidden(
          "Managers can only revoke access for Members and Viewers.",
        );
      }
    }

    await pb.collection("users").delete(userId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
