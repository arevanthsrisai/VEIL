import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { CONFESSIONS_DEFAULT_LIMIT, CONFESSIONS_MAX_LIMIT } from "@/lib/confessions";
import { searchConfessions } from "@/lib/discovery";
import { clientIp, consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

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
    return dbError(err, "Failed to search confessions.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  if (q.length > 100)
    return NextResponse.json({ error: "Search query must be at most 100 characters." }, { status: 400 });

  const rawLimit = searchParams.get("limit");
  let limit = CONFESSIONS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    limit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), CONFESSIONS_MAX_LIMIT)
      : CONFESSIONS_DEFAULT_LIMIT;
  }

  if (!consume(`search:${clientIp(req)}`, 60, 60_000))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  try {
    const confessions = await searchConfessions(q, limit, user.id);
    return NextResponse.json({ confessions, nextCursor: null });
  } catch (err) {
    return dbError(err, "Failed to search confessions.");
  }
}
