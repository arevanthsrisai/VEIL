import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { consume } from "@/lib/rate-limit";
import {
  createPoll,
  listActivePolls,
  listClosedPolls,
  validatePollOptions,
  validatePollQuestion,
} from "@/lib/polls";

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
    return dbError(err, "Failed to load polls.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [polls, closedPolls] = await Promise.all([
      listActivePolls(user.id),
      listClosedPolls(user.id),
    ]);
    return NextResponse.json({ polls, closedPolls });
  } catch (err) {
    return dbError(err, "Failed to load polls.");
  }
}

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to create poll.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { question?: unknown; options?: unknown; endsAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const questionError = validatePollQuestion(body.question);
  if (questionError) return NextResponse.json({ error: questionError }, { status: 400 });
  const optionsError = validatePollOptions(body.options);
  if (optionsError) return NextResponse.json({ error: optionsError }, { status: 400 });

  let endsAt: string | null = null;
  if (typeof body.endsAt === "string" && body.endsAt.length > 0) {
    const time = new Date(body.endsAt).getTime();
    if (Number.isNaN(time))
      return NextResponse.json({ error: "Invalid end time." }, { status: 400 });
    if (time <= Date.now())
      return NextResponse.json({ error: "End time must be in the future." }, { status: 400 });
    endsAt = new Date(time).toISOString();
  }

  if (!consume(`poll:create:${user.id}`, 10))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  try {
    const options = (body.options as string[]).map((option) => option.trim());
    const poll = await createPoll(user.id, (body.question as string).trim(), options, endsAt);
    return NextResponse.json({ poll }, { status: 201 });
  } catch (err) {
    return dbError(err, "Failed to create poll.");
  }
}
