import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import {
  CONFESSIONS_DEFAULT_LIMIT,
  CONFESSIONS_MAX_LIMIT,
  consumeConfessionQuota,
  createConfession,
  listApprovedConfessions,
  normalizeConfessionTitle,
  validateConfessionContent,
  validateConfessionTitle,
} from "@/lib/confessions";

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
    return dbError(err, "Failed to load confessions.");
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
  const rawCursor = searchParams.get("cursor");
  let cursor: string | null = null;
  if (rawCursor !== null && rawCursor !== "") {
    const t = new Date(rawCursor).getTime();
    if (Number.isNaN(t)) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    cursor = new Date(t).toISOString();
  }

  try {
    return NextResponse.json(await listApprovedConfessions(limit, cursor, user.id));
  } catch (err) {
    return dbError(err, "Failed to load confessions.");
  }
}

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to create confession.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const contentError = validateConfessionContent(body.content);
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
  const titleError = validateConfessionTitle(body.title);
  if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });
  if (!consumeConfessionQuota(user.id))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  try {
    const confession = await createConfession(
      user.id,
      normalizeConfessionTitle(body.title),
      (body.content as string).trim(),
    );
    return NextResponse.json({ confession }, { status: 202 });
  } catch (err) {
    return dbError(err, "Failed to create confession.");
  }
}
