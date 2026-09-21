import { NextResponse } from "next/server";
import {
  DEFAULT_AVATAR,
  createSession,
  hashPassword,
  sessionCookieOptions,
  toPublicUser,
  validateAvatarEmoji,
  validateNickname,
  validatePassword,
  validateUsername,
  type PublicUser,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp, consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    username?: unknown;
    password?: unknown;
    nickname?: unknown;
    avatarEmoji?: unknown;
    avatar_emoji?: unknown;
    turnstileToken?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { username, password, nickname } = body;
  const avatar_emoji = body.avatarEmoji ?? body.avatar_emoji;
  if (!consume(`register:${clientIp(req)}`, 5))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  if (!(await verifyTurnstile(body.turnstileToken)))
    return NextResponse.json({ error: "Bot verification failed." }, { status: 403 });
  const error =
    validateUsername(username) ??
    validatePassword(password) ??
    validateNickname(nickname) ??
    validateAvatarEmoji(avatar_emoji);
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const password_hash = await hashPassword(password as string);
    const { rows } = await query<PublicUser & { id: string }>(
      `INSERT INTO users (username, password_hash, nickname, avatar_emoji)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nickname, avatar_emoji, role`,
      [username, password_hash, (nickname as string).trim(), avatar_emoji ?? DEFAULT_AVATAR],
    );
    const user = toPublicUser(rows[0]);
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set("session", token, sessionCookieOptions(expiresAt));
    return res;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505")
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    if (err instanceof Error && err.message.includes("DATABASE_URL"))
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
