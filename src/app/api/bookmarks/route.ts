import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { getConfessionById } from "@/lib/confessions";
import { bookmarkConfession } from "@/lib/bookmarks";
import { consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return dbError(err, "Failed to save post.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { confessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.confessionId !== "string" || !UUID_RE.test(body.confessionId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!consume(`bookmark:${user.id}`, 60))
    return NextResponse.json({ error: "Slow down. Try again later." }, { status: 429 });

  try {
    const row = await getConfessionById(body.confessionId, user.id);
    if (!row || row.status !== "APPROVED")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    await bookmarkConfession(user.id, body.confessionId);
    return NextResponse.json({ bookmarked: true }, { status: 201 });
  } catch (err) {
    return dbError(err, "Failed to save post.");
  }
}
