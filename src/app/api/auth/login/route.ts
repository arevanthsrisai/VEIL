import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  SESSION_COOKIE,
  createSession,
  findUserByUsername,
  sessionCookieOptions,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp, consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DUMMY_HASH = "$2b$10$C6UzMDM.H6dfI/f/IKcEe.Q9r8T0p8Q7Y6Z5X4W3V2U1T0S9R8Q7P6O";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown; turnstileToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string")
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  if (!consume(`login:${clientIp(req)}`, 10, 15 * 60 * 1000))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  if (!(await verifyTurnstile(body.turnstileToken)))
    return NextResponse.json({ error: "Bot verification failed." }, { status: 403 });

  try {
    const user = await findUserByUsername(username);
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok)
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    // ponytail: one extra SELECT because auth.ts (not owned here) doesn't select restricted_until;
    // fold into findUserByUsername if auth.ts ownership changes
    const { rows: restrictionRows } = await query<{ restricted_until: Date | null }>(
      `SELECT restricted_until FROM users WHERE id = $1`,
      [user.id],
    );
    const restrictedUntil = restrictionRows[0]?.restricted_until ?? null;
    if (restrictedUntil !== null && restrictedUntil.getTime() > Date.now())
      return NextResponse.json({ error: "Account restricted. Try again later." }, { status: 403 });
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (err) {
    if (err instanceof Error && err.message.includes("DATABASE_URL"))
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
