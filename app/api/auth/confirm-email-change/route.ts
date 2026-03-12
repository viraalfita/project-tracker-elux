/**
 * POST /api/auth/confirm-email-change
 *
 * Confirms an email change for OTP/passwordless accounts.
 *
 * PocketBase's built-in confirm-email-change endpoint always requires the
 * user's current password, even when called with admin auth. For passwordless
 * (OTP) accounts this is impossible. Instead, we decode the signed JWT token
 * issued by PocketBase (which contains the userId and newEmail), verify it
 * hasn't expired and is the right type, then use the superuser client to
 * update the user record directly.
 *
 * Body: { token: string }
 */
import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://devpb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

interface EmailChangePayload {
  id: string;
  newEmail: string;
  type: string;
  exp: number;
}

/** Decode a JWT payload without verifying the signature. */
function decodeJwtPayload(token: string): EmailChangePayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format.");
  // Node.js Buffer handles both standard and URL-safe base64
  const json = Buffer.from(parts[1], "base64").toString("utf-8");
  return JSON.parse(json) as EmailChangePayload;
}

async function getSuperuserClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { token } = body as Record<string, unknown>;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  let payload: EmailChangePayload;
  try {
    payload = decodeJwtPayload(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  // Validate token type and expiry
  if (payload.type !== "emailChange") {
    return NextResponse.json({ error: "Invalid token type." }, { status: 400 });
  }
  if (!payload.id || !payload.newEmail) {
    return NextResponse.json({ error: "Malformed token." }, { status: 400 });
  }
  if (Date.now() / 1000 > payload.exp) {
    return NextResponse.json(
      { error: "This link has expired. Please request a new email change." },
      { status: 400 },
    );
  }

  try {
    const adminPb = await getSuperuserClient();
    // Directly update the user's email using superuser privileges.
    // This bypasses the password requirement entirely.
    await adminPb.collection("users").update(payload.id, {
      email: payload.newEmail,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to confirm email change";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
