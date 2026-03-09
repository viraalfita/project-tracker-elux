/**
 * PATCH /api/profile — update the authenticated user's own profile.
 *
 * Any authenticated user can call this to update their name, initials,
 * and avatarColor. Used by the /profile/setup onboarding page.
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

/** Verify that the bearer token belongs to a valid user. Returns the userId or null. */
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

function extractToken(request: NextRequest): string {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ?? "";
}

export async function PATCH(request: NextRequest) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getAuthenticatedUserId(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, initials, avatarColor } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("users").update(userId, {
      name: String(name).trim(),
      initials: initials ? String(initials).trim() : String(name).trim().split(" ").map((w: string) => w[0]?.toUpperCase() ?? "").slice(0, 2).join(""),
      ...(avatarColor ? { avatarColor: String(avatarColor) } : {}),
    });
    return NextResponse.json(record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
