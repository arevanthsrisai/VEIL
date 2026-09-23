import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin, restrictUser, unrestrictUser, validateRestrictionDays } from "@/lib/moderation";

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
  const { id } = await params;
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update user.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validateRestrictionDays(body.days))
    return NextResponse.json(
      { error: "Days must be an integer between 1 and 30, or null to unrestrict." },
      { status: 400 },
    );

  try {
    if (body.days === null) {
      const result = await unrestrictUser(id, user.id);
      if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    const result = await restrictUser(id, user.id, body.days);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("forbidden" in result)
      return NextResponse.json(
        { error: "You cannot restrict moderators or admins." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to update user.");
  }
}
