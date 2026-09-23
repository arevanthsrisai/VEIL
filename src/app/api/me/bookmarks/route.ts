import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { listBookmarkedConfessions } from "@/lib/bookmarks";

export const runtime = "nodejs";

const BOOKMARKS_LIMIT = 20;

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load saved posts.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawCursor = new URL(req.url).searchParams.get("cursor");
  let cursor: string | null = null;
  if (rawCursor !== null && rawCursor !== "") {
    const t = new Date(rawCursor).getTime();
    if (Number.isNaN(t)) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    cursor = new Date(t).toISOString();
  }

  try {
    return NextResponse.json(await listBookmarkedConfessions(user.id, cursor, BOOKMARKS_LIMIT));
  } catch (err) {
    return dbError(err, "Failed to load saved posts.");
  }
}
