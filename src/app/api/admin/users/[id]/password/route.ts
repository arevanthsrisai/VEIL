import { NextResponse } from "next/server";
import { getCurrentUser, validatePassword, type PublicUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { adminResetPassword } from "@/lib/admin-users";
import { consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function invalidId(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "22P02";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to reset password.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { tempPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.tempPassword !== "string")
    return NextResponse.json({ error: "Password must be 8-128 characters." }, { status: 400 });
  const pwError = validatePassword(body.tempPassword);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  // ponytail: in-memory limiter (10/hour/admin), Redis if multi-instance
  if (!consume(`pwreset:${user.id}`, 10))
    return NextResponse.json({ error: "Too many password resets. Try again later." }, { status: 429 });

  try {
    const result = await adminResetPassword(id, user.id, body.tempPassword);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // the temp password itself is never returned — only the admin client that generated it holds it
    return NextResponse.json({ ok: true, mustChangePassword: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to reset password.");
  }
}
