import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { getConfessionById } from "@/lib/confessions";
import {
  consumeReportQuota,
  createReport,
  validateReportReason,
} from "@/lib/interactions";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function invalidId(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "22P02";
}

function asId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

export async function POST(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to create report.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { confessionId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const reasonError = validateReportReason(body.reason);
  if (reasonError) return NextResponse.json({ error: reasonError }, { status: 400 });
  const confessionId = asId(body.confessionId);
  if (confessionId === null)
    return NextResponse.json(
      { error: "confessionId is required." },
      { status: 400 },
    );
  if (!consumeReportQuota(user.id))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  try {
    const row = await getConfessionById(confessionId, user.id);
    if (!row || row.status !== "APPROVED")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const report = await createReport({
      confessionId,
      reporterId: user.id,
      reason: (body.reason as string).trim(),
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to create report.");
  }
}
