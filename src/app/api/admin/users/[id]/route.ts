import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { removeUser } from "@/lib/admin-users";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function invalidId(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "22P02";
}

function fkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23503";
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to remove user.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (id === user.id)
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 409 });

  try {
    const result = await removeUser(id, user.id);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("forbidden" in result)
      return NextResponse.json(
        { error: "You cannot remove moderators or admins." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (fkViolation(err))
      return NextResponse.json(
        { error: "This account has moderation history and can't be removed." },
        { status: 409 },
      );
    return dbError(err, "Failed to remove user.");
  }
}
