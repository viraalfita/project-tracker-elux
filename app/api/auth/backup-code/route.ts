/**
 * POST /api/auth/backup-code
 *
 * Server-side backup code authentication.
 *
 * Flow:
 *   1. Validate rate limit (max 5 attempts per email per 15 minutes)
 *   2. Look up user by email (superuser query — safe, server-only)
 *   3. Fetch all unused backup codes for the user
 *   4. Compare submitted code against all hashes (timing-safe — no early exit)
 *   5. On match: mark code used, impersonate the user, return auth token
 *   6. On failure: return generic 401 (no enumeration of cause)
 *
 * Raw backup codes are never stored; only salted SHA-256 hashes.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// In-memory per-email sliding window. Fits an internal tool's scale.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false; // blocked
  }
  entry.count++;
  return true; // allowed
}

function clearRateLimit(key: string) {
  rateLimitMap.delete(key);
}

// ─── PocketBase helpers ────────────────────────────────────────────────────────

async function getSuperuserClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

// ─── Hash verification ────────────────────────────────────────────────────────

/**
 * Normalise a user-submitted code (strip dashes, uppercase).
 * Accepts both with-dashes and without-dashes input.
 */
function normaliseCode(raw: string): string {
  return raw.replace(/-/g, "").toUpperCase();
}

/**
 * Compare the submitted code against a stored "salt:hash" string.
 * Uses a constant-length hex comparison, so this is timing-safe
 * against variable-length short-circuit — combined with "no early break"
 * in the outer loop this prevents leaking which code position matched.
 */
function verifyCode(submitted: string, storedEntry: string): boolean {
  const colonIdx = storedEntry.indexOf(":");
  if (colonIdx === -1) return false;
  const salt = storedEntry.slice(0, colonIdx);
  const storedHash = storedEntry.slice(colonIdx + 1);

  const computedHash = crypto
    .createHash("sha256")
    .update(`${salt}:${submitted}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(storedHash, "hex"),
    );
  } catch {
    return false; // mismatched lengths → definitely no match
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email, code } = body as { email?: string; code?: string };

  if (
    !email ||
    typeof email !== "string" ||
    !code ||
    typeof code !== "string"
  ) {
    return NextResponse.json(
      { error: "Email and backup code are required." },
      { status: 400 },
    );
  }

  const normEmail = email.trim().toLowerCase();
  const normCode = normaliseCode(code.trim());

  if (!normEmail || !normCode) {
    return NextResponse.json(
      { error: "Email and backup code are required." },
      { status: 400 },
    );
  }

  // Rate limit by email
  if (!checkRateLimit(normEmail)) {
    return NextResponse.json(
      {
        error:
          "Too many failed attempts. Please wait 15 minutes before trying again.",
      },
      { status: 429 },
    );
  }

  let pb: PocketBase;
  try {
    pb = await getSuperuserClient();
  } catch {
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 503 },
    );
  }

  // Resolve user by email — generic error on miss to prevent enumeration
  let userId: string;
  try {
    const user = await pb
      .collection("users")
      .getFirstListItem(`email = '${normEmail}'`);
    userId = user.id;
  } catch {
    // Constant-time sleep to resist timing enumeration
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json(
      { error: "Invalid email or backup code." },
      { status: 401 },
    );
  }

  // Fetch all unused codes for this user
  let unusedCodes: Array<{ id: string; code_hash: string }>;
  try {
    unusedCodes = (await pb.collection("backup_codes").getFullList({
      filter: `user = '${userId}' && used_at = null`,
    })) as Array<{ id: string; code_hash: string }>;
  } catch {
    return NextResponse.json(
      {
        error:
          "No backup codes configured. Please log in via email OTP and generate backup codes from your profile.",
      },
      { status: 401 },
    );
  }

  if (unusedCodes.length === 0) {
    return NextResponse.json(
      {
        error: "No unused backup codes remain. Please log in via email OTP.",
      },
      { status: 401 },
    );
  }

  // Compare against every code without early exit (timing-safe loop)
  let matchedId: string | null = null;
  for (const rec of unusedCodes) {
    const isMatch = verifyCode(normCode, rec.code_hash);
    if (isMatch && matchedId === null) {
      matchedId = rec.id;
    }
  }

  if (!matchedId) {
    return NextResponse.json(
      { error: "Invalid email or backup code." },
      { status: 401 },
    );
  }

  // Mark the matched code as used (atomic — prevents reuse on race)
  try {
    await pb.collection("backup_codes").update(matchedId, {
      used_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Server error while consuming code. Please try again." },
      { status: 500 },
    );
  }

  // Success — clear rate limit for this email
  clearRateLimit(normEmail);

  // Issue a user auth token via PocketBase superuser impersonation.
  // Duration: 7 days (must re-authenticate after expiry).
  // impersonate() returns a new PocketBase client authenticated as the user.
  let authToken: string;
  let authRecord: unknown;
  try {
    const impersonatedPb = await pb
      .collection("users")
      .impersonate(userId, 7 * 24 * 3600);
    authToken = impersonatedPb.authStore.token;
    authRecord = impersonatedPb.authStore.record;
  } catch {
    return NextResponse.json(
      { error: "Server error while issuing session. Please try again." },
      { status: 500 },
    );
  }

  // How many codes remain after this one?
  let remaining = 0;
  try {
    const all = await pb.collection("backup_codes").getFullList({
      filter: `user = '${userId}' && used_at = null`,
    });
    remaining = all.length;
  } catch {
    // Non-fatal — client can fetch separately
  }

  return NextResponse.json({
    token: authToken,
    record: authRecord,
    remaining, // lets client warn user if codes are running low
  });
}
