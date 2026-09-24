import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  changePassword,
  getCurrentUser,
  hashToken,
  validatePassword,
  verifyPassword,
  type PublicUser,
} from "@/lib/auth";
import { getPasswordHash } from "@/lib/profile";
import { consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to change password.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ponytail: in-memory limiter (E2E-bypassed); 5 password changes/hour/user
  if (!consume(`pwchange:${user.id}`, 5))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string")
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });

  try {
    const hash = await getPasswordHash(user.id);
    if (!hash || !(await verifyPassword(body.currentPassword, hash)))
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    const invalid = validatePassword(body.newPassword);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value ?? null;
    await changePassword(user.id, body.newPassword, token ? hashToken(token) : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbError(err, "Failed to change password.");
  }
}
