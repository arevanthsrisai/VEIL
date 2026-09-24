import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { query, transaction } from "./db";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Role = "USER" | "MODERATOR" | "ADMIN";

export type PublicUser = {
  id: string;
  nickname: string;
  avatar_emoji: string;
  role: Role;
  must_change_password?: boolean;
};

type UserRow = PublicUser & {
  username: string;
  password_hash: string;
  restricted_until: Date | null;
};

type SessionRow = PublicUser & { expires_at: string; restricted_until: string | null };

export type SessionSummary = { id: string; expires_at: string };

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
  must_change_password?: boolean;
}): PublicUser {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar_emoji: row.avatar_emoji,
    role: row.role,
    must_change_password: row.must_change_password,
  };
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
    `SELECT u.id, u.nickname, u.avatar_emoji, u.role, u.restricted_until, u.must_change_password, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
    return null;
  }
  if (row.restricted_until && new Date(row.restricted_until).getTime() > Date.now()) {
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
  const { rows } = await query<UserRow>(
    "SELECT id, username, password_hash, nickname, avatar_emoji, role, restricted_until, must_change_password FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  return rows[0] ?? null;
}

export async function updateProfile(
  userId: string,
  update: { nickname?: string; avatar_emoji?: string },
): Promise<PublicUser> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (update.nickname !== undefined) {
    params.push(update.nickname);
    sets.push(`nickname = $${params.length}`);
  }
  if (update.avatar_emoji !== undefined) {
    params.push(update.avatar_emoji);
    sets.push(`avatar_emoji = $${params.length}`);
  }
  const columns = "id, nickname, avatar_emoji, role, must_change_password";
  if (sets.length === 0) {
    const { rows } = await query<PublicUser>(`SELECT ${columns} FROM users WHERE id = $1`, [userId]);
    const row = rows[0];
    if (!row) throw new Error("User not found.");
    return row;
  }
  params.push(userId);
  const { rows } = await query<PublicUser>(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${columns}`,
    params,
  );
  const row = rows[0];
  if (!row) throw new Error("User not found.");
  return row;
}

export async function changePassword(
  userId: string,
  newPassword: string,
  keepTokenHash: string | null,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await tx.query("UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2", [
      passwordHash,
      userId,
    ]);
    if (keepTokenHash)
      await tx.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, keepTokenHash]);
    else await tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await tx.query(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'PASSWORD_CHANGED', 'user', $2)",
      [userId, userId],
    );
  });
}

export async function listUserSessions(userId: string): Promise<SessionSummary[]> {
  const { rows } = await query<{ id: string; expires_at: Date | string }>(
    "SELECT id, expires_at FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY expires_at DESC",
    [userId],
  );
  // masked ids only — the full token hash never leaves this function
  return rows.map((r) => ({
    id: `${r.id.slice(0, 8)}…`,
    expires_at: new Date(r.expires_at).toISOString(),
  }));
}

export async function destroyOtherSessions(userId: string, keepTokenHash: string | null): Promise<void> {
  if (keepTokenHash)
    await query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, keepTokenHash]);
  else await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}
