/**
 * Admin invite management API.
 *
 * GET  /api/admin/invites        — list all invites (Admin only)
 * POST /api/admin/invites        — create invite + user record + send OTP email (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

const INVITE_EXPIRY_DAYS = 7;
const INVITED_PLACEHOLDER = "(Invited)";

async function getSuperuserClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);
    const result = await pb.collection("users").authRefresh<{ role?: string }>();
    return result.record?.role === "Admin";
  } catch {
    return false;
  }
}

function extractToken(req: NextRequest): string {
  return req.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
}

// ── GET /api/admin/invites ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminToken(token))) return forbidden();

  try {
    const pb = await getSuperuserClient();
    const invites = await pb.collection("invites").getFullList({
      sort: "-created",
      expand: "invited_by",
    });
    return NextResponse.json(invites);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch invites";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── POST /api/admin/invites ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = extractToken(request);
  if (!token || !(await verifyAdminToken(token))) return forbidden();

  // Get the inviting Admin's user ID
  const adminPb = new PocketBase(PB_URL);
  adminPb.autoCancellation(false);
  adminPb.authStore.save(token, null);
  let invitedById: string;
  try {
    const result = await adminPb.collection("users").authRefresh();
    invitedById = result.record.id;
  } catch {
    return forbidden();
  }

  const body = await request.json().catch(() => ({}));
  const { email, role } = body as { email?: string; role?: string };

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required." }, { status: 400 });
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

  // Derive a random avatar color
  const AVATAR_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6",
    "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
  ];
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  let userId: string;
  try {
    // Create the user record with a placeholder name so we can detect first login
    const userRecord = await pb.collection("users").create({
      email,
      emailVisibility: true,
      verified: true,
      name: INVITED_PLACEHOLDER,
      initials: "IN",
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
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
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
    // Roll back the user creation if invite record fails
    await pb.collection("users").delete(userId).catch(() => {});
    const msg = err instanceof Error ? err.message : "Failed to create invite";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Send OTP email to the invited user — this serves as the invite notification.
  // The user clicks "check your email" and uses the OTP code to log in for the
  // first time. We use a separate PB client without admin auth so requestOTP
  // runs as a normal client request.
  try {
    const clientPb = new PocketBase(PB_URL);
    clientPb.autoCancellation(false);
    await clientPb.collection("users").requestOTP(email);
  } catch {
    // Non-fatal: invite was created, email delivery is best-effort.
    // The Admin can ask the user to request an OTP themselves.
  }

  return NextResponse.json({ inviteId, userId }, { status: 201 });
}
