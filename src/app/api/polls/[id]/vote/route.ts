import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { consume } from "@/lib/rate-limit";
import { vote } from "@/lib/polls";

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
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to vote.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { optionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.optionId !== "string" || body.optionId.length === 0)
    return NextResponse.json({ error: "optionId is required." }, { status: 400 });

  if (!consume(`poll:vote:${user.id}`, 30))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  const { id } = await params;
  try {
    const result = await vote(id, user.id, body.optionId);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("invalid" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("conflict" in result)
      return NextResponse.json({ error: "This poll is closed." }, { status: 409 });
    return NextResponse.json({
      voted: result.voted,
      counts: result.counts,
      myVote: result.myVote,
    });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to vote.");
  }
}
