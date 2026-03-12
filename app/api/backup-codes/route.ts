/**
 * GET  /api/backup-codes  — return backup code status for the authenticated user
 * POST /api/backup-codes  — generate a fresh set of backup codes (invalidates old ones)
 *
 * All mutation logic runs server-side with superuser credentials.
 * The raw codes are returned once on generation and never stored in plain text.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://devpb.eluxemang.top";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

const BACKUP_CODES_COUNT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSuperuserClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  return pb;
}

async function getAuthenticatedUserId(token: string): Promise<string | null> {
  try {
    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);
    const result = await pb.collection("users").authRefresh();
    return result.record?.id ?? null;
  } catch {
    return null;
  }
}

function extractToken(req: NextRequest): string {
  return req.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

/**
 * Generate a single high-entropy backup code.
 * Format: AAAAA-BBBBB-CCCCC-DDDDD (20 uppercase hex chars in 4 groups of 5)
 * = 80 bits of entropy; safe for one-time codes.
 */
function generateRawCode(): string {
  const hex = crypto.randomBytes(10).toString("hex").toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
}

/**
 * Derive a salted SHA-256 hash for storage.
 * Returns "hexSalt:hexHash" — the salt is stored alongside so validation
 * can recompute the hash without a global pepper.
 *
 * The raw code is normalised (dashes stripped, uppercased) before hashing
 * so it matches what the verification path receives from user input.
 */
function hashRawCode(raw: string): string {
  const normalised = raw.replace(/-/g, "").toUpperCase();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}:${normalised}`)
    .digest("hex");
  return `${salt}:${hash}`;
}

// ─── GET /api/backup-codes ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getAuthenticatedUserId(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pb = await getSuperuserClient();
    const records = await pb.collection("backup_codes").getFullList({
      filter: `user = '${userId}'`,
    });

    const total = records.length;
    const used = records.filter((r) => r.used_at).length;
    const remaining = total - used;

    return NextResponse.json({
      total,
      used,
      remaining,
      hasActive: remaining > 0,
    });
  } catch {
    // Collection may not exist yet — treat as no codes configured
    return NextResponse.json({
      total: 0,
      used: 0,
      remaining: 0,
      hasActive: false,
    });
  }
}

// ─── POST /api/backup-codes ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getAuthenticatedUserId(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pb = await getSuperuserClient();

    // Delete all existing codes for this user (regenerate = full replacement)
    const existing = await pb.collection("backup_codes").getFullList({
      filter: `user = '${userId}'`,
    });
    for (const rec of existing) {
      await pb.collection("backup_codes").delete(rec.id);
    }

    // Generate and store hashed codes
    const plainCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      const raw = generateRawCode();
      plainCodes.push(raw);
      await pb.collection("backup_codes").create({
        user: userId,
        code_hash: hashRawCode(raw),
        // used_at left absent so PocketBase stores null (unused)
      });
    }

    // Return plain codes — displayed once; never retrievable again
    return NextResponse.json({ codes: plainCodes });
  } catch (err: unknown) {
    console.error("[backup-codes POST]", err);
    return NextResponse.json(
      { error: "Failed to generate backup codes. Please try again." },
      { status: 500 },
    );
  }
}
