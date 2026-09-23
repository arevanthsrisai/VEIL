import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import {
  hideConfession,
  isStaff,
  moderateConfession,
  restoreConfession,
  validateModerationAction,
  validateRejectionReason,
} from "@/lib/moderation";

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
    return dbError(err, "Failed to moderate confession.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validateModerationAction(body.action))
    return NextResponse.json(
      { error: "Action must be APPROVED, REJECTED, HIDDEN, or RESTORED." },
      { status: 400 },
    );
  let reason: string | null = null;
  if (body.action === "REJECTED") {
    const reasonError = validateRejectionReason(body.reason);
    if (reasonError) return NextResponse.json({ error: reasonError }, { status: 400 });
    reason = (body.reason as string).trim();
  }

  try {
    if (body.action === "HIDDEN") {
      const result = await hideConfession(id, user.id);
      if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if ("conflict" in result)
        return NextResponse.json({ error: "Confession is not approved." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "RESTORED") {
      const result = await restoreConfession(id, user.id);
      if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if ("conflict" in result)
        return NextResponse.json({ error: "Confession is not rejected." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    const result = await moderateConfession(id, user.id, body.action, reason);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("conflict" in result)
      return NextResponse.json({ error: "Confession is not pending." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to moderate confession.");
  }
}
