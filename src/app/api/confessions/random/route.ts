import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { CONFESSIONS_DEFAULT_LIMIT, CONFESSIONS_MAX_LIMIT } from "@/lib/confessions";
import { randomConfessions } from "@/lib/discovery";

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
    return dbError(err, "Failed to load random confessions.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  let limit = CONFESSIONS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    limit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), CONFESSIONS_MAX_LIMIT)
      : CONFESSIONS_DEFAULT_LIMIT;
  }

  try {
    const confessions = await randomConfessions(limit, user.id);
    return NextResponse.json({ confessions });
  } catch (err) {
    return dbError(err, "Failed to load random confessions.");
  }
}
