import { listUserSessions, validateAvatarEmoji, validateNickname, type SessionSummary } from "./auth";
import { query } from "./db";

export type ProfileUpdate = { nickname?: string; avatar_emoji?: string };

export type ProfileData = {
  restricted_until: string | null;
  created_at: string | null;
  sessions: SessionSummary[];
};

export function validateProfileUpdate(body: {
  nickname?: unknown;
  avatar_emoji?: unknown;
}): { ok: true; update: ProfileUpdate } | { ok: false; error: string } {
  const update: ProfileUpdate = {};
  if (body.nickname !== undefined) {
    const err = validateNickname(body.nickname);
    if (err) return { ok: false, error: err };
    update.nickname = (body.nickname as string).trim();
  }
  if (body.avatar_emoji !== undefined) {
    const err = validateAvatarEmoji(body.avatar_emoji);
    if (err) return { ok: false, error: err };
    update.avatar_emoji = body.avatar_emoji as string;
  }
  return { ok: true, update };
}

export async function getProfile(userId: string): Promise<ProfileData> {
  const [restricted, sessions] = await Promise.all([
    query<{ restricted_until: Date | string | null }>(
      "SELECT restricted_until FROM users WHERE id = $1",
      [userId],
    ),
    listUserSessions(userId),
  ]);
  // ponytail: created_at is best-effort — added via live ALTER, not yet in db/schema.sql;
  // a fresh env from the current schema.sql lacks the column, so fall back to null instead of 500ing
  let createdAt: Date | string | null | undefined;
  try {
    const created = await query<{ created_at: Date | string | null }>(
      "SELECT created_at FROM users WHERE id = $1",
      [userId],
    );
    createdAt = created.rows[0]?.created_at;
  } catch {
    createdAt = null;
  }
  const until = restricted.rows[0]?.restricted_until ?? null;
  return {
    restricted_until: until ? new Date(until).toISOString() : null,
    created_at: createdAt ? new Date(createdAt).toISOString() : null,
    sessions,
  };
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const { rows } = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId],
  );
  return rows[0]?.password_hash ?? null;
}
