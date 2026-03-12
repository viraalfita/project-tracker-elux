/**
 * Invite management API.
 *
 * GET  /api/admin/invites  — list all invites (Admin + Manager)
 * POST /api/admin/invites  — create invite + user record + send informational invite email via SMTP
 *                            Does NOT trigger OTP. OTP is only sent when the user logs in.
 */

import { sendInviteEmail } from "@/lib/mailer";
import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.eluxemang.top";

const INVITE_EXPIRY_DAYS = 7;

/** Derive up to 2-letter initials from a display name. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function forbidden() {
  return NextResponse.json(
    { error: "Forbidden: Admin or Manager access required." },
    { status: 403 },
  );
}

// ── GET /api/admin/invites ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminOrManagerToken(token))) return forbidden();

  try {
    const pb = await getSuperuserClient();

    // Try with relation expansion first; strip it if PocketBase rejects the field.
    // If the invites collection doesn't exist yet, return an empty array so the
    // workspace page degrades gracefully instead of showing an error.
    const invites = await pb
      .collection("invites")
      .getFullList({ sort: "-created", expand: "invited_by" })
      .catch(() => pb.collection("invites").getFullList({ sort: "-created" }))
      .catch(() => []);

    return NextResponse.json(invites);
  } catch {
    // Superuser auth failed or unexpected error — return empty list
    return NextResponse.json([]);
  }
}

// ── POST /api/admin/invites ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminOrManagerToken(token))) return forbidden();

  // Get the inviting user's ID
  const callerPb = new PocketBase(PB_URL);
  callerPb.autoCancellation(false);
  callerPb.authStore.save(token, null);
  let invitedById: string;
  try {
    const result = await callerPb.collection("users").authRefresh();
    invitedById = result.record.id;
  } catch {
    return forbidden();
  }

  const body = await request.json().catch(() => ({}));
  const { name, email, role } = body as {
    name?: string;
    email?: string;
    role?: string;
  };

  if (!name?.trim() || !email || !role) {
    return NextResponse.json(
      { error: "name, email, and role are required." },
      { status: 400 },
    );
  }

  const validRoles = ["Admin", "Manager", "Member", "Viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const pb = await getSuperuserClient();

  // Check if a user with this email already exists
  const existing = await pb
    .collection("users")
    .getFirstListItem(`email="${email}"`)
    .catch(() => null);

  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists." },
      { status: 409 },
    );
  }

  // Check if there's already a pending invite for this email
  const pendingInvite = await pb
    .collection("invites")
    .getFirstListItem(`email="${email}" && status="pending"`)
    .catch(() => null);

  if (pendingInvite) {
    return NextResponse.json(
      { error: "A pending invite for this email already exists." },
      { status: 409 },
    );
  }

  const AVATAR_COLORS = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
  ];
  const avatarColor =
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const initials = deriveInitials(name.trim());

  // Generate a random password — user authenticates via OTP only, never via password.
  // PocketBase requires a non-empty password field on user creation.
  const randomPassword =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2).toUpperCase() +
    "!0";

  let userId: string;
  try {
    const userRecord = await pb.collection("users").create({
      email,
      emailVisibility: true,
      verified: true,
      password: randomPassword,
      passwordConfirm: randomPassword,
      name: name.trim(),
      initials,
      avatarColor,
      role,
      weeklyCapacity: 40,
    });
    userId = userRecord.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Create the invite record
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .replace("T", " ");

  let inviteId: string;
  try {
    const invite = await pb.collection("invites").create({
      email,
      role,
      invited_by: invitedById,
      status: "pending",
      expires_at: expiresAt,
      user: userId,
    });
    inviteId = invite.id;
  } catch (err: unknown) {
    // Roll back user creation if invite record fails
    await pb
      .collection("users")
      .delete(userId)
      .catch(() => {});
    const msg = err instanceof Error ? err.message : "Failed to create invite";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Send informational invite email via SMTP. Does NOT include an OTP code.
  // OTP is only generated when the user visits /login and submits their email.
  try {
    await sendInviteEmail({ to: email, name: name.trim(), appUrl: APP_URL });
  } catch {
    // Non-fatal: invite record is created. User can still log in via OTP.
  }

  return NextResponse.json({ inviteId, userId }, { status: 201 });
}
