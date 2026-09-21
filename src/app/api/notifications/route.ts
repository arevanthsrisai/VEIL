import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/moderation";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load notifications.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await listNotifications(user.id));
  } catch (err) {
    return dbError(err, "Failed to load notifications.");
  }
}

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update notifications.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: unknown; ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.action !== "read")
    return NextResponse.json({ error: "Action must be read." }, { status: 400 });
  let ids: string[] | null = null;
  if (body.ids !== undefined) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 100 ||
      !body.ids.every((id): id is string => typeof id === "string" && UUID_RE.test(id))
    )
      return NextResponse.json(
        { error: "ids must be an array of at most 100 notification ids." },
        { status: 400 },
      );
    ids = body.ids;
  }

  try {
    await markNotificationsRead(user.id, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbError(err, "Failed to update notifications.");
  }
}
