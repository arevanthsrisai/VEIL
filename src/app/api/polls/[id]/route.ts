import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { closePoll, getPollById } from "@/lib/polls";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function invalidId(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "22P02";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load poll.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const poll = await getPollById(id, user.id);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ poll });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to load poll.");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to close poll.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.action !== "CLOSE")
    return NextResponse.json({ error: "action must be CLOSE." }, { status: 400 });

  const { id } = await params;
  try {
    const result = await closePoll(id, user.id);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("conflict" in result)
      return NextResponse.json({ error: "Poll is already closed." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to close poll.");
  }
}
