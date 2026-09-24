import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  destroyOtherSessions,
  getCurrentUser,
  hashToken,
  listUserSessions,
  type PublicUser,
} from "@/lib/auth";
import { query } from "@/lib/db";

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
    return dbError(err, "Failed to load sessions.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await listUserSessions(user.id) });
  } catch (err) {
    return dbError(err, "Failed to load sessions.");
  }
}

export async function DELETE(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to sign out sessions.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (body.sessionId !== undefined && body.sessionId !== null) {
      if (typeof body.sessionId !== "string")
        return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
      // clients only ever see the masked prefix (first 8 chars + "…")
      const prefix = body.sessionId.replace(/…+$/, "");
      if (!/^[0-9a-f]{8}$/.test(prefix))
        return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
      await query("DELETE FROM sessions WHERE user_id = $1 AND id LIKE $2 || '%'", [user.id, prefix]);
    } else {
      const store = await cookies();
      const token = store.get(SESSION_COOKIE)?.value ?? null;
      await destroyOtherSessions(user.id, token ? hashToken(token) : null);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbError(err, "Failed to sign out sessions.");
  }
}
