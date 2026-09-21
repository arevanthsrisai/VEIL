import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { getConfessionById } from "@/lib/confessions";
import { getReactionCounts, isAllowedEmoji, toggleReaction } from "@/lib/interactions";
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

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update reaction.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { confessionId?: unknown; emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.confessionId !== "string" || body.confessionId.length === 0)
    return NextResponse.json({ error: "confessionId is required." }, { status: 400 });
  if (!isAllowedEmoji(body.emoji))
    return NextResponse.json({ error: "Invalid emoji." }, { status: 400 });
  if (!consume(`reaction:${user.id}`, 30))
    return NextResponse.json({ error: "Slow down. Try again later." }, { status: 429 });

  try {
    const row = await getConfessionById(body.confessionId, user.id);
    if (!row || row.status !== "APPROVED")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const reacted = await toggleReaction(body.confessionId, user.id, body.emoji);
    const counts = await getReactionCounts(body.confessionId);
    return NextResponse.json({ reacted, counts });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to update reaction.");
  }
}
