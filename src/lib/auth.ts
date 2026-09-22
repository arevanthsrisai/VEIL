import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Role = "USER" | "MODERATOR" | "ADMIN";

export type PublicUser = {
  id: string;
  nickname: string;
  avatar_emoji: string;
  role: Role;
};

type UserRow = PublicUser & {
  username: string;
  password_hash: string;
};

type SessionRow = PublicUser & { expires_at: string };

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const DEFAULT_AVATAR = "🎭";

export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string" || !USERNAME_RE.test(username))
    return "Username must be 3-20 characters: letters, numbers, underscores only.";
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8 || password.length > 128)
    return "Password must be 8-128 characters.";
  return null;
}

export function validateNickname(nickname: unknown): string | null {
  if (typeof nickname !== "string") return "Nickname must be 1-30 characters.";
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > 30)
    return "Nickname must be 1-30 characters.";
  return null;
}

export function validateAvatarEmoji(avatar: unknown): string | null {
  if (avatar === undefined) return null;
  if (typeof avatar !== "string" || avatar.length < 1 || avatar.length > 16)
    return "Avatar must be a short emoji string.";
  return null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toPublicUser(row: {
  id: string;
  nickname: string;
  avatar_emoji: string;
  role: Role;
}): PublicUser {
  return { id: row.id, nickname: row.nickname, avatar_emoji: row.avatar_emoji, role: row.role };
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expiresAt.toISOString(),
  ]);
  // ponytail: opportunistic purge on login/register keeps sessions bounded; expires_at index if table grows
  await query("DELETE FROM sessions WHERE expires_at < now()");
  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<PublicUser | null> {
  if (!token) return null;
  const { rows } = await query<SessionRow>(
    `SELECT u.id, u.nickname, u.avatar_emoji, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
    return null;
  }
  return toPublicUser(row);
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>("SELECT id, username, password_hash, nickname, avatar_emoji, role FROM users WHERE lower(username) = lower($1)", [
    username,
  ]);
  return rows[0] ?? null;
}
