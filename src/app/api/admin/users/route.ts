import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin, setUserRole, validateRoleValue } from "@/lib/moderation";
import { listUsers } from "@/lib/admin-users";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function invalidId(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "22P02";
}

export async function GET(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load users.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const search = new URL(req.url).searchParams.get("search") ?? undefined;
  try {
    return NextResponse.json({ users: await listUsers(search) });
  } catch (err) {
    return dbError(err, "Failed to load users.");
  }
}

export async function PATCH(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update user.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.userId !== "string" || body.userId.length === 0)
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  if (!validateRoleValue(body.role))
    return NextResponse.json({ error: "Role must be USER, MODERATOR, or ADMIN." }, { status: 400 });
  if (body.userId === user.id)
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 409 });

  try {
    const result = await setUserRole(body.userId, body.role, user.id);
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (invalidId(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return dbError(err, "Failed to update user.");
  }
}
